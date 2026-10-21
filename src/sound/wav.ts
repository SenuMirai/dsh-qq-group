/**
 * PCM / WAV 的读、写、重采样（纯 TS，不依赖任何原生模块）。
 *
 * ── 为什么自己写 ──
 * 1. 宿主侧产物是 ESM 且外部化 `node:` 前缀之外的一切，加原生音频依赖既难装又难交叉编译；
 * 2. 云端镜像只装 node + python + ffmpeg，不该再多一个 C++ 编译链；
 * 3. WAV 是最笨的格式：44 字节头 + 交错 PCM。自己写比引入一个库更可控。
 *
 * ── 与 docs/VOICE.md 的关系 ──
 * 语音链路的 WAV 是**严格 44 字节头、16k 单声道**（DSH 的 SenseVoice 只认那个）。
 * 这里是为了**音乐**服务的：任意采样率、单/双声道、32 位浮点内部表示。
 * 两者不要混用——所以本文件不做「校验」，只做宽松解析（能读多少读多少）。
 */

/** 内部音频表示：每个声道一条 Float32 波形，取值 [-1, 1] */
export interface Pcm {
  /** 采样率（Hz） */
  sampleRate: number;
  /** 声道数据（1 或 2 条） */
  channels: Float32Array[];
}

/** 解析失败的结构化原因（不抛异常，调用方要能自己决定怎么报） */
export type WaveParseResult = { ok: true; pcm: Pcm } | { ok: false; reason: string };

/** 一条声道波形（单声道时 channels.length === 1） */
export function pcm(sampleRate: number, channels: Float32Array[]): Pcm {
  return { sampleRate, channels };
}

/** 静音 */
export function silence(sampleRate: number, seconds: number, channelCount = 1): Pcm {
  const frames = Math.max(0, Math.round(seconds * sampleRate));
  return pcm(
    sampleRate,
    Array.from({ length: channelCount }, () => new Float32Array(frames)),
  );
}

/** 时长（秒，按最长声道算） */
export function duration(pcmData: Pcm): number {
  const longest = pcmData.channels.reduce((max, ch) => Math.max(max, ch.length), 0);
  return longest / pcmData.sampleRate;
}

/**
 * 解析 WAV（支持 PCM 8/16/24/32 位与 IEEE float 32/64 位）。
 *
 * **不假设 data 块在偏移 36**：ffmpeg 等工具会插入 LIST/INFO 块，
 * 严格按偏移读会把元数据当采样（docs/VOICE.md 里记过同一个坑）。
 * 这里逐块遍历，遇到未知块就按长度跳过。
 */
export function parseWave(bytes: Uint8Array): WaveParseResult {
  if (bytes.length < 12) return { ok: false, reason: '文件太短，不是 WAV' };
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const riff = readAscii(bytes, 0, 4);
  const wave = readAscii(bytes, 8, 4);
  if (riff !== 'RIFF' || wave !== 'WAVE') {
    return { ok: false, reason: `不是 RIFF/WAVE（读到 ${JSON.stringify(riff)}/${JSON.stringify(wave)}）` };
  }

  let offset = 12;
  let format = 0;
  let channelCount = 0;
  let sampleRate = 0;
  let bitsPerSample = 0;
  let dataStart = -1;
  let dataLength = 0;

  while (offset + 8 <= bytes.length) {
    const id = readAscii(bytes, offset, 4);
    const size = view.getUint32(offset + 4, true);
    const body = offset + 8;
    if (id === 'fmt ') {
      if (size < 16 || body + 16 > bytes.length) return { ok: false, reason: 'fmt 块不完整' };
      format = view.getUint16(body, true);
      channelCount = view.getUint16(body + 2, true);
      sampleRate = view.getUint32(body + 4, true);
      bitsPerSample = view.getUint16(body + 14, true);
    } else if (id === 'data') {
      dataStart = body;
      // 有些流写入器把长度写成 0 或 0xFFFFFFFF：按实际剩余长度兜底
      dataLength = size === 0 || body + size > bytes.length ? bytes.length - body : size;
    }
    // 4 字节对齐：奇数长度的块后面有 1 字节填充
    offset = body + size + (size % 2);
  }

  if (dataStart < 0) return { ok: false, reason: '没有 data 块' };
  if (channelCount <= 0) return { ok: false, reason: 'fmt 块里声道数为 0' };
  if (sampleRate <= 0) return { ok: false, reason: 'fmt 块里采样率为 0' };

  const bytesPerSample = Math.max(1, Math.floor(bitsPerSample / 8));
  const frameBytes = bytesPerSample * channelCount;
  const frames = Math.floor(dataLength / frameBytes);
  if (frames <= 0) return { ok: false, reason: 'data 块是空的' };

  const channels = Array.from({ length: channelCount }, () => new Float32Array(frames));
  for (let frame = 0; frame < frames; frame += 1) {
    for (let ch = 0; ch < channelCount; ch += 1) {
      const at = dataStart + frame * frameBytes + ch * bytesPerSample;
      channels[ch][frame] = readSample(view, at, format, bitsPerSample);
    }
  }
  return { ok: true, pcm: { sampleRate, channels } };
}

/** 读一个采样并归一化到 [-1, 1] */
function readSample(view: DataView, at: number, format: number, bits: number): number {
  const isFloat = format === 3;
  switch (bits) {
    case 8:
      // 8 位 WAV 是**无符号**的（128 = 零点），这是个经典陷阱
      return (view.getUint8(at) - 128) / 128;
    case 16:
      return view.getInt16(at, true) / 32768;
    case 24: {
      const b0 = view.getUint8(at);
      const b1 = view.getUint8(at + 1);
      const b2 = view.getUint8(at + 2);
      let value = b0 | (b1 << 8) | (b2 << 16);
      if ((value & 0x800000) !== 0) value -= 0x1000000;
      return value / 8388608;
    }
    case 32:
      return isFloat ? view.getFloat32(at, true) : view.getInt32(at, true) / 2147483648;
    case 64:
      return isFloat ? view.getFloat64(at, true) : view.getInt32(at, true) / 2147483648;
    default:
      return 0;
  }
}

function readAscii(bytes: Uint8Array, at: number, length: number): string {
  let out = '';
  for (let i = 0; i < length; i += 1) {
    const byte = bytes[at + i];
    out += String.fromCharCode(byte === undefined ? 0 : byte);
  }
  return out;
}

/**
 * 编码成 16 位 PCM WAV。
 * @param pcmData 波形
 * @param options.float32 为真时输出 IEEE float32（调试/后续处理用），默认 16 位（QQ 与播放器都认）
 */
export function encodeWave(pcmData: Pcm, options: { float32?: boolean; dither?: boolean } = {}): Uint8Array {
  const channelCount = Math.max(1, pcmData.channels.length);
  const frames = pcmData.channels.reduce((max, ch) => Math.max(max, ch.length), 0);
  const bytesPerSample = options.float32 === true ? 4 : 2;
  const dataBytes = frames * channelCount * bytesPerSample;
  const total = 44 + dataBytes;
  const bytes = new Uint8Array(total);
  const view = new DataView(bytes.buffer);

  writeAscii(bytes, 0, 'RIFF');
  view.setUint32(4, total - 8, true);
  writeAscii(bytes, 8, 'WAVE');
  writeAscii(bytes, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, options.float32 === true ? 3 : 1, true);
  view.setUint16(22, channelCount, true);
  view.setUint32(24, pcmData.sampleRate, true);
  view.setUint32(28, pcmData.sampleRate * channelCount * bytesPerSample, true);
  view.setUint16(32, channelCount * bytesPerSample, true);
  view.setUint16(34, bytesPerSample * 8, true);
  writeAscii(bytes, 36, 'data');
  view.setUint32(40, dataBytes, true);

  let at = 44;
  for (let frame = 0; frame < frames; frame += 1) {
    for (let ch = 0; ch < channelCount; ch += 1) {
      const source = pcmData.channels[ch] ?? pcmData.channels[0];
      const value = source === undefined ? 0 : (source[frame] ?? 0);
      if (options.float32 === true) {
        view.setFloat32(at, value, true);
      } else {
        // 先限幅再量化：超出 ±1 的值直接截断会产生刺耳的方波
        const clipped = value < -1 ? -1 : value > 1 ? 1 : value;
        view.setInt16(at, Math.round(clipped * 32767), true);
      }
      at += bytesPerSample;
    }
  }
  return bytes;
}

function writeAscii(bytes: Uint8Array, at: number, text: string): void {
  for (let i = 0; i < text.length; i += 1) bytes[at + i] = text.charCodeAt(i) & 0xff;
}

/**
 * 线性插值重采样（质量够用，速度快）。
 *
 * 音乐链路最终会走 ffmpeg 做高质量重采样；这里的用途是**内部按半音比值移调**，
 * 那本来就是「故意拉伸」的破坏性操作，插值误差远小于移调本身带来的音色变化。
 */
export function resampleLinear(input: Float32Array, fromRate: number, toRate: number): Float32Array {
  if (fromRate === toRate || input.length === 0) return input;
  const ratio = toRate / fromRate;
  const outLength = Math.max(1, Math.round(input.length * ratio));
  const out = new Float32Array(outLength);
  const step = fromRate / toRate;
  for (let i = 0; i < outLength; i += 1) {
    const pos = i * step;
    const i0 = Math.floor(pos);
    const frac = pos - i0;
    const s0 = input[i0] ?? 0;
    const s1 = input[i0 + 1] ?? s0;
    out[i] = s0 + (s1 - s0) * frac;
  }
  return out;
}

/** 整段重采样（所有声道） */
export function resample(pcmData: Pcm, toRate: number): Pcm {
  if (pcmData.sampleRate === toRate) return pcmData;
  return {
    sampleRate: toRate,
    channels: pcmData.channels.map((ch) => resampleLinear(ch, pcmData.sampleRate, toRate)),
  };
}

/** 单声道 → 立体声（复制） */
export function toStereo(pcmData: Pcm): Pcm {
  if (pcmData.channels.length >= 2) return pcmData;
  const mono = pcmData.channels[0] ?? new Float32Array(0);
  return { sampleRate: pcmData.sampleRate, channels: [mono, new Float32Array(mono)] };
}

/** 立体声 → 单声道（取平均，避免削顶） */
export function toMono(pcmData: Pcm): Pcm {
  if (pcmData.channels.length === 1) return pcmData;
  const frames = pcmData.channels.reduce((max, ch) => Math.max(max, ch.length), 0);
  const out = new Float32Array(frames);
  const scale = 1 / pcmData.channels.length;
  for (const ch of pcmData.channels) {
    for (let i = 0; i < frames; i += 1) out[i] = (out[i] ?? 0) + (ch[i] ?? 0) * scale;
  }
  return { sampleRate: pcmData.sampleRate, channels: [out] };
}

/** 拼接（采样率必须一致；声道数取最大值，少的补零） */
export function concat(parts: Pcm[]): Pcm {
  const usable = parts.filter((p) => p.channels.length > 0);
  if (usable.length === 0) return pcm(44100, [new Float32Array(0)]);
  const sampleRate = usable[0].sampleRate;
  const channelCount = Math.max(...usable.map((p) => p.channels.length));
  const totalFrames = usable.reduce((sum, p) => sum + Math.max(...p.channels.map((c) => c.length)), 0);
  const channels = Array.from({ length: channelCount }, () => new Float32Array(totalFrames));
  let at = 0;
  for (const part of usable) {
    const frames = Math.max(...part.channels.map((c) => c.length));
    for (let ch = 0; ch < channelCount; ch += 1) {
      const source = part.channels[ch] ?? part.channels[0];
      if (source === undefined) continue;
      channels[ch].set(source.subarray(0, frames), at);
    }
    at += frames;
  }
  return { sampleRate, channels };
}

/**
 * 在尾部补一段（用于混响尾巴/淡出），返回新对象。
 * 长度按最长声道算，短的一侧补零。
 */
export function padTail(pcmData: Pcm, seconds: number): Pcm {
  if (seconds <= 0) return pcmData;
  const extra = Math.round(seconds * pcmData.sampleRate);
  return {
    sampleRate: pcmData.sampleRate,
    channels: pcmData.channels.map((ch) => {
      const out = new Float32Array(ch.length + extra);
      out.set(ch);
      return out;
    }),
  };
}
