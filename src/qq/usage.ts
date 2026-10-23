/**
 * QQ 插件的模型用量账本。
 *
 * 每次模型调用记录：时间、provider/model、用途、input/output/cache/reasoning tokens。
 * 不直接存金额：单价可能变，按当前设置里的「每百万 token 积分」实时折算，
 * 换模型后旧记录仍归属旧模型，统计不会串。
 */

import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

export interface UsageEntry {
  ts: number;
  provider: string;
  model: string;
  /** reply / gate / hostility / sticker / mood / memory / memory-v3 / model-check / gen-test */
  purpose: string;
  /** 产生这次调用的群；没有群上下文时为空 */
  groupId?: string;
  /** 附带图片数量（视觉调用单独看成本） */
  images?: number;
  /** usage chunk 缺失，按文本长度估算 */
  estimated?: boolean;
  inputTokens: number;
  outputTokens: number;
  totalTokens?: number;
  cacheReadTokens?: number;
  cacheWriteTokens?: number;
  reasoningTokens?: number;
}

export interface UsageFile {
  version: 1;
  entries: UsageEntry[];
}

const MAX_ENTRIES = 5000;

export function emptyUsage(): UsageFile {
  return { version: 1, entries: [] };
}

export function readUsage(path: string): UsageFile {
  try {
    const parsed = JSON.parse(readFileSync(path, 'utf8').replace(/^\uFEFF/, '')) as Partial<UsageFile>;
    if (parsed === null || typeof parsed !== 'object' || !Array.isArray(parsed.entries)) return emptyUsage();
    return {
      version: 1,
      entries: parsed.entries.filter(isEntry).slice(-MAX_ENTRIES),
    };
  } catch {
    return emptyUsage();
  }
}

function isEntry(value: unknown): value is UsageEntry {
  if (value === null || typeof value !== 'object') return false;
  const e = value as Partial<UsageEntry>;
  return (
    typeof e.ts === 'number' &&
    typeof e.provider === 'string' &&
    typeof e.model === 'string' &&
    typeof e.inputTokens === 'number' &&
    typeof e.outputTokens === 'number'
  );
}

export function writeUsage(path: string, file: UsageFile): void {
  mkdirSync(dirname(path), { recursive: true });
  const tmp = `${path}.tmp`;
  writeFileSync(tmp, `${JSON.stringify(file)}\n`, 'utf8');
  renameSync(tmp, path);
}

export function appendUsage(path: string, entry: UsageEntry): void {
  const file = readUsage(path);
  file.entries.push(entry);
  if (file.entries.length > MAX_ENTRIES) file.entries.splice(0, file.entries.length - MAX_ENTRIES);
  writeUsage(path, file);
}

export function usageKey(provider: string, model: string): string {
  return `${provider}/${model}`;
}

/** 一条记录的积分（按当前单价表折算；没配单价就是 0） */
export function entryCredits(entry: UsageEntry, rates: Record<string, number>): number {
  const rate = rates[usageKey(entry.provider, entry.model)] ?? 0;
  const tokens = entry.totalTokens ?? entry.inputTokens + entry.outputTokens;
  return (tokens / 1_000_000) * rate;
}

export interface UsageTotals {
  calls: number;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  credits: number;
  /** 没有拿到真实 usage、按字符估算的调用数 */
  estimatedCalls: number;
  /** 带图片的调用数 */
  imageCalls: number;
}

export function summarize(entries: UsageEntry[], rates: Record<string, number>): UsageTotals {
  const totals: UsageTotals = {
    calls: 0,
    inputTokens: 0,
    outputTokens: 0,
    totalTokens: 0,
    credits: 0,
    estimatedCalls: 0,
    imageCalls: 0,
  };
  for (const entry of entries) {
    totals.calls += 1;
    totals.inputTokens += entry.inputTokens;
    totals.outputTokens += entry.outputTokens;
    totals.totalTokens += entry.totalTokens ?? entry.inputTokens + entry.outputTokens;
    totals.credits += entryCredits(entry, rates);
    if (entry.estimated === true) totals.estimatedCalls += 1;
    if ((entry.images ?? 0) > 0) totals.imageCalls += 1;
  }
  return totals;
}

export function localDay(ts: number): string {
  const d = new Date(ts);
  const pad = (n: number): string => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function currentMonth(): string {
  return localDay(Date.now()).slice(0, 7);
}
