/**
 * DSP 原语：增益、淡入淡出、重采样后的标准化、简单变调、和声。
 *
 * 这些函数都只碰 Float32Array，不碰文件、不碰网络，方便在测试里逐条验。
 * 全部**原地处理或返回新数组**，调用方自己决定要不要保留原始波形。
 */

import type { Pcm } from './wav';

/** dB → 线性增益 */
export function dbToGain(db: number): number {
  return Math.pow(10, db / 20);
}

/** 线性增益 → dB（0 返回 -Infinity） */
export function gainToDb(gain: number): number {
  return gain <= 0 ? Number.NEGATIVE_INFINITY : 20 * Math.log10(gain);
}

/** 半音 → 频率比 */
export function semitoneRatio(semitones: number): number {
  return Math.pow(2, semitones / 12);
}

/** 整段乘增益（原地） */
export function applyGain(pcmData: Pcm, gain: number): Pcm {
  if (gain === 1) return pcmData;
  for (const ch of pcmData.channels) {
    for (let i = 0; i < ch.length; i += 1) ch[i] = (ch[i] ?? 0) * gain;
  }
  return pcmData;
}

/** 峰值（所有声道） */
export function peak(pcmData: Pcm): number {
  let max = 0;
  for (const ch of pcmData.channels) {
    for (let i = 0; i < ch.length; i += 1) {
      const v = Math.abs(ch[i] ?? 0);
      if (v > max) max = v;
    }
  }
  return max;
}

/** RMS（所有声道合起来的有效值） */
export function rms(pcmData: Pcm): number {
  let sum = 0;
  let count = 0;
  for (const ch of pcmData.channels) {
    for (let i = 0; i < ch.length; i += 1) {
      const v = ch[i] ?? 0;
      sum += v * v;
      count += 1;
    }
  }
  return count === 0 ? 0 : Math.sqrt(sum / count);
}

/**
 * 把峰值归一到目标（默认 -1 dBFS）。
 * 用于「合成出来的波形幅度不确定」的场合（重采样移调后长度/幅度都会变）。
 */
export function normalize(pcmData: Pcm, targetDb = -1): Pcm {
  const current = peak(pcmData);
  if (current <= 0) return pcmData;
  return applyGain(pcmData, dbToGain(targetDb) / current);
}

/**
 * 淡入 / 淡出（毫秒）。原地。
 *
 * 为什么必须有：任何一段拼接或截断的波形，边界处突然出现的非零值就是**爆音**
 * （click）。混音与移调之后更是必然出现，所以每次拼接都要过一遍。
 */
export function fade(pcmData: Pcm, fadeInMs = 8, fadeOutMs = 8): Pcm {
  const { sampleRate } = pcmData;
  const inSamples = Math.max(0, Math.round((fadeInMs / 1000) * sampleRate));
  const outSamples = Math.max(0, Math.round((fadeOutMs / 1000) * sampleRate));
  for (const ch of pcmData.channels) {
    if (inSamples > 0) {
      const n = Math.min(inSamples, ch.length);
      for (let i = 0; i < n; i += 1) ch[i] = (ch[i] ?? 0) * (i / n);
    }
    if (outSamples > 0) {
      const n = Math.min(outSamples, ch.length);
      for (let i = 0; i < n; i += 1) {
        const index = ch.length - 1 - i;
        ch[index] = (ch[index] ?? 0) * (i / n);
      }
    }
  }
  return pcmData;
}

/**
 * 变调（也变速度）：按半音比值重采样。
 *
 * ── 这是 A 档唱歌的核心，也必须是诚实的 ──
 * 变调同时改变了时长（升调会变短、降调会变长），这是物理规律，不是 bug。
 * 真正的「只变调不变速」需要相位声码器或 PSOLA，那是 B 档（音源库）要解决的问题。
 * 对唱歌来说这个副作用反而是特色——音高本来就和节奏绑在一起。
 */
export function transpose(pcmData: Pcm, semitones: number): Pcm {
  if (semitones === 0) return pcmData;
  const ratio = semitoneRatio(semitones);
  return {
    sampleRate: pcmData.sampleRate,
    // 上采样到新时长：把每个采样按比例拉伸，等于降低播放速度（> 1）或提高（< 1）
    channels: pcmData.channels.map((ch) => {
      const outLength = Math.max(1, Math.round(ch.length / ratio));
      const out = new Float32Array(outLength);
      for (let i = 0; i < outLength; i += 1) {
        const pos = i * ratio;
        const i0 = Math.floor(pos);
        const frac = pos - i0;
        const s0 = ch[i0] ?? 0;
        const s1 = ch[i0 + 1] ?? s0;
        out[i] = s0 + (s1 - s0) * frac;
      }
      return out;
    }),
  };
}

/**
 * 和声层：把原波形按半音移调后混回去。
 *
 * @param source 原波形（不会被修改）
 * @param semitones 和声音高（相对主唱）
 * @param gain 和声音量（0~1）
 * @param layers 层数（每层稍微左右错开，避免完全同相变成单纯变响）
 * @returns 混合后的新波形（长度取两者最长）
 */
export function addHarmony(source: Pcm, semitones: number, gain: number, layers = 1): Pcm {
  const count = Math.max(0, Math.floor(layers));
  if (count === 0 || gain <= 0) return source;
  const output: Pcm = {
    sampleRate: source.sampleRate,
    channels: source.channels.map((ch) => new Float32Array(ch)),
  };
  for (let layer = 0; layer < count; layer += 1) {
    // 每一层音高略微偏移（±0.05 半音），避免叠加后听起来像一个人录了两遍完全一样的
    const offset = (layer - (count - 1) / 2) * 0.05;
    const shifted = transpose(source, semitones + offset);
    const weight = gain / Math.max(1, Math.sqrt(count));
    for (let ch = 0; ch < output.channels.length; ch += 1) {
      const target = output.channels[ch];
      const from = shifted.channels[ch] ?? shifted.channels[0];
      if (target === undefined || from === undefined) continue;
      const n = Math.min(target.length, from.length);
      for (let i = 0; i < n; i += 1) target[i] = (target[i] ?? 0) + (from[i] ?? 0) * weight;
    }
  }
  return output;
}

/**
 * 简单的噪声门：低于门限的部分按比例压掉（不是硬切，硬切会一顿一顿的）。
 * 用于清掉 TTS 合成音在句间的底噪，混响前尤其需要——底噪会被混响放大成一团。
 */
export function noiseGate(pcmData: Pcm, thresholdDb = -50, ratio = 0.15): Pcm {
  const threshold = dbToGain(thresholdDb);
  for (const ch of pcmData.channels) {
    for (let i = 0; i < ch.length; i += 1) {
      const v = ch[i] ?? 0;
      if (Math.abs(v) < threshold) ch[i] = v * ratio;
    }
  }
  return pcmData;
}

/** 单极点低通（用于做「闷一点」的音色或防刺耳） */
export function lowpass(pcmData: Pcm, cutoffHz: number): Pcm {
  const rc = 1 / (2 * Math.PI * Math.max(20, cutoffHz));
  const dt = 1 / pcmData.sampleRate;
  const alpha = dt / (rc + dt);
  for (const ch of pcmData.channels) {
    let previous = 0;
    for (let i = 0; i < ch.length; i += 1) {
      previous += alpha * ((ch[i] ?? 0) - previous);
      ch[i] = previous;
    }
  }
  return pcmData;
}

/** 单极点高通（切掉低频隆隆声；唱歌前必备） */
export function highpass(pcmData: Pcm, cutoffHz: number): Pcm {
  if (cutoffHz <= 0) return pcmData;
  const rc = 1 / (2 * Math.PI * cutoffHz);
  const dt = 1 / pcmData.sampleRate;
  const alpha = rc / (rc + dt);
  for (const ch of pcmData.channels) {
    let previousInput = 0;
    let previousOutput = 0;
    for (let i = 0; i < ch.length; i += 1) {
      const input = ch[i] ?? 0;
      previousOutput = alpha * (previousOutput + input - previousInput);
      previousInput = input;
      ch[i] = previousOutput;
    }
  }
  return pcmData;
}

/** 截取一段（毫秒） */
export function slice(pcmData: Pcm, startMs: number, endMs: number): Pcm {
  const start = Math.max(0, Math.round((startMs / 1000) * pcmData.sampleRate));
  const end = Math.max(start, Math.round((endMs / 1000) * pcmData.sampleRate));
  return {
    sampleRate: pcmData.sampleRate,
    channels: pcmData.channels.map((ch) => ch.subarray(start, Math.min(end, ch.length))),
  };
}
