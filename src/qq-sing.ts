/**
 * 宿主侧的「离线渲一首歌」：面板点一下、命令行走一次，都能用。
 *
 * 为什么单独一个文件：它既不属于路由（qq.ts），也不属于编排（bridge.ts）——
 * 它是**一个工具**：给定乐谱 → 出 WAV 文件。宿主和云端 CLI 都调它，
 * 这样「面板上试听」和「云上 node qq.js --sing」走的是同一段代码，
 * 不会出现「面板好听、云上难听」这种对不上的问题。
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

import type { QqConfig } from './qq/config';
import { findBuiltinScore, BUILTIN_SCORES, type Score } from './sound/score';
import { resolveBackend } from './sound/sing';
import { Speaker, describeFailure } from './sound/tts';

/** 渲染参数 */
export interface WriteSongOptions {
  config: QqConfig;
  userRoot: string;
  /** 曲名（模糊匹配内置曲目） */
  song: string;
  /** 移调（半音）；不传用配置里的 */
  transpose?: number;
  /** 输出路径；不传就放在用户目录的 out/ 下 */
  out?: string;
  /** 进度回调（面板/命令行显示用） */
  onProgress?: (done: number, total: number) => void;
  /** 直接给一份乐谱（覆盖 song） */
  score?: Score;
}

/** 渲染结果 */
export type WriteSongResult =
  | {
      ok: true;
      path: string;
      durationSec: number;
      notes: number;
      elapsedMs: number;
      /** 音准偏差超过 50 音分的音（调试用；空数组说明全在调上） */
      warning?: string;
    }
  | { ok: false; reason: string; message: string };

/**
 * 渲染一首歌并落盘。
 *
 * @param options 配置、用户目录、曲名与输出路径
 */
export async function writeSongToFile(options: WriteSongOptions): Promise<WriteSongResult> {
  const { config, userRoot } = options;
  const score = options.score ?? findBuiltinScore(options.song);
  if (score === undefined) {
    return {
      ok: false,
      reason: 'score-not-found',
      message: `没有这首歌：${options.song}。内置曲目：${Object.values(BUILTIN_SCORES)
        .map((s) => s.title)
        .join('、')}`,
    };
  }

  const { backend, warning } = resolveBackend(config.sing.backend);
  const speaker = new Speaker({
    userRoot,
    cache: { dir: config.tts.cacheDir !== '' ? config.tts.cacheDir : join(userRoot, 'cache', 'tts') },
  });

  const started = Date.now();
  const rendered = await backend.render(
    score,
    {
      label: `edge-tts:${config.tts.voice}`,
      speak: async (text: string) => {
        const spoken = await speaker.speak(text, { voice: config.tts.voice, rate: config.tts.rate });
        if (!spoken.ok) return { ok: false as const, reason: spoken.reason, message: describeFailure(spoken) };
        return { ok: true as const, audio: spoken.pcm };
      },
    },
    {
      transpose: options.transpose ?? config.sing.transpose,
      mix: config.sing.mix,
      ...(config.sing.voicebankDir === '' ? {} : { voicebankDir: config.sing.voicebankDir }),
      ...(config.sing.rvcModel === '' ? {} : { rvcModel: config.sing.rvcModel }),
      ...(options.onProgress === undefined ? {} : { onProgress: options.onProgress }),
    },
  );

  if (!rendered.ok) return { ok: false, reason: rendered.reason, message: rendered.message };

  // 音准检查：超过 50 音分就是明显跑调，告诉调用方（不是失败）
  const offTune = rendered.report.tuning
    .map((item) => ({
      ...item,
      cents: item.targetHz > 0 && item.sungHz > 0 ? 1200 * Math.log2(item.sungHz / item.targetHz) : 0,
    }))
    .filter((item) => Math.abs(item.cents) > 50);

  const out = options.out ?? join(userRoot, 'out', `${safeName(score.title)}.wav`);
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, rendered.wav);

  return {
    ok: true,
    path: out,
    durationSec: rendered.report.duration,
    notes: rendered.report.notes,
    elapsedMs: Date.now() - started,
    ...(warning === undefined && offTune.length === 0
      ? {}
      : {
          warning: [warning, offTune.length === 0 ? '' : `${offTune.length} 个音偏差超过 50 音分`]
            .filter((part) => part !== '')
            .join('；'),
        }),
  };
}

/** 文件名安全化（去掉路径分隔符与控制字符） */
export function safeName(name: string): string {
  // 用字符码判断而不是正则里的 \u0000-\u001f：正则里写控制字符范围会被 no-control-regex 拦下
  const cleaned = [...name]
    .map((ch) => {
      const code = ch.codePointAt(0) ?? 0;
      if (code < 0x20 || code === 0x7f) return '_';
      return /[\\/:*?"<>|]/.test(ch) ? '_' : ch;
    })
    .join('');
  return cleaned.slice(0, 60) || 'song';
}
