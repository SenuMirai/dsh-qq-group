/**
 * QQ 链路的语音合成：edge-tts（复用宿主现有的常驻 worker）+ 缓存 + MP3 → PCM。
 *
 * ── 为什么要有缓存 ──
 * 群里同一句「哈哈哈」一天可能要合成十几次，edge-tts 每次 1 秒多，还依赖微软服务器。
 * 按 (文本, 音色, 语速, 音高, 音量) 做 sha1 缓存，命中时 0 网络、0 延迟。
 * 缓存有上限（默认 400 条 / 200 MB），按最后访问时间淘汰——不设上限迟早把云盘吃满。
 *
 * ── 为什么 MP3 要解码 ──
 * 唱歌链路要拿到**波形**才能移调、和声、混响。edge-tts 只给 MP3。
 * 这里用 ffmpeg（云端镜像必装）转成 44.1 kHz 立体声 WAV 再解析——
 * 自己写 MP3 解码器是另一个量级的工作，而 ffmpeg 是这类处理的标准工具。
 */

import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, unlinkSync, utimesSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

import { synthesize as hostSynthesize, type TtsResult } from '../voice';
import { encodeWave, parseWave, type Pcm } from './wav';

/** TTS 合成参数 */
export interface SpeakOptions {
  voice?: string;
  rate?: string;
  pitch?: string;
  volume?: string;
  /** edge = 内置；gpt-sovits = 本地 HTTP 网关 */
  provider?: 'edge' | 'gpt-sovits';
  /** 本地 TTS 网关地址 */
  endpoint?: string;
  /** 情感/语气/风格描述（本地网关使用） */
  style?: string;
  /** GPT-SoVITS 音高偏移（半音） */
  pitchSemitones?: number;
  /** GPT-SoVITS 语速倍率 */
  speed?: number;
  /** 跳过缓存（调试用） */
  noCache?: boolean;
}

/** 合成失败（与宿主的 TtsFailure 同构，另加 ffmpeg 相关） */
export type SpeakFailure = {
  ok: false;
  reason: 'python-missing' | 'edge-tts-missing' | 'empty-text' | 'timeout' | 'worker-dead' | 'error' | 'ffmpeg-missing' | 'decode-failed';
  message: string;
};

/** 合成成功：既有原始 MP3，也有解码后的波形 */
export type SpeakResult = { ok: true; mp3: Uint8Array; pcm: Pcm; cached: boolean } | SpeakFailure;

/** 缓存配置 */
export interface CacheOptions {
  dir: string;
  /** 最多几条 */
  maxEntries?: number;
  /** 最多多少字节 */
  maxBytes?: number;
}

/** 默认上限 */
export const DEFAULT_CACHE_ENTRIES = 400;
export const DEFAULT_CACHE_BYTES = 200 * 1024 * 1024;

/** 缓存键：参数不同就是不同的音频，必须全进哈希 */
export function cacheKey(text: string, options: SpeakOptions): string {
  const material = [text, options.voice ?? '', options.rate ?? '', options.pitch ?? '', options.volume ?? '', options.provider ?? 'edge', options.style ?? '', String(options.pitchSemitones ?? ''), String(options.speed ?? '')].join('\u0001');
  return createHash('sha1').update(material, 'utf8').digest('hex');
}

/** 找 ffmpeg：PATH 优先，其次常见安装位置；都找不到返回 undefined（调用方报明确错误） */
export function resolveFfmpeg(configured?: string): string | undefined {
  if (configured !== undefined && configured.trim() !== '') return configured.trim();
  if (process.env.FFMPEG_PATH !== undefined && process.env.FFMPEG_PATH !== '') return process.env.FFMPEG_PATH;
  const binary = process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg';
  // PATH 上直接试试能不能跑（不猜安装路径：猜错了反而更难查）
  return binary;
}

/**
 * 用 ffmpeg 把任意音频转成 44.1 kHz 立体声 16 位 WAV，再解析成波形。
 *
 * @param input 音频字节
 * @param ffmpeg 可执行文件名或绝对路径
 */
export async function decodeWithFfmpeg(
  input: Uint8Array,
  ffmpeg = 'ffmpeg',
  filters: string[] = [],
): Promise<{ ok: true; pcm: Pcm } | SpeakFailure> {
  const args = [
    ...(filters.length > 0 ? ['-af', filters.join(',')] : []),
    '-f',
    'wav',
    '-acodec',
    'pcm_s16le',
    '-ar',
    '44100',
    '-ac',
    '2',
  ];
  const wav = await runFfmpeg(input, ffmpeg, args);
  if (!wav.ok) return wav;
  const parsed = parseWave(wav.bytes);
  if (!parsed.ok) return { ok: false, reason: 'decode-failed', message: `ffmpeg 输出不是合法 WAV：${parsed.reason}` };
  return { ok: true, pcm: parsed.pcm };
}

/** 跑一次 ffmpeg：stdin 喂输入，stdout 收输出 */
function runFfmpeg(
  input: Uint8Array,
  ffmpeg: string,
  args: string[],
): Promise<{ ok: true; bytes: Uint8Array } | SpeakFailure> {
  return new Promise((resolve) => {
    let child;
    try {
      child = spawn(ffmpeg, ['-hide_banner', '-loglevel', 'error', '-i', 'pipe:0', ...args, 'pipe:1'], {
        stdio: ['pipe', 'pipe', 'pipe'],
        windowsHide: true,
      });
    } catch (e) {
      resolve({ ok: false, reason: 'ffmpeg-missing', message: `启动 ffmpeg 失败：${e instanceof Error ? e.message : String(e)}` });
      return;
    }

    const chunks: Buffer[] = [];
    const errors: Buffer[] = [];
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      child.kill();
      resolve({ ok: false, reason: 'timeout', message: 'ffmpeg 转码超时（60 秒）' });
    }, 60_000);

    child.on('error', (error: NodeJS.ErrnoException) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(
        error.code === 'ENOENT'
          ? { ok: false, reason: 'ffmpeg-missing', message: `找不到 ffmpeg（${ffmpeg}）。云上请 apt install ffmpeg` }
          : { ok: false, reason: 'decode-failed', message: `ffmpeg 启动失败：${error.message}` },
      );
    });
    child.stdout.on('data', (chunk: Buffer) => chunks.push(chunk));
    child.stderr.on('data', (chunk: Buffer) => errors.push(chunk));
    child.on('close', (code: number | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (code !== 0) {
        resolve({
          ok: false,
          reason: 'decode-failed',
          message: `ffmpeg 退出码 ${code}：${Buffer.concat(errors).toString('utf8').slice(0, 400)}`,
        });
        return;
      }
      const bytes = new Uint8Array(Buffer.concat(chunks));
      if (bytes.length === 0) {
        resolve({ ok: false, reason: 'decode-failed', message: 'ffmpeg 没有输出' });
        return;
      }
      resolve({ ok: true, bytes });
    });

    try {
      child.stdin.end(Buffer.from(input));
    } catch (e) {
      if (!settled) {
        settled = true;
        clearTimeout(timer);
        resolve({ ok: false, reason: 'decode-failed', message: e instanceof Error ? e.message : String(e) });
      }
    }
  });
}

/**
 * 转成 QQ 语音（silk）前的一步：把波形写成 WAV 文件，交给 NapCat 的 ffmpeg/silk 链处理。
 * 这里只负责「写出一个格式正确的 WAV」，编码交给 NapCat（它自带 silk 编码器）。
 */
export function writeWavFile(path: string, bytes: Uint8Array): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, bytes);
}

/**
 * 语音合成器：宿主 worker + 磁盘缓存 + ffmpeg 解码。
 *
 * 与宿主的 `synthesize()` 关系：**完全复用**，不另起一套 Python 进程。
 * 好处是热启动状态共享——桌宠刚说完话，群里再说话不用重新付 2 秒冷启动。
 */
async function synthesizeExternal(
  endpoint: string,
  text: string,
  style: string,
  voice: string,
): Promise<TtsResult> {
  const base = endpoint.trim().replace(/\/+$/, '');
  if (base === '') return { ok: false, reason: 'error', message: '本地 TTS 网关地址为空' };
  try {
    // 先做 2.5 秒健康检查：服务没起来时不要卡 180 秒，直接回退 Edge。
    const health = await fetch(`${base}/health`, { signal: AbortSignal.timeout(2_500) });
    if (!health.ok) {
      return { ok: false, reason: 'error', message: `本地 TTS 网关未就绪（HTTP ${health.status}）` };
    }
  } catch {
    return { ok: false, reason: 'error', message: `本地 TTS 网关不可用：${base}` };
  }
  const url = base + '/tts';
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 180_000);
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ text, style, voice }),
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!response.ok) {
      return { ok: false, reason: 'error', message: `本地 TTS 网关 ${response.status}：${await response.text()}` };
    }
    const audio = new Uint8Array(await response.arrayBuffer());
    if (audio.length < 12 || audio[0] !== 0x52 || audio[1] !== 0x49 || audio[2] !== 0x46 || audio[3] !== 0x46) {
      return { ok: false, reason: 'error', message: '本地 TTS 网关没有返回 WAV' };
    }
    return { ok: true, audio };
  } catch (e) {
    return { ok: false, reason: 'error', message: `本地 TTS 网关不可用：${e instanceof Error ? e.message : String(e)}` };
  }
}

export class Speaker {
  private readonly userRoot: string;
  private readonly cache: CacheOptions;
  private readonly ffmpeg: string;
  private synthesized = 0;
  private cacheHits = 0;

  constructor(options: { userRoot: string; cache: CacheOptions; ffmpeg?: string }) {
    this.userRoot = options.userRoot;
    this.cache = options.cache;
    this.ffmpeg = resolveFfmpeg(options.ffmpeg) ?? 'ffmpeg';
  }

  /** 统计（面板用） */
  get stats(): { synthesized: number; cacheHits: number } {
    return { synthesized: this.synthesized, cacheHits: this.cacheHits };
  }

  /**
   * 合成一句话。
   * @param text 要念的文本
   * @param options 音色/语速/音高/音量
   */
  async speak(text: string, options: SpeakOptions = {}): Promise<SpeakResult> {
    const trimmed = text.trim();
    if (trimmed === '') return { ok: false, reason: 'empty-text', message: '要合成的文本为空' };

    const key = cacheKey(trimmed, options);
    const mp3Path = join(this.cache.dir, `${key}.mp3`);
    const wavPath = join(this.cache.dir, `${key}.wav`);

    // 缓存命中：MP3 与 WAV 都在才算（只有 MP3 时还要解码一次）
    if (options.noCache !== true && existsSync(mp3Path) && existsSync(wavPath)) {
      try {
        const parsed = parseWave(new Uint8Array(readFileSync(wavPath)));
        if (parsed.ok) {
          this.cacheHits += 1;
          touch(mp3Path);
          touch(wavPath);
          return { ok: true, mp3: new Uint8Array(readFileSync(mp3Path)), pcm: parsed.pcm, cached: true };
        }
      } catch {
        // 缓存坏了：当没命中，重新合成（不报错，静默修复）
      }
    }

    const provider = options.provider ?? 'edge';
    // 角色名（三月七/银狼）不是 Edge 音色；回退 Edge 时必须换合法音色。
    const edgeVoice =
      typeof options.voice === 'string' && /^[a-z]{2}-[A-Z]{2}-/i.test(options.voice)
        ? options.voice
        : 'zh-CN-XiaoyiNeural';
    let result: TtsResult =
      provider === 'edge'
        ? await hostSynthesize(this.userRoot, trimmed, {
            voice: edgeVoice,
            rate: options.rate,
            pitch: options.pitch,
            volume: options.volume,
          })
        : await synthesizeExternal(options.endpoint ?? '', trimmed, options.style ?? '', options.voice ?? '');
    if (!result.ok && provider !== 'edge') {
      // 本地 GPT-SoVITS/CosyVoice/Kokoro 网关没启动时，不能把整条语音吞掉。
      console.warn(`[dsh-qq-group] 本地 TTS 失败，回退 Edge：${result.message}`);
      result = await hostSynthesize(this.userRoot, trimmed, {
        voice: edgeVoice,
        rate: options.rate,
        pitch: options.pitch,
        volume: options.volume,
      });
    }
    if (!result.ok) return result;
    this.synthesized += 1;

    const filters: string[] = [];
    const speed = Math.min(1.5, Math.max(0.7, options.speed ?? 1));
    if (Math.abs(speed - 1) > 0.01) filters.push(`atempo=${speed.toFixed(3)}`);
    const semitones = Math.min(6, Math.max(-6, options.pitchSemitones ?? 0));
    if (Math.abs(semitones) > 0.01) {
      const ratio = Math.pow(2, semitones / 12);
      filters.push('aresample=44100', `asetrate=${Math.round(44100 * ratio)}`, 'aresample=44100', `atempo=${(1 / ratio).toFixed(4)}`);
    }
    const decoded = await decodeWithFfmpeg(result.audio, this.ffmpeg, filters);
    if (!decoded.ok) return decoded;

    // 落缓存（失败不影响本次结果）
    try {
      mkdirSync(this.cache.dir, { recursive: true });
      writeFileSync(mp3Path, result.audio);
      writeFileSync(wavPath, wavBytes(decoded.pcm));
      this.prune();
    } catch {
      // 缓存写不进去（磁盘满/只读）也要正常发出声音
    }

    return { ok: true, mp3: result.audio, pcm: decoded.pcm, cached: false };
  }

  /** 清缓存（面板/命令行用） */
  clearCache(): number {
    let removed = 0;
    try {
      for (const file of readdirSync(this.cache.dir)) {
        if (!/\.(mp3|wav)$/.test(file)) continue;
        try {
          unlinkSync(join(this.cache.dir, file));
          removed += 1;
        } catch {
          // 单个文件删不掉不影响其它
        }
      }
    } catch {
      // 目录不存在 = 没有缓存
    }
    return removed;
  }

  /** 按「条数上限 + 体积上限」淘汰最旧的（用 mtime 近似最后访问） */
  private prune(): void {
    const maxEntries = this.cache.maxEntries ?? DEFAULT_CACHE_ENTRIES;
    const maxBytes = this.cache.maxBytes ?? DEFAULT_CACHE_BYTES;
    let entries: Array<{ path: string; size: number; mtime: number }>;
    try {
      entries = readdirSync(this.cache.dir)
        .filter((file) => /\.(mp3|wav)$/.test(file))
        .map((file) => {
          const path = join(this.cache.dir, file);
          const stat = statSync(path);
          return { path, size: stat.size, mtime: stat.mtimeMs };
        });
    } catch {
      return;
    }
    let total = entries.reduce((sum, entry) => sum + entry.size, 0);
    if (entries.length <= maxEntries && total <= maxBytes) return;
    entries.sort((a, b) => a.mtime - b.mtime);
    for (const entry of entries) {
      if (entries.length <= maxEntries && total <= maxBytes) break;
      try {
        unlinkSync(entry.path);
        total -= entry.size;
        entries = entries.filter((candidate) => candidate !== entry);
      } catch {
        // 删不掉就跳过（下次再试）
      }
    }
  }
}

/** 更新 mtime，让常用条目不被淘汰（命中缓存时调用） */
function touch(path: string): void {
  try {
    const now = new Date();
    // 用 utimesSync 而不是 appendFileSync：后者会真的往音频里写字节
    utimesSync(path, now, now);
  } catch {
    // 改不了时间戳不影响使用
  }
}

/** 把波形编码成 WAV 字节（这里只用于落缓存，正式发送走 NapCat） */
function wavBytes(pcmData: Pcm): Uint8Array {
  return encodeWave(pcmData);
}

/** 一段静音（合成失败时的兜底，避免群里「发了但没声」） */
export function describeFailure(failure: SpeakFailure): string {
  switch (failure.reason) {
    case 'python-missing':
      return `找不到 Python：${failure.message}`;
    case 'edge-tts-missing':
      return 'Python 里没有 edge-tts（pip install edge-tts）';
    case 'ffmpeg-missing':
      return `找不到 ffmpeg：${failure.message}`;
    case 'timeout':
      return '语音合成超时';
    case 'empty-text':
      return '没有可念的文本';
    case 'worker-dead':
      return '语音合成进程挂了';
    case 'decode-failed':
      return `音频解码失败：${failure.message}`;
    default:
      return failure.message;
  }
}
