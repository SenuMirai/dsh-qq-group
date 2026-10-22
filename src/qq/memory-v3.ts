/**
 * 记忆 v3：会淡忘、按证据召回、长期事实不衰减。
 *
 * 设计参考 dsh-fish-memory 的「证据门槛 + 鲜活度 + 事实键」，但按 QQ 群做了两点改造：
 * - 一个群一份，不跨群共享；
 * - 中文分词优先用 Node 内置 Intl.Segmenter，不引入 1 MB 词典。
 *
 * 这里是纯数据层，不直接读模型、不发消息；桥接层负责在压缩/回复时调用。
 */
import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

const DAY = 24 * 60 * 60_000;

export type MemoryCategory = 'event' | 'stable_profile' | 'preference' | 'relationship' | 'inside_joke';

export interface MemoryItem {
  id: string;
  text: string;
  category: MemoryCategory;
  /** 0~1 */
  importance: number;
  /** 0~1 */
  emotion: number;
  tags: string[];
  /** 同一件事的稳定键，例如 owner.身高；只写方面，不写值 */
  factKey?: string;
  /** 被更新条目取代后指向新条目 */
  supersededBy?: string;
  createdAt: number;
  occurredAt?: number;
  /** 初始鲜活度 0~1 */
  activation0: number;
  /** 最近一次被想起/被提到的锚点 */
  activationAnchor: number;
  recallCount: number;
  lastRecalledAt?: number;
  source: 'chat' | 'summary' | 'manual' | 'import' | 'migration';
  visibility: 'group' | 'owner';
}

export interface RecallRejection {
  id: string;
  reason: 'superseded' | 'evidence' | 'facts-cap' | 'items-cap' | 'chars-cap' | 'owner-only';
  score?: number;
}

export interface RecallTrace {
  at: number;
  query: string;
  selected: string[];
  rejected: RecallRejection[];
  chars: number;
}

export interface GroupMemoryV3 {
  items: MemoryItem[];
  lastRecall?: RecallTrace;
  updatedAt: number;
}

export interface MemoryStoreV3 {
  version: 3;
  groups: Record<string, GroupMemoryV3>;
}

export interface RecallWeights {
  baseline: number;
  activation: number;
  importance: number;
  emotion: number;
}

export interface RecallOptions {
  now?: number;
  maxItems?: number;
  maxChars?: number;
  maxFacts?: number;
  threshold?: number;
  rarityK?: number;
  weights?: RecallWeights;
  baseHalfLifeDays?: number;
  emotionHalfLifeDays?: number;
  includeOwner?: boolean;
}

export const DEFAULT_RECALL: Required<Omit<RecallOptions, 'now'>> = {
  maxItems: 6,
  maxChars: 800,
  maxFacts: 2,
  threshold: 0.35,
  rarityK: 1,
  weights: { baseline: 0.55, activation: 0.25, importance: 0.15, emotion: 0.05 },
  baseHalfLifeDays: 30,
  emotionHalfLifeDays: 7,
  includeOwner: false,
};

const STOPWORDS = new Set([
  '的','了','是','在','和','与','也','就','都','而','及','或','一个','一下','这个','那个','这些','那些',
  '我','你','您','他','她','它','我们','你们','他们','什么','怎么','为什么','吗','呢','啊','呀','吧','嘛',
  '在吗','有人','今天','现在','刚刚','就是','不是','可以','不能','会','要','有','没','没有',
]);

/** 提取检索词；中文用 Intl.Segmenter，失败时退回按空白/标点切分 */
export function tokenize(text: string): string[] {
  const normalized = String(text ?? '').toLowerCase();
  const out = new Set<string>();
  try {
    const Segmenter = (Intl as unknown as { Segmenter?: new (locale: string, options: { granularity: string }) => { segment: (value: string) => Iterable<{ segment: string; isWordLike?: boolean }> } }).Segmenter;
    if (Segmenter !== undefined) {
      const segmenter = new Segmenter('zh', { granularity: 'word' });
      for (const part of segmenter.segment(normalized)) {
        const word = part.segment.trim();
        if (word === '' || (part.isWordLike === false && !/[\u4e00-\u9fff]/.test(word))) continue;
        if (/^[\p{P}\p{S}\s]+$/u.test(word)) continue;
        if (STOPWORDS.has(word)) continue;
        if (word.length === 1 && !/[\u4e00-\u9fff]/.test(word)) continue;
        out.add(word);
      }
    }
  } catch {
    /* 走下面的简单切分 */
  }
  if (out.size === 0) {
    for (const word of normalized.split(/[^\p{L}\p{N}]+/u)) {
      const value = word.trim();
      if (value !== '' && !STOPWORDS.has(value)) out.add(value);
    }
  }
  return [...out];
}

export function emptyMemoryStore(): MemoryStoreV3 {
  return { version: 3, groups: {} };
}

export function groupMemoryV3(store: MemoryStoreV3, groupId: string): GroupMemoryV3 {
  const existing = store.groups[groupId];
  if (existing !== undefined) return existing;
  const created: GroupMemoryV3 = { items: [], updatedAt: Date.now() };
  store.groups[groupId] = created;
  return created;
}

export function readMemoryStore(path: string): MemoryStoreV3 {
  try {
    const parsed = JSON.parse(readFileSync(path, 'utf8').replace(/^\uFEFF/, '')) as Partial<MemoryStoreV3>;
    if (parsed === null || typeof parsed !== 'object' || parsed.version !== 3 || typeof parsed.groups !== 'object' || parsed.groups === null) {
      return emptyMemoryStore();
    }
    const groups: Record<string, GroupMemoryV3> = {};
    for (const [groupId, raw] of Object.entries(parsed.groups as Record<string, unknown>)) {
      const group = raw as Partial<GroupMemoryV3>;
      if (!Array.isArray(group?.items)) continue;
      groups[groupId] = {
        items: group.items.filter((item): item is MemoryItem => normalizeMemory(item) !== undefined).map((item) => normalizeMemory(item)!),
        ...(group.lastRecall !== null && typeof group.lastRecall === 'object' ? { lastRecall: group.lastRecall as RecallTrace } : {}),
        updatedAt: typeof group.updatedAt === 'number' ? group.updatedAt : Date.now(),
      };
    }
    return { version: 3, groups };
  } catch {
    return emptyMemoryStore();
  }
}

export function writeMemoryStore(path: string, store: MemoryStoreV3): void {
  mkdirSync(dirname(path), { recursive: true });
  const tmp = `${path}.tmp`;
  writeFileSync(tmp, `${JSON.stringify(store)}\n`, 'utf8');
  renameSync(tmp, path);
}

function normalizeMemory(raw: unknown): MemoryItem | undefined {
  if (raw === null || typeof raw !== 'object') return undefined;
  const item = raw as Partial<MemoryItem>;
  if (typeof item.id !== 'string' || typeof item.text !== 'string' || item.text.trim() === '') return undefined;
  const category: MemoryCategory =
    item.category === 'stable_profile' || item.category === 'preference' || item.category === 'relationship' || item.category === 'inside_joke'
      ? item.category
      : 'event';
  const created = typeof item.createdAt === 'number' ? item.createdAt : Date.now();
  return {
    id: item.id,
    text: item.text.trim(),
    category,
    importance: clamp(numberOr(item.importance, 0.5), 0, 1),
    emotion: clamp(numberOr(item.emotion, 0), 0, 1),
    tags: Array.isArray(item.tags) ? item.tags.filter((tag): tag is string => typeof tag === 'string' && tag.trim() !== '').slice(0, 12) : [],
    ...(typeof item.factKey === 'string' && item.factKey.trim() !== '' ? { factKey: item.factKey.trim().slice(0, 80) } : {}),
    ...(typeof item.supersededBy === 'string' && item.supersededBy !== '' ? { supersededBy: item.supersededBy } : {}),
    createdAt: created,
    ...(typeof item.occurredAt === 'number' ? { occurredAt: item.occurredAt } : {}),
    activation0: clamp(numberOr(item.activation0, 1), 0, 1),
    activationAnchor: typeof item.activationAnchor === 'number' ? item.activationAnchor : created,
    recallCount: Math.max(0, Math.round(numberOr(item.recallCount, 0))),
    ...(typeof item.lastRecalledAt === 'number' ? { lastRecalledAt: item.lastRecalledAt } : {}),
    source:
      item.source === 'summary' || item.source === 'manual' || item.source === 'import' || item.source === 'migration'
        ? item.source
        : 'chat',
    visibility: item.visibility === 'owner' ? 'owner' : 'group',
  };
}

function numberOr(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function freshness(item: MemoryItem, now: number, halfLifeDays: number): number {
  if (item.category === 'stable_profile') return item.activation0;
  const anchor = item.activationAnchor || item.createdAt;
  const days = Math.max(0, (now - anchor) / DAY);
  const life = Math.max(1, halfLifeDays) * (1 + 2 * item.importance);
  return clamp(item.activation0 * Math.pow(2, -days / life), 0, 1);
}

function emotionFreshness(item: MemoryItem, now: number, halfLifeDays: number): number {
  if (item.emotion <= 0) return 0;
  const anchor = item.occurredAt ?? item.createdAt;
  const days = Math.max(0, (now - anchor) / DAY);
  return clamp(item.emotion * Math.pow(2, -days / Math.max(0.5, halfLifeDays)), 0, 1);
}

function dayKey(ts: number): string {
  return new Date(ts).toISOString().slice(0, 10);
}

export interface RememberInput {
  text: string;
  category?: MemoryCategory;
  importance?: number;
  emotion?: number;
  tags?: string[];
  factKey?: string;
  occurredAt?: number;
  source?: MemoryItem['source'];
  visibility?: MemoryItem['visibility'];
  id?: string;
}

export interface RememberResult {
  ok: boolean;
  item?: MemoryItem;
  reason?: 'empty' | 'duplicate' | 'quota';
  superseded?: string;
}

/** 写入一条长期记忆；同一 factKey 的旧条目会被标成已取代，不删除 */
export function rememberMemory(
  store: MemoryStoreV3,
  groupId: string,
  input: RememberInput,
  options: { now?: number; dailyQuota?: number } = {},
): RememberResult {
  const now = options.now ?? Date.now();
  const text = String(input.text ?? '').trim().slice(0, 500);
  if (text === '') return { ok: false, reason: 'empty' };
  const group = groupMemoryV3(store, groupId);
  const normalized = text.toLowerCase().replace(/\s+/g, '');
  if (group.items.some((item) => item.supersededBy === undefined && item.text.toLowerCase().replace(/\s+/g, '') === normalized)) {
    return { ok: false, reason: 'duplicate' };
  }
  const quota = options.dailyQuota ?? 8;
  if (quota > 0) {
    const today = dayKey(now);
    const count = group.items.filter((item) => item.source === 'chat' && dayKey(item.createdAt) === today).length;
    if (count >= quota) return { ok: false, reason: 'quota' };
  }
  const category = input.category ?? 'event';
  const item: MemoryItem = {
    id: input.id ?? `m-${now.toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    text,
    category,
    importance: clamp(input.importance ?? (category === 'stable_profile' ? 0.8 : 0.5), 0, 1),
    emotion: clamp(input.emotion ?? 0, 0, 1),
    tags: (input.tags ?? []).filter((tag) => tag.trim() !== '').slice(0, 12),
    ...(input.factKey !== undefined && input.factKey.trim() !== '' ? { factKey: input.factKey.trim().slice(0, 80) } : {}),
    createdAt: now,
    ...(input.occurredAt === undefined ? {} : { occurredAt: input.occurredAt }),
    activation0: 1,
    activationAnchor: now,
    recallCount: 0,
    source: input.source ?? 'chat',
    visibility: input.visibility ?? 'group',
  };
  let superseded: string | undefined;
  if (item.factKey !== undefined) {
    for (const old of group.items) {
      if (old.supersededBy !== undefined || old.factKey !== item.factKey) continue;
      old.supersededBy = item.id;
      superseded = old.id;
    }
  }
  group.items.push(item);
  group.updatedAt = now;
  return { ok: true, item, ...(superseded === undefined ? {} : { superseded }) };
}

export interface RecallResult {
  selected: MemoryItem[];
  rejected: RecallRejection[];
  chars: number;
  evidence: number;
}

/**
 * 召回：证据 C 先过门槛，再按 P 排序。
 * C 只由命中词的稀有度决定；时间只影响排序，不直接决定谁进得来。
 */
export function recallMemories(
  store: MemoryStoreV3,
  groupId: string,
  query: string,
  options: RecallOptions = {},
): RecallResult {
  const now = options.now ?? Date.now();
  const policy = { ...DEFAULT_RECALL, ...options, weights: { ...DEFAULT_RECALL.weights, ...(options.weights ?? {}) } };
  const group = groupMemoryV3(store, groupId);
  const queryTokens = tokenize(query);
  const rejected: RecallRejection[] = [];
  if (queryTokens.length === 0) {
    group.lastRecall = { at: now, query, selected: [], rejected: [], chars: 0 };
    return { selected: [], rejected, chars: 0, evidence: 0 };
  }
  const active = group.items.filter((item) => {
    if (item.supersededBy !== undefined) {
      rejected.push({ id: item.id, reason: 'superseded' });
      return false;
    }
    if (item.visibility === 'owner' && !policy.includeOwner) {
      rejected.push({ id: item.id, reason: 'owner-only' });
      return false;
    }
    return true;
  });
  const df = new Map<string, number>();
  for (const item of active) {
    const words = new Set([...tokenize(item.text), ...item.tags.flatMap((tag) => tokenize(tag))]);
    for (const word of words) df.set(word, (df.get(word) ?? 0) + 1);
  }
  const total = Math.max(1, active.length);
  const scored = active.map((item) => {
    const words = new Set([...tokenize(item.text), ...item.tags.flatMap((tag) => tokenize(tag))]);
    let evidenceSum = 0;
    for (const token of queryTokens) {
      if (!words.has(token)) continue;
      const rarity = Math.log((total + 1) / Math.max(1, df.get(token) ?? 1));
      if (rarity > 0) evidenceSum += rarity;
    }
    const K = Math.max(0.1, policy.rarityK);
    let C = evidenceSum / (evidenceSum + K);
    const normalizedQuery = query.trim().toLowerCase();
    if (normalizedQuery.length >= 4 && item.text.toLowerCase().includes(normalizedQuery)) C = Math.max(C, 0.85);
    const A = freshness(item, now, policy.baseHalfLifeDays);
    const E = emotionFreshness(item, now, policy.emotionHalfLifeDays);
    const I = item.importance;
    const w = policy.weights;
    const P = C * (w.baseline + w.activation * A + w.importance * I + w.emotion * E);
    return { item, C, P };
  });
  const ranked = scored.sort((a, b) => b.P - a.P || b.C - a.C);
  const selected: MemoryItem[] = [];
  let chars = 0;
  let facts = 0;
  let bestEvidence = 0;
  for (const row of ranked) {
    if (row.C < policy.threshold) {
      rejected.push({ id: row.item.id, reason: 'evidence', score: row.P });
      continue;
    }
    bestEvidence = Math.max(bestEvidence, row.C);
    const isFact = row.item.category === 'stable_profile' || row.item.category === 'preference' || row.item.category === 'relationship' || row.item.category === 'inside_joke';
    if (isFact && facts >= policy.maxFacts) {
      rejected.push({ id: row.item.id, reason: 'facts-cap', score: row.P });
      continue;
    }
    if (selected.length >= policy.maxItems) {
      rejected.push({ id: row.item.id, reason: 'items-cap', score: row.P });
      continue;
    }
    if (chars + row.item.text.length > policy.maxChars) {
      rejected.push({ id: row.item.id, reason: 'chars-cap', score: row.P });
      continue;
    }
    selected.push(row.item);
    chars += row.item.text.length;
    if (isFact) facts += 1;
  }
  for (const item of selected) {
    item.recallCount += 1;
    item.lastRecalledAt = now;
    item.activationAnchor = now;
    item.activation0 = clamp(item.activation0 + 0.2 * (1 - item.activation0), 0, 1);
  }
  group.lastRecall = { at: now, query, selected: selected.map((item) => item.id), rejected, chars };
  group.updatedAt = now;
  return { selected, rejected, chars, evidence: bestEvidence };
}

function dateLabel(ts: number, now: number): string {
  const days = Math.floor((now - ts) / DAY);
  if (days <= 0) return '今天';
  if (days === 1) return '昨天';
  if (days < 7) return `${days} 天前`;
  return new Date(ts).toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' });
}

/** 给提示词用：带时间、类别和事实键，并明确只是背景 */
export function formatMemories(items: MemoryItem[], now = Date.now()): string {
  if (items.length === 0) return '';
  return items
    .map((item) => {
      const label = item.category === 'event' ? dateLabel(item.occurredAt ?? item.createdAt, now) : '长期';
      const key = item.factKey === undefined ? '' : `（${item.factKey}）`;
      return `- [${label}]${key} ${item.text}`;
    })
    .join('\n');
}

export function listMemories(store: MemoryStoreV3, groupId: string): MemoryItem[] {
  return [...(store.groups[groupId]?.items ?? [])].sort((a, b) => b.createdAt - a.createdAt);
}

export function updateMemory(
  store: MemoryStoreV3,
  groupId: string,
  id: string,
  patch: { text?: string; category?: MemoryCategory; importance?: number; factKey?: string },
  now = Date.now(),
): MemoryItem | undefined {
  const group = groupMemoryV3(store, groupId);
  const item = group.items.find((entry) => entry.id === id);
  if (item === undefined) return undefined;
  if (typeof patch.text === 'string' && patch.text.trim() !== '') item.text = patch.text.trim().slice(0, 500);
  if (patch.category !== undefined) item.category = patch.category;
  if (patch.importance !== undefined) item.importance = clamp(patch.importance, 0, 1);
  if (patch.factKey !== undefined) {
    const key = patch.factKey.trim().slice(0, 80);
    if (key === '') delete item.factKey;
    else {
      item.factKey = key;
      for (const other of group.items) {
        if (other.id !== item.id && other.supersededBy === undefined && other.factKey === key) {
          other.supersededBy = item.id;
        }
      }
    }
  }
  group.updatedAt = now;
  return item;
}

export function deleteMemory(store: MemoryStoreV3, groupId: string, id: string, now = Date.now()): boolean {
  const group = store.groups[groupId];
  if (group === undefined) return false;
  const before = group.items.length;
  group.items = group.items.filter((item) => item.id !== id);
  if (group.items.length === before) return false;
  for (const item of group.items) {
    if (item.supersededBy === id) delete item.supersededBy;
  }
  group.updatedAt = now;
  return true;
}

export function memoryStats(store: MemoryStoreV3, groupId: string): { total: number; active: number; stable: number; lastRecallAt?: number } {  const group = store.groups[groupId];
  const items = group?.items ?? [];
  return {
    total: items.length,
    active: items.filter((item) => item.supersededBy === undefined).length,
    stable: items.filter((item) => item.supersededBy === undefined && item.category === 'stable_profile').length,
    ...(group?.lastRecall?.at === undefined ? {} : { lastRecallAt: group.lastRecall.at }),
  };
}

/** 从旧版 keyMemories / 摘要迁移；只补一次，失败不影响旧文件 */
export function migrateLegacyMemories(
  store: MemoryStoreV3,
  groupId: string,
  legacy: Array<{ text: string; kind?: string; confidence?: number; createdAt?: number }>,
  summary?: string,
  now = Date.now(),
): number {
  const group = groupMemoryV3(store, groupId);
  if (group.items.length > 0) return 0;
  let added = 0;
  for (const old of legacy) {
    const text = String(old.text ?? '').trim();
    if (text === '') continue;
    const category: MemoryCategory =
      old.kind === 'preference' || old.kind === 'relationship' || old.kind === 'inside_joke'
        ? old.kind
        : 'stable_profile';
    const result = rememberMemory(
      store,
      groupId,
      {
        text,
        category,
        importance: clamp(old.confidence ?? 0.8, 0, 1),
        source: 'migration',
        ...(old.createdAt === undefined ? {} : { occurredAt: old.createdAt }),
      },
      { now, dailyQuota: 0 },
    );
    if (result.ok) added += 1;
  }
  if (typeof summary === 'string' && summary.trim() !== '') {
    const result = rememberMemory(
      store,
      groupId,
      { text: summary.trim().slice(0, 600), category: 'event', importance: 0.35, source: 'migration' },
      { now, dailyQuota: 0 },
    );
    if (result.ok) added += 1;
  }
  if (added > 0) group.updatedAt = now;
  return added;
}
