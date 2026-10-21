/**
 * 乐谱：格式定义、解析、内置曲目。
 *
 * ── 为什么用「音符 + 起始拍 + 时值」而不是 MIDI 文件 ──
 * 1. 要能在 QQ 群里**临时改**（「唱高一点」「唱慢一点」），JSON 改起来比 MIDI 直观；
 * 2. 模型可以根据请求生成一份乐谱（JSON Schema 简单，小模型也能写对）；
 * 3. 不需要引入 MIDI 解析库，云端少一个依赖。
 *
 * ── 一个音符长什么样 ──
 * ```json
 * { "midi": 60, "start": 0, "dur": 1, "lyric": "一" }
 * ```
 * `midi` 是 MIDI 音高（60 = C4），`start`/`dur` 以**拍**为单位，`lyric` 是这一个音要唱的字。
 * 没有 `lyric` 就是哼唱（用固定元音），这也是 A 档最稳的用法——TTS 对单字发音比对元音可控得多。
 */

import { readFileSync } from 'node:fs';

/** 一个音符 */
export interface Note {
  /** MIDI 音高（0~127；60 = C4 = 中央 C） */
  midi: number;
  /** 起始位置（拍） */
  start: number;
  /** 时值（拍） */
  dur: number;
  /** 要唱的字（空 = 哼唱一个元音） */
  lyric?: string;
  /** 力度（0~1，默认 0.8） */
  velocity?: number;
}

/** 乐谱 */
export interface Score {
  version: 1;
  title: string;
  /** 每分钟拍数 */
  bpm: number;
  /** 每小节拍数（4/4 就是 4） */
  beatsPerBar: number;
  /** 调性说明（只用于展示与移调提示，不参与计算） */
  key?: string;
  /** 音符列表（按 start 升序；解析时会自动排序） */
  notes: Note[];
}

/** 解析失败原因 */
export type ScoreParseResult = { ok: true; score: Score } | { ok: false; reason: string };

/** MIDI 音高 → 频率（Hz），A4 = 69 = 440 Hz */
export function midiToHz(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

/** 频率 → 最接近的 MIDI 音高（可为小数） */
export function hzToMidi(hz: number): number {
  if (hz <= 0) return 0;
  return 69 + 12 * Math.log2(hz / 440);
}

/** 音名（C4 / A#3 之类，日志与面板用） */
export function midiToName(midi: number): string {
  const names = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const rounded = Math.round(midi);
  const octave = Math.floor(rounded / 12) - 1;
  const name = names[((rounded % 12) + 12) % 12] ?? 'C';
  return `${name}${octave}`;
}

/** 一拍多少秒 */
export function secondsPerBeat(score: Score): number {
  return 60 / Math.max(1, score.bpm);
}

/** 整首曲子多少秒 */
export function scoreDuration(score: Score): number {
  const last = score.notes.reduce((max, note) => Math.max(max, note.start + note.dur), 0);
  return last * secondsPerBeat(score);
}

/**
 * 解析乐谱 JSON（宽松：字段别名、缺省值都认，但**类型错的报出来**）。
 *
 * 容忍的写法：
 * - `notes` 也可以是 `melody` / `tracks[0].notes`
 * - 音符的 `midi` 也可以是 `pitch` / `note`（后者接受 "C4" 这样的音名）
 * - `start` / `dur` 缺省时自动接在上一个音符后面（连写旋律时很省事）
 */
export function parseScore(raw: unknown): ScoreParseResult {
  if (raw === null || typeof raw !== 'object') return { ok: false, reason: '乐谱不是一个对象' };
  const src = raw as Record<string, unknown>;
  const notesRaw = src.notes ?? src.melody ?? (Array.isArray(src.tracks) ? (src.tracks[0] as Record<string, unknown> | undefined)?.notes : undefined);
  if (!Array.isArray(notesRaw)) return { ok: false, reason: '乐谱里没有 notes 数组' };
  if (notesRaw.length === 0) return { ok: false, reason: '乐谱里一个音符都没有' };

  const bpm = typeof src.bpm === 'number' && src.bpm > 0 ? Math.min(300, src.bpm) : 100;
  const beatsPerBar = typeof src.beatsPerBar === 'number' && src.beatsPerBar > 0 ? src.beatsPerBar : 4;
  const score: Score = {
    version: 1,
    title: typeof src.title === 'string' && src.title.trim() !== '' ? src.title.trim() : '未命名',
    bpm,
    beatsPerBar,
    ...(typeof src.key === 'string' ? { key: src.key } : {}),
    notes: [],
  };

  let cursor = 0;
  for (const [index, item] of notesRaw.entries()) {
    if (item === null || typeof item !== 'object') {
      return { ok: false, reason: `第 ${index + 1} 个音符不是对象` };
    }
    const note = item as Record<string, unknown>;
    const midi = readMidi(note);
    if (midi === undefined) {
      return { ok: false, reason: `第 ${index + 1} 个音符没有合法音高（midi/pitch/note）` };
    }
    const dur = typeof note.dur === 'number' && note.dur > 0 ? note.dur : 1;
    const start = typeof note.start === 'number' && note.start >= 0 ? note.start : cursor;
    const lyric = typeof note.lyric === 'string' ? note.lyric : typeof note.text === 'string' ? note.text : undefined;
    score.notes.push({
      midi: clampMidi(midi),
      start,
      dur: Math.min(32, dur),
      ...(lyric === undefined || lyric.trim() === '' ? {} : { lyric: lyric.trim().slice(0, 4) }),
      velocity: typeof note.velocity === 'number' ? Math.min(1, Math.max(0, note.velocity)) : undefined,
    });
    cursor = start + dur;
  }

  score.notes.sort((a, b) => a.start - b.start);
  return { ok: true, score };
}

function clampMidi(value: number): number {
  return Math.min(127, Math.max(0, Math.round(value)));
}

/** 从音符对象里取音高（数字或音名） */
function readMidi(note: Record<string, unknown>): number | undefined {
  for (const key of ['midi', 'pitch']) {
    const value = note[key];
    if (typeof value === 'number' && Number.isFinite(value)) return value;
  }
  const named = note.note;
  if (typeof named === 'number' && Number.isFinite(named)) return named;
  if (typeof named === 'string') return parseNoteName(named);
  return undefined;
}

/** "C4" / "A#3" / "bb2" → MIDI 音高 */
export function parseNoteName(text: string): number | undefined {
  const match = /^([a-gA-G])([#b]?)(-?\d)$/.exec(text.trim());
  if (match === null) return undefined;
  const base: Record<string, number> = { c: 0, d: 2, e: 4, f: 5, g: 7, a: 9, b: 11 };
  const letter = (match[1] ?? 'c').toLowerCase();
  const accidental = match[2] === '#' ? 1 : match[2] === 'b' ? -1 : 0;
  const octave = Number(match[3] ?? 4);
  return (octave + 1) * 12 + (base[letter] ?? 0) + accidental;
}

/** 整体移调（半音），返回新乐谱 */
export function transposeScore(score: Score, semitones: number): Score {
  if (semitones === 0) return score;
  return {
    ...score,
    notes: score.notes.map((note) => ({ ...note, midi: clampMidi(note.midi + semitones) })),
  };
}

/** 从文件读乐谱 */
export function loadScoreFile(path: string): ScoreParseResult {
  let text: string;
  try {
    text = readFileSync(path, 'utf8');
  } catch (e) {
    return { ok: false, reason: `读不到乐谱文件 ${path}：${e instanceof Error ? e.message : String(e)}` };
  }
  try {
    return parseScore(JSON.parse(text.replace(/^\uFEFF/, '')));
  } catch (e) {
    return { ok: false, reason: `乐谱不是合法 JSON：${e instanceof Error ? e.message : String(e)}` };
  }
}

/**
 * 内置曲目：全部是**公有领域**的传统旋律（民谣/儿歌），词也是自己配的或没有词。
 * 不内置任何有版权的流行歌——群里点歌时由调用方决定怎么处理版权。
 */
export const BUILTIN_SCORES: Record<string, Score> = {
  /** 小星星：C C G G A A G | F F E E D D C */
  twinkle: {
    version: 1,
    title: '小星星',
    bpm: 100,
    beatsPerBar: 4,
    key: 'C',
    notes: [
      { midi: 60, start: 0, dur: 1, lyric: '一' },
      { midi: 60, start: 1, dur: 1, lyric: '闪' },
      { midi: 67, start: 2, dur: 1, lyric: '一' },
      { midi: 67, start: 3, dur: 1, lyric: '闪' },
      { midi: 69, start: 4, dur: 1, lyric: '亮' },
      { midi: 69, start: 5, dur: 1, lyric: '晶' },
      { midi: 67, start: 6, dur: 2, lyric: '晶' },
      { midi: 65, start: 8, dur: 1, lyric: '满' },
      { midi: 65, start: 9, dur: 1, lyric: '天' },
      { midi: 64, start: 10, dur: 1, lyric: '都' },
      { midi: 64, start: 11, dur: 1, lyric: '是' },
      { midi: 62, start: 12, dur: 1, lyric: '小' },
      { midi: 62, start: 13, dur: 1, lyric: '星' },
      { midi: 60, start: 14, dur: 2, lyric: '星' },
    ],
  },
  /** 两只老虎：C D E C | C D E C | E F G | E F G */
  frere: {
    version: 1,
    title: '两只老虎',
    bpm: 120,
    beatsPerBar: 4,
    key: 'C',
    notes: [
      { midi: 60, start: 0, dur: 1, lyric: '两' },
      { midi: 62, start: 1, dur: 1, lyric: '只' },
      { midi: 64, start: 2, dur: 1, lyric: '老' },
      { midi: 60, start: 3, dur: 1, lyric: '虎' },
      { midi: 60, start: 4, dur: 1, lyric: '两' },
      { midi: 62, start: 5, dur: 1, lyric: '只' },
      { midi: 64, start: 6, dur: 1, lyric: '老' },
      { midi: 60, start: 7, dur: 1, lyric: '虎' },
      { midi: 64, start: 8, dur: 1, lyric: '跑' },
      { midi: 65, start: 9, dur: 1, lyric: '得' },
      { midi: 67, start: 10, dur: 2, lyric: '快' },
      { midi: 64, start: 12, dur: 1, lyric: '跑' },
      { midi: 65, start: 13, dur: 1, lyric: '得' },
      { midi: 67, start: 14, dur: 2, lyric: '快' },
    ],
  },
  /** 音阶练习（哼唱版，没有词，最稳） */
  scale: {
    version: 1,
    title: '音阶',
    bpm: 90,
    beatsPerBar: 4,
    key: 'C',
    notes: Array.from({ length: 8 }, (_, i) => ({
      midi: 60 + i,
      start: i * 1,
      dur: i === 7 ? 2 : 1,
    })),
  },
  /** 生日快乐（旋律已进入公有领域） */
  birthday: {
    version: 1,
    title: '生日快乐',
    bpm: 108,
    beatsPerBar: 3,
    key: 'F',
    notes: [
      { midi: 67, start: 0, dur: 0.75, lyric: '祝' },
      { midi: 67, start: 0.75, dur: 0.25, lyric: '你' },
      { midi: 69, start: 1, dur: 1, lyric: '生' },
      { midi: 67, start: 2, dur: 1, lyric: '日' },
      { midi: 72, start: 3, dur: 1, lyric: '快' },
      { midi: 71, start: 4, dur: 2, lyric: '乐' },
      { midi: 67, start: 6, dur: 0.75, lyric: '祝' },
      { midi: 67, start: 6.75, dur: 0.25, lyric: '你' },
      { midi: 69, start: 7, dur: 1, lyric: '生' },
      { midi: 67, start: 8, dur: 1, lyric: '日' },
      { midi: 74, start: 9, dur: 1, lyric: '快' },
      { midi: 72, start: 10, dur: 2, lyric: '乐' },
    ],
  },
};

/** 按名字找内置曲目（模糊：小写、去空格、认部分匹配） */
export function findBuiltinScore(name: string): Score | undefined {
  const wanted = name.trim().toLowerCase();
  if (wanted === '') return undefined;
  const aliases: Record<string, string> = {
    小星星: 'twinkle',
    twinkle: 'twinkle',
    两只老虎: 'frere',
    frere: 'frere',
    音阶: 'scale',
    scale: 'scale',
    生日快乐: 'birthday',
    birthday: 'birthday',
  };
  const direct = aliases[name.trim()] ?? aliases[wanted];
  if (direct !== undefined) return BUILTIN_SCORES[direct];
  const keys = Object.keys(BUILTIN_SCORES);
  const hit = keys.find((key) => key.includes(wanted) || BUILTIN_SCORES[key]?.title.includes(name.trim()));
  return hit === undefined ? undefined : BUILTIN_SCORES[hit];
}

/** 内置曲目名列表（"你会唱什么" 时回答用） */
export function builtinTitles(): string[] {
  return Object.values(BUILTIN_SCORES).map((score) => score.title);
}
