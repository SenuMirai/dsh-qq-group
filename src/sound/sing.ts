/**
 * 唱歌引擎（A 档：TTS 声线 + 音高/时值处理 + 混音）。
 *
 * ── 它到底在做什么（不吹）──
 * 1. 把每个字用 edge-tts 念一遍，拿到一段**人声干音**；
 * 2. 用自相关测出这段干音的基频（F0）；
 * 3. 按「目标音高 / 实测基频」的比值重采样，把音高校准到谱面上的那个音；
 * 4. 用交叉淡化循环把时值拉长到谱面要求的长度（短了就截，带淡出）；
 * 5. 加颤音（vibrato）、和声层，再过一遍混音链（EQ/压缩/混响/宽度/限幅）；
 * 6. 与代码合成的伴奏垫底混在一起。
 *
 * **它不是 DiffSinger**：音色仍然是 TTS 的音色，字与字之间没有连音（legato），
 * 也不会有真正的换气与咬字过渡。听起来像「有人在用说话的声音把旋律哼出来」，
 * 这对群聊场景已经够用，而且部署成本是 0（不需要 GPU、不需要音源库）。
 *
 * ── B/C 档的接口在哪 ──
 * `SingBackend` 就是那个接口：`render(score, options) => Promise<RenderResult>`。
 * 想接 DiffSinger / RVC 时，实现一个新的 backend 并注册进 `resolveBackend()`，
 * 上层（QQ 回复流程、HTTP 接口、命令行）**一行都不用改**。
 */

import type { QqSingConfig } from '../qq/config';
import { fade, highpass, normalize } from './dsp';
import { mixDown, mixVocal } from './mix';
import { midiToHz, secondsPerBeat, type Note, type Score } from './score';
import { encodeWave, pcm, toMono, type Pcm } from './wav';

/** 人声来源（TTS 抽象；测试里可以注入假的） */
export interface VocalSource {
  /** 合成一段文字，返回单声道波形；失败抛错或返回失败对象 */
  speak(text: string, options?: { pitch?: string; rate?: string }): Promise<{ ok: true; audio: Pcm } | { ok: false; reason: string; message: string }>;
  /** 展示名（日志用） */
  readonly label: string;
}

/** 渲染参数 */
export interface RenderOptions {
  /** 全局移调（半音） */
  transpose?: number;
  /** 混音参数（不传用默认） */
  mix?: QqSingConfig['mix'];
  /** 颤音深度（半音，0 = 不要颤音） */
  vibratoDepth?: number;
  /** 颤音频率（Hz） */
  vibratoRate?: number;
  /** 是否加伴奏（默认加） */
  accompaniment?: boolean;
  /** 伴奏音量（dB） */
  accompanimentDb?: number;
  /** 音源库目录（B 档用；A 档忽略） */
  voicebankDir?: string;
  /** RVC 模型（C 档用；A 档忽略） */
  rvcModel?: string;
  /** 进度回调（长曲子渲染时给日志/面板用） */
  onProgress?: (done: number, total: number) => void;
}

/** 渲染结果 */
export type RenderResult =
  | {
      ok: true;
      /** 最终 WAV 字节（立体声 44.1 kHz） */
      wav: Uint8Array;
      /** 波形（给上层做二次处理/测试断言用） */
      audio: Pcm;
      /** 诊断信息 */
      report: {
        backend: string;
        duration: number;
        notes: number;
        /** 每个音实测到的基频与目标频率（调试音准时用） */
        tuning: Array<{ index: number; targetHz: number; measuredHz?: number; sungHz: number }>;
      };
    }
  | { ok: false; reason: string; message: string };

/** 唱歌后端（B/C 档的扩展点） */
export interface SingBackend {
  readonly name: string;
  readonly description: string;
  render(score: Score, source: VocalSource, options: RenderOptions): Promise<RenderResult>;
}

/** 输出采样率：QQ 语音最终会被转成 silk，44.1k 是安全的高点 */
const OUTPUT_RATE = 44_100;

/**
 * 自相关测基频。
 *
 * 只对「元音 + 浊音」有效（清音没有基频），所以测不到时返回 undefined，
 * 让调用方按「不校准」处理——**不猜**，猜错了整首歌就跑调。
 *
 * @param samples 单声道波形
 * @param sampleRate 采样率
 * @param options 搜索范围（默认 70~1000 Hz，覆盖人声）
 */
export function detectPitch(
  samples: Float32Array,
  sampleRate: number,
  options: { minHz?: number; maxHz?: number; threshold?: number } = {},
): number | undefined {
  const minHz = options.minHz ?? 70;
  const maxHz = options.maxHz ?? 1000;
  const threshold = options.threshold ?? 0.3;
  const minLag = Math.floor(sampleRate / maxHz);
  const maxLag = Math.min(Math.floor(sampleRate / minHz), Math.floor(samples.length / 2));
  if (maxLag <= minLag) return undefined;

  // 取能量最大的一段（通常就是元音的中段）
  const window = Math.min(samples.length, Math.floor(sampleRate * 0.08));
  let bestStart = 0;
  let bestEnergy = -1;
  const stride = Math.max(1, Math.floor(window / 4));
  for (let start = 0; start + window <= samples.length; start += stride) {
    let energy = 0;
    for (let i = 0; i < window; i += 1) {
      const v = samples[start + i] ?? 0;
      energy += v * v;
    }
    if (energy > bestEnergy) {
      bestEnergy = energy;
      bestStart = start;
    }
  }
  if (bestEnergy <= 0) return undefined;

  const segment = samples.subarray(bestStart, Math.min(samples.length, bestStart + window * 2));

  // 找「第一个足够强的峰」，而不是「全局最大值」。
  //
  // 这是自相关测音高最经典的坑：周期信号在 lag 的整数倍上都有峰（440 Hz 在 100、200、
  // 300 个采样都有），而**长 lag 的峰因为窗口重叠更完整，归一化后往往比基频那个峰还高**，
  // 于是全局最大值法会把 440 Hz 判成 110 Hz（正好差两个八度）。实测就是这么错的。
  //
  // 正确做法：先找到最高峰的 80%，再取**最靠前**的那个达到该阈值的局部极大值。
  const correlations = new Float64Array(maxLag + 1);
  let peakCorrelation = 0;
  for (let lag = minLag; lag <= maxLag; lag += 1) {
    correlations[lag] = normalizeCorrelation(segment, lag, window);
    if (correlations[lag] > peakCorrelation) peakCorrelation = correlations[lag];
  }
  if (peakCorrelation < threshold) return undefined;

  const accept = Math.max(threshold, peakCorrelation * 0.8);
  let bestLag = -1;
  for (let lag = minLag + 1; lag <= maxLag; lag += 1) {
    const value = correlations[lag] ?? 0;
    if (value < accept) continue;
    // 局部极大（给边界留一格的余量）
    const left = correlations[lag - 1] ?? 0;
    const right = lag + 1 <= maxLag ? (correlations[lag + 1] ?? 0) : -1;
    if (value >= left && value >= right) {
      bestLag = lag;
      break;
    }
  }
  if (bestLag < 0) return undefined;
  const bestCorrelation = correlations[bestLag] ?? 0;

  // 抛物线插值：整数 lag 的精度对音准不够（261.6 Hz 与 277 Hz 只差 1 个 lag）
  const at = (lag: number): number => (lag < minLag || lag > maxLag ? bestCorrelation : normalizeCorrelation(segment, lag, window));
  const left = at(bestLag - 1);
  const right = at(bestLag + 1);
  const denominator = left - 2 * bestCorrelation + right;
  const offset = denominator === 0 ? 0 : (0.5 * (left - right)) / denominator;
  return sampleRate / (bestLag + offset);
}

/** 归一化互相关（-1~1）：某一段与后移 lag 后的自相似度 */
function normalizeCorrelation(segment: Float32Array, lag: number, window: number): number {
  let correlation = 0;
  let normA = 0;
  let normB = 0;
  const limit = Math.min(segment.length - lag, window);
  for (let i = 0; i < limit; i += 1) {
    const a = segment[i] ?? 0;
    const b = segment[i + lag] ?? 0;
    correlation += a * b;
    normA += a * a;
    normB += b * b;
  }
  const denominator = Math.sqrt(normA * normB);
  return denominator <= 0 ? 0 : correlation / denominator;
}

/** 去掉首尾静音（阈值按峰值比例），并返回裁好的段 */
export function trimSilence(samples: Float32Array, thresholdRatio = 0.02): Float32Array {
  let max = 0;
  for (let i = 0; i < samples.length; i += 1) {
    const v = Math.abs(samples[i] ?? 0);
    if (v > max) max = v;
  }
  if (max <= 0) return samples;
  const threshold = max * thresholdRatio;
  let start = 0;
  while (start < samples.length && Math.abs(samples[start] ?? 0) < threshold) start += 1;
  let end = samples.length - 1;
  while (end > start && Math.abs(samples[end] ?? 0) < threshold) end -= 1;
  // 前后各留 10 ms，避免起步/收尾太生硬
  const pad = Math.round(samples.length * 0.002);
  return samples.subarray(Math.max(0, start - pad), Math.min(samples.length, end + pad));
}

/**
 * 把一段音拉伸到目标时长（带交叉淡化的循环或裁切）。
 *
 * 为什么用循环而不是「变速」：变速会改变音高，而我们**刚刚**才把音高校准好。
 * 循环 + 交叉淡化在保持音高的前提下改变时长，这正是「拉长一个持续音」需要的。
 */
export function stretchTo(samples: Float32Array, sampleRate: number, seconds: number): Float32Array {
  const target = Math.max(1, Math.round(seconds * sampleRate));
  if (samples.length >= target) {
    // 太长：截断并淡出（用 8ms 淡出防爆音）
    const cut = samples.slice(0, target);
    const fadeSamples = Math.min(cut.length, Math.round(sampleRate * 0.012));
    for (let i = 0; i < fadeSamples; i += 1) {
      const index = cut.length - 1 - i;
      cut[index] = (cut[index] ?? 0) * (i / fadeSamples);
    }
    return cut;
  }
  // 太短：以「去掉首尾后的稳定段」为单元循环拼接
  const out = new Float32Array(target);
  const sliceStart = Math.floor(samples.length * 0.15);
  const sliceEnd = Math.max(sliceStart + 1, Math.floor(samples.length * 0.85));
  const unit = samples.subarray(sliceStart, sliceEnd);
  const crossfade = Math.min(Math.floor(unit.length * 0.2), Math.round(sampleRate * 0.02));
  // 先放整段（保留起音），再循环稳定段补足
  out.set(samples.subarray(0, Math.min(samples.length, target)), 0);
  let written = Math.min(samples.length, target);
  while (written < target) {
    const chunk = Math.min(unit.length, target - written);
    for (let i = 0; i < chunk; i += 1) {
      const dry = unit[i] ?? 0;
      const existing = out[written + i] ?? 0;
      // 前 crossfade 个样本交叉淡化，之后直接写
      const blend = i < crossfade ? i / crossfade : 1;
      out[written + i] = existing * (1 - blend) + dry * blend;
    }
    written += chunk;
  }
  // 结尾淡出，避免突然截断
  const fadeSamples = Math.min(out.length, Math.round(sampleRate * 0.03));
  for (let i = 0; i < fadeSamples; i += 1) {
    const index = out.length - 1 - i;
    out[index] = (out[index] ?? 0) * (i / fadeSamples);
  }
  return out;
}

/**
 * 加颤音：对**播放速度**做正弦调制（读取步长随 sin 变化），等效于对音高调制。
 *
 * 数学上：采样频率 f 的信号，以步长 m 读取，输出频率就是 f·m。
 * 所以让 m(t) = 2^(semitones(t)/12) 就能得到以半音为单位的颤音深度。
 * 不能用「读取位置加一个正弦偏移」——那只做相位抖动，音高不变，听起来是发虚不是颤音。
 */
export function applyVibrato(samples: Float32Array, sampleRate: number, depthSemitones: number, rateHz: number): Float32Array {
  if (depthSemitones <= 0 || rateHz <= 0 || samples.length === 0) return samples;
  const out = new Float32Array(samples.length);
  // 前 30% 不加颤音（起音要稳），之后逐渐加深——真人唱歌也是这样
  const onset = Math.floor(samples.length * 0.3);
  const ramp = Math.max(1, onset);
  let phase = 0;
  let position = 0;
  for (let i = 0; i < samples.length; i += 1) {
    const depth = i < onset ? 0 : Math.min(1, (i - onset) / ramp) * depthSemitones;
    const semitones = depth * Math.sin(phase);
    phase += (2 * Math.PI * rateHz) / sampleRate;
    const step = Math.pow(2, semitones / 12);
    const i0 = Math.floor(position);
    const frac = position - i0;
    const s0 = samples[Math.min(samples.length - 1, i0)] ?? 0;
    const s1 = samples[Math.min(samples.length - 1, i0 + 1)] ?? s0;
    out[i] = s0 + (s1 - s0) * frac;
    position += step;
    if (position >= samples.length - 1) {
      // 读到头了：剩下的补零（调用方会按目标时长截断或循环）
      break;
    }
  }
  return out;
}

/**
 * 渲染一个音符：念字 → 测基频 → 重采样校准音高 → 拉伸到目标时值 → 加颤音。
 *
 * @param note 音符
 * @param source 人声来源
 * @param targetSeconds 这个音要唱多久（由 bpm 与 dur 算好）
 * @param options 移调/颤音参数与 TTS 缓存
 */
async function renderNote(
  note: Note,
  source: VocalSource,
  targetSeconds: number,
  options: { transpose: number; vibratoDepth: number; vibratoRate: number; cache: Map<string, Pcm> },
): Promise<
  | { ok: true; audio: Float32Array; measuredHz?: number; sungHz: number; clamped?: boolean }
  | { ok: false; reason: string; message: string }
> {
  const text = note.lyric ?? '啊';
  let raw = options.cache.get(text);
  if (raw === undefined) {
    const result = await source.speak(text);
    if (!result.ok) return { ok: false, reason: result.reason, message: result.message };
    raw = toMono(result.audio);
    options.cache.set(text, raw);
  }
  const channel = raw.channels[0];
  if (channel === undefined || channel.length === 0) {
    return { ok: false, reason: 'empty-vocal', message: `TTS 对「${text}」返回了空音频` };
  }

  const trimmed = trimSilence(channel);
  const measuredHz = detectPitch(trimmed, raw.sampleRate);
  const targetHz = midiToHz(note.midi + options.transpose);

  /**
   * 音高校准的比值。
   *
   * ── 为什么上限是「两个八度」而不是「一个八度」 ──
   * 早先写的是 `if (ratio > 2 || ratio < 0.5) ratio = 1`（放弃校准），
   * 本意是防「自相关八度误判」。实测发现它误伤正常情况：
   * TTS 念一个元音大约在 A3 附近（200~220 Hz），而谱面上的 A4 是 440 Hz ——
   * ratio 正好 2.2，被这条规则判为「测错了」，于是**整首歌的高音全部不校准**，
   * 听起来就是那几个音突然掉下去两个八度。（用 demo CSV 一眼看出来的。）
   *
   * 正确的边界：真人的音域与 TTS 的基频差异通常在一个八度左右，加上谱面可以写高音，
   * **两个八度**才是合理的安全区。超出这个范围才确实可疑（可能是把 110 Hz 测成了 440）。
   *
   * 另外：这里**不静默**——超出范围时会记进 `ratioClamped`，由调用方汇总上报，
   * 免得又出现「某个音莫名其妙不对，但日志里什么都没有」。
   */
  let ratio = 1;
  let clamped = false;
  if (measuredHz !== undefined && measuredHz > 0) {
    ratio = targetHz / measuredHz;
    const MIN_RATIO = 0.25; // 降两个八度
    const MAX_RATIO = 4; // 升两个八度
    if (ratio > MAX_RATIO || ratio < MIN_RATIO) {
      clamped = true;
      ratio = 1;
    }
  }

  const shifted = resampleBy(trimmed, ratio);
  const stretched = stretchTo(shifted, raw.sampleRate, targetSeconds);
  const vibrato = applyVibrato(stretched, raw.sampleRate, options.vibratoDepth, options.vibratoRate);

  return {
    ok: true,
    audio: vibrato,
    ...(measuredHz === undefined ? {} : { measuredHz }),
    ...(clamped ? { clamped: true } : {}),
    sungHz: measuredHz === undefined ? targetHz : measuredHz * ratio,
  };
}

/** 按比值重采样（ratio > 1 = 更高更短） */
function resampleBy(samples: Float32Array, ratio: number): Float32Array {
  if (Math.abs(ratio - 1) < 1e-6) return samples;
  const outLength = Math.max(1, Math.round(samples.length / ratio));
  const out = new Float32Array(outLength);
  for (let i = 0; i < outLength; i += 1) {
    const pos = i * ratio;
    const i0 = Math.floor(pos);
    const frac = pos - i0;
    const s0 = samples[Math.min(samples.length - 1, i0)] ?? 0;
    const s1 = samples[Math.min(samples.length - 1, i0 + 1)] ?? s0;
    out[i] = s0 + (s1 - s0) * frac;
  }
  return out;
}

/**
 * 合成伴奏（纯代码生成，不需要任何采样素材）。
 *
 * 用「加法合成 + 包络」做一个类似电钢的垫底：基频 + 几个泛音，起音快、衰减慢。
 * 为什么不找伴奏音源：版权与体积都不合适；而且群聊场景里伴奏只是「别让它干唱」。
 */
export function renderAccompaniment(score: Score, options: { transpose?: number; gainDb?: number } = {}): Pcm {
  const sampleRate = OUTPUT_RATE;
  const totalSeconds = (score.notes.reduce((max, n) => Math.max(max, n.start + n.dur), 0) + 1) * secondsPerBeat(score);
  const frames = Math.max(1, Math.round(totalSeconds * sampleRate));
  const mono = new Float32Array(frames);
  const transpose = options.transpose ?? 0;

  // 按小节把同时发声的音符归成和弦，每两小节换一次
  const barSeconds = score.beatsPerBar * secondsPerBeat(score);
  const totalBars = Math.ceil(totalSeconds / barSeconds);
  for (let bar = 0; bar < totalBars; bar += 1) {
    const barStart = bar * barSeconds;
    const inBar = score.notes.filter((note) => note.start * secondsPerBeat(score) >= barStart && note.start * secondsPerBeat(score) < barStart + barSeconds);
    const chord = inBar.length > 0 ? inBar : score.notes.slice(0, 3);
    const startFrame = Math.round(barStart * sampleRate);
    const barFrames = Math.round(barSeconds * sampleRate);
    for (const note of chord) {
      /**
       * 伴奏垫：**低八度 + 五度**，但低八度必须很轻。
       *
       * ── 这里的音量分配是实测调出来的，不是随手写的 ──
       * 早先用的是低八度 0.5 / 五度 0.3、整轨归一化到 -12 dB，人声是 -6 dB——
       * 两者只差 6 dB，于是**伴奏里的低八度盖过了人声的基频**。
       * 实测后果：整首歌听起来「所有音都低了一个八度」，而且音高检测（自相关）
       * 会跟着锁到低八度上，表现为大批音「跑调」。
       * 用 Goertzel 分别量 440 与 220 Hz 的能量才定位到：加伴奏后 220 Hz 比 440 还强 1.39 倍。
       *
       * 现在：低八度降到 0.18，五度 0.42（五度是协和音程，可以稍响），
       * 整轨归一化到 -18 dB（比人声低 12 dB）。伴奏只负责"有底"，不抢旋律。
       */
      for (const [semitones, level] of [
        [-12, 0.18],
        [-5, 0.42],
      ] as const) {
        const hz = midiToHz(note.midi + transpose + semitones);
        const amplitude = 0.08 * level;
        const attack = Math.round(sampleRate * 0.02);
        const decay = Math.round(sampleRate * Math.min(barSeconds, 1.2));
        for (let i = 0; i < barFrames; i += 1) {
          const index = startFrame + i;
          if (index >= frames) break;
          // 包络：快起 + 指数衰减
          const envelope = i < attack ? i / attack : Math.exp(-((i - attack) / decay) * 3);
          const time = i / sampleRate;
          const value =
            Math.sin(2 * Math.PI * hz * time) * 1 +
            Math.sin(2 * Math.PI * hz * 2 * time) * 0.35 +
            Math.sin(2 * Math.PI * hz * 3 * time) * 0.15;
          mono[index] = (mono[index] ?? 0) + value * envelope * amplitude;
        }
      }
    }
  }
  const accompaniment = pcm(sampleRate, [mono]);
  fade(accompaniment, 20, 400);
  return normalize(accompaniment, -18 + (options.gainDb ?? 0));
}

/**
 * A 档后端：TTS 声线 + 音高校准 + 混音。
 */
export const pitchBackend: SingBackend = {
  name: 'pitch',
  description: 'TTS 声线 + 自相关测音高 + 重采样校准 + 颤音 + 混音（不需要 GPU）',
  async render(score, source, options) {
    const mix = options.mix;
    if (mix === undefined) {
      return { ok: false, reason: 'missing-mix-config', message: '没有混音配置（sing.mix）' };
    }
    const transposeSemitones = options.transpose ?? 0;
    const beat = secondsPerBeat(score);
    const cache = new Map<string, Pcm>();
    const total = score.notes.length;
    const tuning: Array<{ index: number; targetHz: number; measuredHz?: number; sungHz: number; clamped?: boolean }> = [];
    const rendered: Array<{ start: number; samples: Float32Array }> = [];

    for (const [index, note] of score.notes.entries()) {
      const targetSeconds = Math.max(0.06, note.dur * beat);
      const result = await renderNote(note, source, targetSeconds, {
        transpose: transposeSemitones,
        vibratoDepth: options.vibratoDepth ?? 0.12,
        vibratoRate: options.vibratoRate ?? 5.5,
        cache,
      });
      if (!result.ok) return result;
      rendered.push({ start: note.start * beat, samples: result.audio });
      tuning.push({
        index,
        targetHz: midiToHz(note.midi + transposeSemitones),
        ...(result.measuredHz === undefined ? {} : { measuredHz: result.measuredHz }),
        sungHz: result.sungHz,
        ...(result.clamped === true ? { clamped: true } : {}),
      });
      options.onProgress?.(index + 1, total);
    }

    // 有音因为「移调超出两个八度」被放弃校准时，必须说出来——
    // 那种音在听感上会明显掉下去，不报出来就会被当成「随机跑调」
    const clampedCount = tuning.filter((item) => item.clamped === true).length;
    if (clampedCount > 0) {
      const detail = tuning
        .filter((item) => item.clamped === true)
        .slice(0, 5)
        .map((item) => `#${item.index}(目标 ${item.targetHz.toFixed(0)}Hz/实测 ${(item.measuredHz ?? 0).toFixed(0)}Hz)`)
        .join(' ');
      console.warn(
        `[sing] ${clampedCount} 个音的音高差距超过两个八度，已放弃校准（会听起来偏低/偏高）：${detail}` +
          '。常见原因：TTS 念这个字时基频特别低（清音/气声），或谱面音高超出人声范围。',
      );
    }

    // 铺到时间轴上
    const totalSeconds = (score.notes.reduce((max, n) => Math.max(max, n.start + n.dur), 0) + 0.2) * beat;
    const frames = Math.max(1, Math.round(totalSeconds * OUTPUT_RATE));
    const vocal = new Float32Array(frames);
    for (const note of rendered) {
      const offset = Math.round(note.start * OUTPUT_RATE);
      const n = Math.min(note.samples.length, frames - offset);
      for (let i = 0; i < n; i += 1) vocal[offset + i] = (vocal[offset + i] ?? 0) + (note.samples[i] ?? 0);
    }
    const vocalPcm = pcm(OUTPUT_RATE, [vocal]);
    highpass(vocalPcm, 70);
    normalize(vocalPcm, -6);

    // 混音链
    const mixed = mixVocal(vocalPcm, mix);
    let audio = mixed.audio;

    // 伴奏（可选）
    if (options.accompaniment !== false) {
      const accompaniment = renderAccompaniment(score, { transpose: transposeSemitones });
      audio = mixDown(
        [
          { audio, gainDb: 0 },
          { audio: accompaniment, gainDb: options.accompanimentDb ?? 0 },
        ],
        mix.limiterCeilingDb,
      );
    }

    /**
     * 不再额外叠「高八度跟唱」。
     *
     * 原来这里有一层 `addHarmony(audio, 12, harmonyGain * 0.35, 1)`，本意是"像有人跟唱"。
     * 但它叠加在 mixVocal 已经做过的和声层之上，等于给成品又来一遍八度复制。
     * 八度复制的听觉副作用很直接：音高感会往低的那层塌（实测用 Goertzel 量，
     * 低八度能量能追平甚至超过主频），听起来就是"整首歌低了一个八度"。
     *
     * 想加和声就调 sing.mix 的 harmonyLayers / harmonySemitones / harmonyGain，
     * 那一条链是可控的、也测得到。在这里偷偷再加一层只会让问题更难查。
     */

    const finalAudio = normalize(audio, -1);
    return {
      ok: true,
      wav: encodeWave(finalAudio),
      audio: finalAudio,
      report: {
        backend: 'pitch',
        duration: finalAudio.channels[0] === undefined ? 0 : finalAudio.channels[0].length / finalAudio.sampleRate,
        notes: total,
        tuning,
      },
    };
  },
};

/**
 * B 档占位（DiffSinger / OpenUtau 音源库）。
 *
 * 接口已经留好，实现时要做的事写在这里，避免以后重新研究一遍：
 * 1. 音源库（voicebank）目录结构按 DiffSinger 的 `dsdict.json` 读；
 * 2. 每个音对应的拼音/音素要从歌词预处理（汉字 → 拼音，需要一份字典）；
 * 3. 合成器是一个独立的 Python/C++ 进程（`diff-svc` / `OpenUtau` CLI），用子进程调用；
 * 4. 输出 wav 后回到本文件的混音链（`mixVocal`）。
 */
export const diffsingerBackend: SingBackend = {
  name: 'diffsinger',
  description: 'DiffSinger 音源库（B 档，需要 GPU 或 4C8G 以上的机器）',
  async render(_score, _source, options) {
    return {
      ok: false,
      reason: 'backend-not-implemented',
      message:
        'DiffSinger 后端还没实现。需要：① sing.voicebankDir 指向音源库 ② 安装合成器（Python）' +
        `③ 汉字转拼音的字典。当前 voicebankDir=${JSON.stringify(options.voicebankDir ?? '')}。` +
        '现在可以先切回 sing.backend = "pitch" 用 A 档。',
    };
  },
};

/**
 * C 档占位（RVC 变声翻唱）。
 *
 * 实现要点（写在这里省得以后重查）：
 * 1. `rvcModel` 指向 `.pth`，还要配套的 `index` 文件；
 * 2. 要一个 GPU（或 CPU 慢速模式，一首 30 秒的歌要跑几分钟）；
 * 3. 输入是「音频文件路径」，输出也是音频文件，中间靠 ffmpeg 转码；
 * 4. 与 A 档组合更自然：A 档先唱出来，再用 RVC 换成她自己的音色。
 */
export const rvcBackend: SingBackend = {
  name: 'rvc',
  description: 'RVC 声音克隆翻唱（C 档，需要 GPU）',
  async render(_score, _source, options) {
    return {
      ok: false,
      reason: 'backend-not-implemented',
      message:
        'RVC 后端还没实现。需要：① sing.rvcModel 指向 .pth ② 配套 index 文件 ③ GPU（或接受很慢的 CPU 模式）' +
        `④ Python 环境里的 rvc 依赖。当前 rvcModel=${JSON.stringify(options.rvcModel ?? '')}。` +
        '提示：最自然的做法是先用 sing.backend = "pitch" 唱出来，再用 RVC 换音色。',
    };
  },
};

/** 已注册的后端 */
export const BACKENDS: Record<string, SingBackend> = {
  pitch: pitchBackend,
  diffsinger: diffsingerBackend,
  rvc: rvcBackend,
};

/** 按名字取后端；未知名字返回 pitch 并带上提示 */
export function resolveBackend(name: string): { backend: SingBackend; warning?: string } {
  const found = BACKENDS[name];
  if (found !== undefined) return { backend: found };
  return {
    backend: pitchBackend,
    warning: `未知的唱歌后端 ${JSON.stringify(name)}，已回退到 pitch（A 档）`,
  };
}

/** 音准诊断：把报告里偏差超过 50 音分的挑出来（面板与日志用） */
export function outOfTune(report: Array<{ targetHz: number; sungHz: number }>): Array<{ targetHz: number; sungHz: number; cents: number }> {
  const result: Array<{ targetHz: number; sungHz: number; cents: number }> = [];
  for (const item of report) {
    if (item.targetHz <= 0 || item.sungHz <= 0) continue;
    const cents = 1200 * Math.log2(item.sungHz / item.targetHz);
    if (Math.abs(cents) > 50) result.push({ ...item, cents });
  }
  return result;
}
