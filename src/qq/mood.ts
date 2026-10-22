/**
 * 按群心情 v1：心情 0~100 + 七根情绪，会自然回稳。
 *
 * 数据按群隔离；一个群的恶意不污染其他群。
 * 只负责数值和注入文案，模型判断在桥接层完成。
 */
import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

const HOUR = 60 * 60_000;

export const MOOD_DIMS = ['happy', 'calm', 'sweet', 'heartache', 'worry', 'sad', 'jealous'] as const;
export type MoodDim = (typeof MOOD_DIMS)[number];
export type MoodDims = Record<MoodDim, number>;

export interface MoodJudgement {
  moodDelta: number;
  dims: Partial<MoodDims>;
  reason: string;
  confidence: number;
}

export interface MoodEvent {
  at: number;
  mood: number;
  delta: number;
  dims: Partial<MoodDims>;
  reason: string;
  confidence: number;
  kind: 'judge' | 'decay' | 'reset';
}

export interface GroupMood {
  mood: number;
  baseline: number;
  floor: number;
  dims: MoodDims;
  lastReason: string;
  lastConfidence: number;
  lastDelta: number;
  updatedAt: number;
  lastDecayAt: number;
  /** 最近说出去的时间，用于每日注入上限 */
  saidAt: number[];
  timeline: MoodEvent[];
}

export interface MoodStore {
  version: 1;
  groups: Record<string, GroupMood>;
}

export interface MoodRules {
  baseline?: number;
  floor?: number;
  halfLifeHours?: number;
  confidenceThreshold?: number;
  dailyInject?: number;
  sigMood?: number;
  sigDim?: number;
}

const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));

function defaultDims(): MoodDims {
  return Object.fromEntries(MOOD_DIMS.map((key) => [key, 0])) as MoodDims;
}

export function emptyMoodStore(): MoodStore {
  return { version: 1, groups: {} };
}

export function readMoodStore(path: string): MoodStore {
  try {
    const parsed = JSON.parse(readFileSync(path, 'utf8').replace(/^\uFEFF/, '')) as Partial<MoodStore>;
    if (parsed === null || typeof parsed !== 'object' || parsed.version !== 1 || typeof parsed.groups !== 'object' || parsed.groups === null) {
      return emptyMoodStore();
    }
    const groups: Record<string, GroupMood> = {};
    for (const [groupId, raw] of Object.entries(parsed.groups as Record<string, unknown>)) {
      const item = raw as Partial<GroupMood>;
      if (typeof item?.mood !== 'number') continue;
      const dims = defaultDims();
      for (const key of MOOD_DIMS) {
        const value = (item.dims as Partial<MoodDims> | undefined)?.[key];
        dims[key] = typeof value === 'number' && Number.isFinite(value) ? clamp(value, -100, 100) : 0;
      }
      groups[groupId] = {
        mood: clamp(item.mood, 0, 100),
        baseline: clamp(typeof item.baseline === 'number' ? item.baseline : 70, 0, 100),
        floor: clamp(typeof item.floor === 'number' ? item.floor : 0, 0, 100),
        dims,
        lastReason: typeof item.lastReason === 'string' ? item.lastReason : '',
        lastConfidence: clamp(typeof item.lastConfidence === 'number' ? item.lastConfidence : 0, 0, 100),
        lastDelta: typeof item.lastDelta === 'number' ? item.lastDelta : 0,
        updatedAt: typeof item.updatedAt === 'number' ? item.updatedAt : Date.now(),
        lastDecayAt: typeof item.lastDecayAt === 'number' ? item.lastDecayAt : Date.now(),
        saidAt: Array.isArray(item.saidAt) ? item.saidAt.filter((x): x is number => typeof x === 'number').slice(-200) : [],
        timeline: Array.isArray(item.timeline)
          ? item.timeline.filter((event): event is MoodEvent => event !== null && typeof event === 'object' && typeof (event as MoodEvent).at === 'number').slice(-100)
          : [],
      };
    }
    return { version: 1, groups };
  } catch {
    return emptyMoodStore();
  }
}

export function writeMoodStore(path: string, store: MoodStore): void {
  mkdirSync(dirname(path), { recursive: true });
  const tmp = `${path}.tmp`;
  writeFileSync(tmp, `${JSON.stringify(store)}\n`, 'utf8');
  renameSync(tmp, path);
}

export function groupMood(store: MoodStore, groupId: string, rules: MoodRules = {}, now = Date.now()): GroupMood {
  const existing = store.groups[groupId];
  const baseline = clamp(rules.baseline ?? existing?.baseline ?? 70, 0, 100);
  const floor = clamp(rules.floor ?? existing?.floor ?? 0, 0, 100);
  if (existing !== undefined) {
    existing.baseline = baseline;
    existing.floor = floor;
    return existing;
  }
  const created: GroupMood = {
    mood: baseline,
    baseline,
    floor,
    dims: defaultDims(),
    lastReason: '',
    lastConfidence: 0,
    lastDelta: 0,
    updatedAt: now,
    lastDecayAt: now,
    saidAt: [],
    timeline: [],
  };
  store.groups[groupId] = created;
  return created;
}

function dayKey(ts: number): string {
  return new Date(ts).toISOString().slice(0, 10);
}

/** 心情向基线、情绪向 0 衰减；半衰期以小时计 */
export function decayMood(state: GroupMood, now: number, rules: MoodRules = {}): void {
  const halfLife = Math.max(0.5, rules.halfLifeHours ?? 12);
  const hours = Math.max(0, (now - state.lastDecayAt) / HOUR);
  if (hours <= 0) return;
  const factor = Math.pow(0.5, hours / halfLife);
  const beforeMood = state.mood;
  const beforeDims = { ...state.dims };
  state.mood = clamp(state.baseline + (state.mood - state.baseline) * factor, 0, 100);
  if (state.mood < state.floor) state.mood = state.floor;
  for (const key of MOOD_DIMS) {
    state.dims[key] = clamp(state.dims[key] * factor, -100, 100);
  }
  state.lastDecayAt = now;
  state.updatedAt = now;
  const changed = Math.abs(state.mood - beforeMood) >= 1 || MOOD_DIMS.some((key) => Math.abs(state.dims[key] - beforeDims[key]) >= 1);
  if (changed) {
    const top = topDim(state);
    state.timeline.push({
      at: now,
      mood: state.mood,
      delta: state.mood - beforeMood,
      dims: top === undefined ? {} : { [top.key]: top.value - beforeDims[top.key] },
      reason: '自己慢慢回稳',
      confidence: 100,
      kind: 'decay',
    });
    if (state.timeline.length > 100) state.timeline = state.timeline.slice(-100);
  }
}

/** 应用一次模型判断；实际心情变化 = moodDelta/3，防止贴顶 */
export function applyMoodJudgement(
  state: GroupMood,
  judgement: MoodJudgement,
  now = Date.now(),
): { changed: boolean; event?: MoodEvent } {
  const delta = clamp(Number(judgement.moodDelta) || 0, -10, 10) / 3;
  const dims: Partial<MoodDims> = {};
  for (const key of MOOD_DIMS) {
    const value = Number(judgement.dims?.[key] ?? 0);
    if (!Number.isFinite(value) || Math.abs(value) < 0.1) continue;
    const applied = clamp(value, -10, 10);
    dims[key] = applied;
    state.dims[key] = clamp(state.dims[key] + applied, -100, 100);
  }
  if (Math.abs(delta) < 0.01 && Object.keys(dims).length === 0) return { changed: false };
  state.mood = clamp(state.mood + delta, Math.max(0, state.floor), 100);
  state.lastReason = String(judgement.reason ?? '').trim().slice(0, 300);
  state.lastConfidence = clamp(Number(judgement.confidence) || 0, 0, 100);
  state.lastDelta = delta;
  state.updatedAt = now;
  const event: MoodEvent = {
    at: now,
    mood: state.mood,
    delta,
    dims,
    reason: state.lastReason,
    confidence: state.lastConfidence,
    kind: 'judge',
  };
  state.timeline.push(event);
  if (state.timeline.length > 100) state.timeline = state.timeline.slice(-100);
  return { changed: true, event };
}

export function topDim(state: GroupMood): { key: MoodDim; value: number } | undefined {
  let best: { key: MoodDim; value: number } | undefined;
  for (const key of MOOD_DIMS) {
    const value = state.dims[key];
    if (value > 0 && (best === undefined || value > best.value)) best = { key, value };
  }
  return best;
}

const DIM_LABEL: Record<MoodDim, string> = {
  happy: '开心',
  calm: '踏实',
  sweet: '甜',
  heartache: '心疼',
  worry: '担心',
  sad: '难过',
  jealous: '吃醋',
};

export function moodLabel(mood: number): string {
  if (mood >= 80) return '欢喜';
  if (mood >= 62) return '开心';
  if (mood >= 42) return '一般';
  if (mood >= 25) return '有点低落';
  return '难过';
}

function significant(event: MoodEvent, rules: MoodRules): boolean {
  const sigMood = rules.sigMood ?? 3;
  const sigDim = rules.sigDim ?? 5;
  return Math.abs(event.delta * 3) >= sigMood || Object.values(event.dims).some((value) => Math.abs(value) >= sigDim);
}

/** 这一轮值不值得把心情说给它听；不标记已说，标记由 markMoodInjected 做 */
export function moodInjection(
  state: GroupMood,
  rules: MoodRules = {},
  now = Date.now(),
): { inject: boolean; line: string; reason?: 'disabled' | 'no-reason' | 'confidence' | 'not-significant' | 'daily-cap' } {
  if (state.lastReason === '') return { inject: false, line: '', reason: 'no-reason' };
  if (state.lastConfidence < (rules.confidenceThreshold ?? 60)) return { inject: false, line: '', reason: 'confidence' };
  const last = state.timeline.filter((event) => event.kind === 'judge').slice(-1)[0];
  if (last === undefined || !significant(last, rules)) return { inject: false, line: '', reason: 'not-significant' };
  const today = dayKey(now);
  const saidToday = state.saidAt.filter((ts) => dayKey(ts) === today).length;
  if (saidToday >= (rules.dailyInject ?? 6)) return { inject: false, line: '', reason: 'daily-cap' };
  const top = topDim(state);
  const stateText = `（这会儿）${moodLabel(state.mood)}${top === undefined ? '' : `，还${DIM_LABEL[top.key]}`}`;
  const line = `${stateText}\n（刚才）${state.lastReason}\n\n这是这会儿的底子，不是非这样不可；对方说别的，你按自己的判断接，也别把这段念出来。`;
  return { inject: true, line };
}

export function markMoodInjected(state: GroupMood, now = Date.now()): void {
  state.saidAt.push(now);
  if (state.saidAt.length > 200) state.saidAt = state.saidAt.slice(-200);
}

export function resetMood(state: GroupMood, rules: MoodRules = {}, now = Date.now()): void {
  const baseline = clamp(rules.baseline ?? state.baseline, 0, 100);
  state.mood = baseline;
  state.baseline = baseline;
  state.floor = clamp(rules.floor ?? state.floor, 0, 100);
  state.dims = defaultDims();
  state.lastReason = '';
  state.lastConfidence = 0;
  state.lastDelta = 0;
  state.updatedAt = now;
  state.lastDecayAt = now;
  state.saidAt = [];
  state.timeline = [];
}

export function moodSnapshot(state: GroupMood): Record<string, unknown> {
  return {
    mood: Math.round(state.mood),
    label: moodLabel(state.mood),
    baseline: state.baseline,
    floor: state.floor,
    dims: Object.fromEntries(MOOD_DIMS.map((key) => [key, Math.round(state.dims[key] * 10) / 10])),
    lastReason: state.lastReason,
    lastConfidence: Math.round(state.lastConfidence),
    lastDelta: Math.round(state.lastDelta * 10) / 10,
    updatedAt: state.updatedAt,
    timeline: state.timeline.slice(-40),
  };
}
