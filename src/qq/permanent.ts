import { existsSync, readFileSync, writeFileSync } from 'node:fs';

/**
 * 永久记忆：不参与摘要压缩，不做时间衰减，不自动删除。
 *
 * 两层：
 * - global：只有主人相关内容；跨会话读取，但只在主人私聊/主人在场时注入；
 * - session：每个群/私聊独立，避免跨群串隐私。
 *
 * 容量满时只封存（sealedAt），新增失败，旧条目原样保留。
 */
export type PermanentSource = 'auto' | 'manual' | 'merge';
export type PermanentScope = 'session' | 'global';
export type PermanentSensitivity = 'normal' | 'private';

export type PermanentEntry = {
  id: string;
  text: string;
  /** 相关的人（QQ 号） */
  people: string[];
  createdAt: number;
  updatedAt: number;
  source: PermanentSource;
  scope: PermanentScope;
  /** private 只允许在主人私聊读取，绝不进群 */
  sensitivity: PermanentSensitivity;
};

export type PermanentBucket = {
  items: PermanentEntry[];
  sealedAt?: number;
  updatedAt?: number;
};

export type PermanentStore = {
  version: 2;
  global: PermanentBucket;
  groups: Record<string, PermanentBucket>;
};

export type PermanentAddInput = {
  text: string;
  people?: string[];
  source?: PermanentSource;
  scope?: PermanentScope;
  sensitivity?: PermanentSensitivity;
  /** 同一人的连续消息在此时间内合并成一条，避免刷屏占容量 */
  mergeWithinMs?: number;
};

export type PermanentAddResult =
  | { ok: true; item: PermanentEntry; merged: boolean }
  | { ok: false; reason: 'empty' | 'full'; capacity?: number };

const emptyBucket = (): PermanentBucket => ({ items: [] });
const emptyStore = (): PermanentStore => ({ version: 2, global: emptyBucket(), groups: {} });

function normalizeEntry(value: unknown): PermanentEntry | undefined {
  if (value === null || typeof value !== 'object') return undefined;
  const item = value as Record<string, unknown>;
  if (typeof item.text !== 'string' || item.text.trim() === '') return undefined;
  const scope: PermanentScope = item.scope === 'global' ? 'global' : 'session';
  return {
    id:
      typeof item.id === 'string' && item.id !== ''
        ? item.id
        : `p-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    text: item.text.trim().slice(0, 4000),
    people: Array.isArray(item.people)
      ? item.people.filter((x): x is string => typeof x === 'string').slice(0, 20)
      : [],
    createdAt: typeof item.createdAt === 'number' ? item.createdAt : Date.now(),
    updatedAt:
      typeof item.updatedAt === 'number'
        ? item.updatedAt
        : typeof item.createdAt === 'number'
          ? item.createdAt
          : Date.now(),
    source: item.source === 'manual' || item.source === 'merge' || item.source === 'auto' ? item.source : 'manual',
    scope,
    sensitivity: item.sensitivity === 'private' ? 'private' : 'normal',
  };
}

function readBucket(raw: unknown): PermanentBucket {
  if (raw === null || typeof raw !== 'object') return emptyBucket();
  const block = raw as { items?: unknown; sealedAt?: unknown; updatedAt?: unknown };
  return {
    items: Array.isArray(block.items)
      ? block.items.map((value) => normalizeEntry(value)).filter((item): item is PermanentEntry => item !== undefined)
      : [],
    ...(typeof block.sealedAt === 'number' ? { sealedAt: block.sealedAt } : {}),
    ...(typeof block.updatedAt === 'number' ? { updatedAt: block.updatedAt } : {}),
  };
}

export function readPermanentStore(path: string): PermanentStore {
  try {
    if (!existsSync(path)) return emptyStore();
    const parsed = JSON.parse(readFileSync(path, 'utf8')) as { global?: unknown; groups?: unknown };
    const groups: Record<string, PermanentBucket> = {};
    if (parsed.groups !== null && typeof parsed.groups === 'object') {
      for (const [groupId, raw] of Object.entries(parsed.groups as Record<string, unknown>)) {
        groups[groupId] = readBucket(raw);
      }
    }
    return { version: 2, global: readBucket(parsed.global), groups };
  } catch {
    return emptyStore();
  }
}

export function writePermanentStore(path: string, store: PermanentStore): void {
  writeFileSync(path, `${JSON.stringify(store, null, 2)}\n`, 'utf8');
}

function bucketOf(store: PermanentStore, groupId: string, scope: PermanentScope): PermanentBucket {
  if (scope === 'global') {
    if (!store.global || !Array.isArray(store.global.items)) store.global = emptyBucket();
    return store.global;
  }
  const bucket = (store.groups[groupId] ??= emptyBucket());
  if (!Array.isArray(bucket.items)) bucket.items = [];
  return bucket;
}

export function listPermanent(
  store: PermanentStore,
  groupId: string,
  scope: PermanentScope = 'session',
): PermanentEntry[] {
  return bucketOf(store, groupId, scope).items.slice();
}

export function addPermanent(
  store: PermanentStore,
  groupId: string,
  input: PermanentAddInput,
  capacity: number,
  now = Date.now(),
): PermanentAddResult {
  const text = String(input.text ?? '').trim().slice(0, 4000);
  if (text === '') return { ok: false, reason: 'empty' };
  const scope = input.scope === 'global' ? 'global' : 'session';
  const bucket = bucketOf(store, groupId, scope);
  const people = (input.people ?? []).filter((x) => typeof x === 'string' && x !== '').slice(0, 20);
  const source = input.source ?? 'manual';
  const sensitivity = input.sensitivity === 'private' ? 'private' : 'normal';
  const cap = Math.max(0, Math.round(capacity));
  const mergeWithinMs = Math.max(0, input.mergeWithinMs ?? 0);
  const last = bucket.items[bucket.items.length - 1];

  // 同一人短时间内的连续消息合并，不占新条目。
  if (
    mergeWithinMs > 0 &&
    source === 'auto' &&
    last !== undefined &&
    now - last.updatedAt <= mergeWithinMs &&
    last.people.join(',') === people.join(',') &&
    last.sensitivity === sensitivity &&
    last.text.length + text.length + 1 <= 1800
  ) {
    last.text = `${last.text}\n${text}`;
    last.updatedAt = now;
    bucket.updatedAt = now;
    return { ok: true, item: last, merged: true };
  }

  if (cap > 0 && bucket.items.length >= cap) {
    bucket.sealedAt = now;
    bucket.updatedAt = now;
    return { ok: false, reason: 'full', capacity: cap };
  }

  const item: PermanentEntry = {
    id: `p-${now.toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    text,
    people,
    createdAt: now,
    updatedAt: now,
    source,
    scope,
    sensitivity,
  };
  bucket.items.push(item);
  delete bucket.sealedAt;
  bucket.updatedAt = now;
  return { ok: true, item, merged: false };
}

export function deletePermanent(
  store: PermanentStore,
  groupId: string,
  id: string,
  scope: PermanentScope = 'session',
): boolean {
  const bucket = bucketOf(store, groupId, scope);
  const index = bucket.items.findIndex((item) => item.id === id);
  if (index < 0) return false;
  bucket.items.splice(index, 1);
  bucket.updatedAt = Date.now();
  if (bucket.items.length === 0) delete bucket.sealedAt;
  return true;
}

/** 把多条永久记忆替换成一条合并结果（AI 合并/人工整理）。 */
export function replacePermanent(
  store: PermanentStore,
  groupId: string,
  ids: string[],
  text: string,
  scope: PermanentScope = 'session',
): PermanentEntry | undefined {
  const bucket = bucketOf(store, groupId, scope);
  const wanted = new Set(ids);
  const selected = bucket.items.filter((item) => wanted.has(item.id));
  if (selected.length === 0) return undefined;
  const mergedText = String(text ?? '').trim().slice(0, 4000);
  if (mergedText === '') return undefined;
  const people = Array.from(new Set(selected.flatMap((item) => item.people))).slice(0, 20);
  const now = Date.now();
  const item: PermanentEntry = {
    id: `p-${now.toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    text: mergedText,
    people,
    createdAt: Math.min(...selected.map((entry) => entry.createdAt)),
    updatedAt: now,
    source: 'merge',
    scope,
    sensitivity: selected.some((entry) => entry.sensitivity === 'private') ? 'private' : 'normal',
  };
  bucket.items = bucket.items.filter((entry) => !wanted.has(entry.id));
  bucket.items.push(item);
  bucket.updatedAt = now;
  delete bucket.sealedAt;
  return item;
}

/** 把会话条目提升到全局（只允许主人相关内容；由 UI 显式触发）。 */
export function promotePermanent(
  store: PermanentStore,
  groupId: string,
  id: string,
  capacity: number,
  sensitivity: PermanentSensitivity = 'normal',
): PermanentEntry | undefined {
  const session = bucketOf(store, groupId, 'session');
  const item = session.items.find((entry) => entry.id === id);
  if (item === undefined) return undefined;
  const global = bucketOf(store, '', 'global');
  if (capacity > 0 && global.items.length >= capacity) {
    global.sealedAt = Date.now();
    return undefined;
  }
  session.items = session.items.filter((entry) => entry.id !== id);
  const promoted: PermanentEntry = {
    ...item,
    id: `p-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    scope: 'global',
    sensitivity,
    updatedAt: Date.now(),
  };
  global.items.push(promoted);
  delete global.sealedAt;
  return promoted;
}

/** 简单相关度：关键词命中 + 新近程度；不做时间衰减删除。 */
export function selectPermanent(
  entries: PermanentEntry[],
  query: string,
  limit: number,
  maxChars: number,
): PermanentEntry[] {
  const q = query.toLowerCase().replace(/\s+/g, '');
  const scored = entries.map((item, index) => {
    const text = item.text.toLowerCase();
    let score = index * 0.001;
    if (q !== '') {
      const grams = new Set<string>();
      for (let i = 0; i + 1 < q.length && grams.size < 40; i += 1) grams.add(q.slice(i, i + 2));
      for (const gram of grams) if (text.includes(gram)) score += 2;
      if (q.includes('主人') && item.scope === 'global') score += 1;
    }
    return { item, score };
  });
  scored.sort((a, b) => b.score - a.score);
  const picked: PermanentEntry[] = [];
  let chars = 0;
  for (const { item } of scored) {
    if (picked.length >= Math.max(1, limit)) break;
    if (chars + item.text.length > Math.max(200, maxChars) && picked.length > 0) continue;
    picked.push(item);
    chars += item.text.length;
  }
  return picked;
}
