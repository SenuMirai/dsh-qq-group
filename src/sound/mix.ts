/**
 * 混音链：人声 EQ → 压缩 → 和声 → 混响 → 立体声宽度 → 限幅。
 *
 * ── 顺序为什么是这样 ──
 * 这是人声处理的常规顺序，每一步都有明确理由（反过来做就会出问题）：
 *
 * 1. **高通**最先：先切掉 90 Hz 以下的隆隆声，否则压缩器会被低频触发，
 *    一直在压人声——听起来就是「忽大忽小」。
 * 2. **EQ 提升**在压缩前：把要强调的频段提起来，压缩器会把整体压平，正是想要的「紧」。
 * 3. **压缩**在混响前：混响会把声音拉长，先压缩才不会让混响尾巴也跟着一起被压扁。
 * 4. **和声**在混响前：和声是「另一个声源」，它也应该有混响。
 * 5. **混响**倒数第二：之后只剩宽度与限幅。
 * 6. **限幅**最后：任何处理都可能让峰值超 0 dBFS，最后一步必须兜住，
 *    否则发出去的音频在别的播放器里会削波（刺耳的噼啪声）。
 *
 * ── 一句话参数说明 ──
 * 所有参数都在 `src/qq/config.ts` 的 `MixConfig` 里，全部可在 qq.json 里改，不用改代码。
 */

import type { MixConfig } from '../qq/config';
import { addHarmony, applyGain, dbToGain, fade, highpass, lowpass, normalize, peak, rms } from './dsp';
import { toStereo, type Pcm } from './wav';

/**
 * 一阶搁架式 EQ（简化版）：对某段频率做提升/衰减。
 * @param type 'low' | 'high' —— 低搁架 / 高搁架
 * @param cutoffHz 转折频率
 * @param gainDb 提升量
 */
export function shelf(pcmData: Pcm, type: 'low' | 'high', cutoffHz: number, gainDb: number): Pcm {
  if (gainDb === 0) return pcmData;
  const gain = dbToGain(gainDb);
  const rc = 1 / (2 * Math.PI * cutoffHz);
  const dt = 1 / pcmData.sampleRate;
  const alpha = dt / (rc + dt);
  for (const ch of pcmData.channels) {
    let state = 0;
    for (let i = 0; i < ch.length; i += 1) {
      const input = ch[i] ?? 0;
      state += alpha * (input - state);
      // low 搁架：保留平滑部分并加权；high 搁架：把平滑部分减掉（留下高频）
      ch[i] = type === 'low' ? (ch[i] ?? 0) + (gain - 1) * state : (ch[i] ?? 0) - (gain - 1) * state;
    }
  }
  return pcmData;
}

/**
 * 前馈式压缩器（软拐点、保留起音）。
 *
 * @param thresholdDb 门限：超过这个电平才开始压
 * @param ratio 压缩比（4 = 超过门限的部分只留下 1/4）
 * @param attackMs 起音时间（人声用 10~20 ms，太快会把字头吃掉）
 * @param releaseMs 释放时间（人声用 100~200 ms，太快会「抽气」）
 */
export function compress(
  pcmData: Pcm,
  thresholdDb: number,
  ratio: number,
  attackMs = 15,
  releaseMs = 150,
): Pcm {
  if (ratio <= 1) return pcmData;
  const threshold = dbToGain(thresholdDb);
  const attack = Math.exp(-1 / ((pcmData.sampleRate * attackMs) / 1000));
  const release = Math.exp(-1 / ((pcmData.sampleRate * releaseMs) / 1000));
  // 用所有声道的联合包络：分开压会让立体声像「左右跳」
  const frames = pcmData.channels.reduce((max, ch) => Math.max(max, ch.length), 0);
  const envelope = new Float32Array(frames);
  let level = 0;
  for (let i = 0; i < frames; i += 1) {
    let sample = 0;
    for (const ch of pcmData.channels) {
      const v = Math.abs(ch[i] ?? 0);
      if (v > sample) sample = v;
    }
    const coefficient = sample > level ? attack : release;
    level = sample + (level - sample) * coefficient;
    envelope[i] = level;
  }
  for (const ch of pcmData.channels) {
    for (let i = 0; i < ch.length; i += 1) {
      const level2 = envelope[i] ?? 0;
      if (level2 <= threshold || level2 <= 0) continue;
      // 超过门限的部分按比例缩：gain = (threshold / level) ^ (1 - 1/ratio)
      const gain = Math.pow(threshold / level2, 1 - 1 / ratio);
      ch[i] = (ch[i] ?? 0) * gain;
    }
  }
  return pcmData;
}

/**
 * 混响（Schroeder 结构：4 个并联梳状 + 2 个串联全通）。
 *
 * 为什么不用卷积混响：那需要一份 IR 文件，体积和许可都是问题；
 * Schroeder 是纯算法，延迟低、参数直观（衰减时间直接就是秒数），对唱歌够用。
 *
 * @param wet 湿声比例（0 = 干声，1 = 全是混响）
 * @param decaySeconds T60
 * @param preDelayMs 预延迟：让干声先出来，空间感更真实
 */
export function reverb(pcmData: Pcm, wet: number, decaySeconds: number, preDelayMs = 20): Pcm {
  if (wet <= 0 || decaySeconds <= 0) return pcmData;
  const stereo = toStereo(pcmData);
  const sampleRate = stereo.sampleRate;
  const preDelay = Math.max(1, Math.round((preDelayMs / 1000) * sampleRate));
  // 梳状延迟（互质，避免梳状峰叠加在同一点）
  const combs = [1557, 1617, 1491, 1422];
  const allpasses = [225, 556];

  const outputChannels = stereo.channels.map((dry, channelIndex) => {
    const frames = dry.length + preDelay + Math.round(decaySeconds * sampleRate * 0.6);
    const wetSignal = new Float32Array(frames);

    for (const [combIndex, combDelay] of combs.entries()) {
      // 每个声道用略微不同的延迟，才能有立体声空间感
      const delay = combDelay + (channelIndex === 1 ? 23 : 0) + combIndex * 7;
      const feedback = Math.pow(10, (-3 * delay) / (decaySeconds * sampleRate));
      const buffer = new Float32Array(delay);
      let index = 0;
      for (let i = 0; i < frames; i += 1) {
        const drySample = dry[i - preDelay] ?? 0;
        const delayed = buffer[index] ?? 0;
        buffer[index] = drySample * 0.25 + delayed * feedback;
        wetSignal[i] = (wetSignal[i] ?? 0) + delayed * 0.25;
        index = (index + 1) % delay;
      }
    }

    for (const apDelay of allpasses) {
      const buffer = new Float32Array(apDelay);
      let index = 0;
      const feedback = 0.5;
      for (let i = 0; i < frames; i += 1) {
        const input = wetSignal[i] ?? 0;
        const buffered = buffer[index] ?? 0;
        const outputSample = -input + buffered;
        buffer[index] = input + buffered * feedback;
        wetSignal[i] = outputSample;
        index = (index + 1) % apDelay;
      }
    }

    // 干湿混合
    const mixed = new Float32Array(frames);
    for (let i = 0; i < frames; i += 1) {
      mixed[i] = (dry[i] ?? 0) * (1 - wet * 0.4) + (wetSignal[i] ?? 0) * wet;
    }
    return mixed;
  });

  return { sampleRate, channels: outputChannels };
}

/**
 * 立体声宽度（Mid/Side）。
 * @param width 0 = 完全单声道，1 = 原样，2 = 加宽
 */
export function widen(pcmData: Pcm, width: number): Pcm {
  const stereo = toStereo(pcmData);
  if (width === 1) return stereo;
  const [left, right] = stereo.channels;
  if (left === undefined || right === undefined) return stereo;
  const frames = Math.min(left.length, right.length);
  for (let i = 0; i < frames; i += 1) {
    const l = left[i] ?? 0;
    const r = right[i] ?? 0;
    const mid = (l + r) / 2;
    const side = (l - r) / 2;
    const widened = side * Math.max(0, width);
    left[i] = mid + widened;
    right[i] = mid - widened;
  }
  return stereo;
}

/**
 * 限幅器：把超过天花板的样本压到天花板以下。
 *
 * 用「软拐点 + 平滑释放」而不是硬截断：硬截断会在波形上造出方波，
 * 听起来是刺耳的噼啪声（而且频谱上到处是伪造谐波）。
 */
export function limit(pcmData: Pcm, ceilingDb = -1): Pcm {
  const ceiling = dbToGain(ceilingDb);
  const release = Math.exp(-1 / ((pcmData.sampleRate * 80) / 1000));
  let envelope = 0;
  const frames = pcmData.channels.reduce((max, ch) => Math.max(max, ch.length), 0);
  const gains = new Float32Array(frames);
  for (let i = 0; i < frames; i += 1) {
    let sample = 0;
    for (const ch of pcmData.channels) {
      const v = Math.abs(ch[i] ?? 0);
      if (v > sample) sample = v;
    }
    const allowed = sample > ceiling ? ceiling / sample : 1;
    envelope = allowed < envelope ? allowed : allowed + (envelope - allowed) * release;
    gains[i] = envelope;
  }
  for (const ch of pcmData.channels) {
    for (let i = 0; i < ch.length; i += 1) ch[i] = (ch[i] ?? 0) * (gains[i] ?? 1);
  }
  return pcmData;
}

/** 处理链的执行结果（带诊断数据，用于面板与测试断言） */
export interface MixReport {
  inputPeak: number;
  outputPeak: number;
  inputRms: number;
  outputRms: number;
  /** 处理后的时长（秒） */
  duration: number;
}

/**
 * 跑完整条人声链。
 *
 * @param vocal 干声（单声道或立体声都行，内部会转立体声）
 * @param config 混音参数
 * @returns 处理后的波形与诊断数据
 */
export function mixVocal(vocal: Pcm, config: MixConfig): { audio: Pcm; report: MixReport } {
  const inputPeak = peak(vocal);
  const inputRms = rms(vocal);

  // 深拷贝：调用方的原始波形要保持干净（重复混音时不能越叠越糊）
  let audio: Pcm = {
    sampleRate: vocal.sampleRate,
    channels: vocal.channels.map((ch) => new Float32Array(ch)),
  };

  // 1. 高通 + 噪声门
  highpass(audio, config.highpassHz);

  // 2. EQ
  shelf(audio, 'low', 250, -config.presenceDb * 0.25);
  shelf(audio, 'high', 2400, config.presenceDb);
  shelf(audio, 'high', 9000, config.airDb);

  // 3. 压缩
  compress(audio, config.compressThresholdDb, config.compressRatio, 15, 160);

  // 4. 和声（可选）
  if (config.harmonyLayers > 0 && config.harmonyGain > 0) {
    audio = addHarmony(audio, config.harmonySemitones, config.harmonyGain, config.harmonyLayers);
  }

  // 5. 混响
  audio = reverb(audio, config.reverbWet, config.reverbDecay, config.reverbPreDelayMs);

  // 6. 立体声宽度
  audio = widen(audio, config.stereoWidth);

  // 7. 总增益 + 限幅
  applyGain(audio, dbToGain(config.gainDb));
  limit(audio, config.limiterCeilingDb);

  // 8. 边界淡入淡出（防爆音）+ 归一
  fade(audio, 12, 40);
  const outputPeak = peak(audio);
  if (outputPeak < dbToGain(-24)) {
    // 太小了：提到 -3 dBFS（说明前面的环节把它压没了，也说明参数可能过头了）
    normalize(audio, -3);
  }

  return {
    audio,
    report: {
      inputPeak,
      outputPeak: peak(audio),
      inputRms,
      outputRms: rms(audio),
      duration: audio.channels[0] === undefined ? 0 : audio.channels[0].length / audio.sampleRate,
    },
  };
}

/**
 * 两段混音（比如人声 + 伴奏）。
 *
 * @param stems 各轨；`gainDb` 控制各轨音量
 * @param ceilingDb 最终限幅天花板
 */
export function mixDown(
  stems: Array<{ audio: Pcm; gainDb?: number }>,
  ceilingDb = -1,
): Pcm {
  const usable = stems.filter((stem) => stem.audio.channels.length > 0);
  if (usable.length === 0) return { sampleRate: 44100, channels: [new Float32Array(0)] };
  const sampleRate = usable[0].audio.sampleRate;
  const stereo = usable.map((stem) => toStereo(stem.audio));
  const frames = stereo.reduce((max, audio) => Math.max(max, ...audio.channels.map((c) => c.length)), 0);
  const left = new Float32Array(frames);
  const right = new Float32Array(frames);
  const targets = [left, right];

  for (const [index, stem] of usable.entries()) {
    const audio = stereo[index];
    if (audio === undefined) continue;
    const gain = dbToGain(stem.gainDb ?? 0);
    for (let ch = 0; ch < 2; ch += 1) {
      const source = audio.channels[ch] ?? audio.channels[0];
      const target = targets[ch];
      if (source === undefined || target === undefined) continue;
      const n = Math.min(source.length, target.length);
      for (let i = 0; i < n; i += 1) target[i] = (target[i] ?? 0) + (source[i] ?? 0) * gain;
    }
  }

  const mixed: Pcm = { sampleRate, channels: [left, right] };
  limit(mixed, ceilingDb);
  return mixed;
}

/** 低通滤出「闷一点的伴奏感」（没人声时用来垫底） */
export function soften(pcmData: Pcm, cutoffHz = 1200): Pcm {
  return lowpass(pcmData, cutoffHz);
}
