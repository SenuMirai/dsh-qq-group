/**
 * 群记忆：最近谁说了什么、她回过什么。
 *
 * ── 分工 ──
 * 这里只管**群聊上下文**（进模型的那几十条）。长期人设仍走现有的 `persona.json`，
 * 与桌宠的聊天记忆（`memory.json`）**不混用**：群聊里人多、话题跳，混进私聊记忆会让
 * 她对着陌生人提主人的事——那正好踩主人定的红线（不透露主人隐私）。
 *
 * ── 落盘 ──
 * `$DSH_HOME/dsh-whale-girl/qq-memory.json`：
 * ```json
 * { "groups": { "123456": { "turns": [ ... ], "updatedAt": 1690000000000 } } }
 * ```
 * 写入用「先写临时文件再 rename」，避免断电/被杀时留下半截 JSON（本项目在配置落盘上
 * 已经踩过 BOM 与半截文件的坑，见 docs/ROADMAP.md 坑 3）。
 */

import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

import type { Turn } from './types';

/** 每个群保留多少条（进上下文的切片另有上限） */
export const MAX_TURNS_PER_GROUP = 200;

/** 每个群保留多少个群 */
export const MAX_GROUPS = 100;

/** 一条记忆里的群记录 */
export interface GroupMemory {
  /** 群名（能拿到就存，面板显示用） */
  name?: string;
  /** 被挤出上下文的旧记录压缩成的一段摘要（提取式，不含模型调用） */
  summary?: string;
  /** 按时间正序 */
  turns: Turn[];
  updatedAt: number;
}

/** 记忆文件结构 */
export interface MemoryFile {
  version: 1;
  groups: Record<string, GroupMemory>;
}

/** 空记忆 */
export function emptyMemory(): MemoryFile {
  return { version: 1, groups: {} };
}

/** 取某个群的记忆（不存在就建一个） */
export function groupMemory(memory: MemoryFile, groupId: string): GroupMemory {
  const existing = memory.groups[groupId];
  if (existing !== undefined) return existing;
  const created: GroupMemory = { turns: [], updatedAt: Date.now() };
  memory.groups[groupId] = created;
  return created;
}

/**
 * 追加一条记录，并做容量控制。
 * @returns 被挤掉的群（用于日志），没有则 undefined
 */
export function appendTurn(
  memory: MemoryFile,
  groupId: string,
  turn: Turn,
  options: { maxTurns?: number; maxGroups?: number } = {},
): string | undefined {
  const limit = options.maxTurns ?? MAX_TURNS_PER_GROUP;
  const group = groupMemory(memory, groupId);
  group.turns.push(turn);
  if (group.turns.length > limit) {
    const removed = group.turns.splice(0, group.turns.length - limit);
    if (removed.length > 0) {
      const text = removed
        .map((item) => `${item.role === 'user' ? item.name : '她'}：${item.text.slice(0, 40)}`)
        .join('；');
      group.summary = `${group.summary === undefined || group.summary === '' ? '' : `${group.summary}；`}${text}`.slice(-1200);
    }
  }
  group.updatedAt = turn.ts;
  return trimGroups(memory, options.maxGroups ?? MAX_GROUPS);
}

/** 群数量超限时淘汰最久没动的群 */
export function trimGroups(memory: MemoryFile, limit = MAX_GROUPS): string | undefined {
  const ids = Object.keys(memory.groups);
  if (ids.length <= limit) return undefined;
  const sorted = ids.sort((a, b) => (memory.groups[a]?.updatedAt ?? 0) - (memory.groups[b]?.updatedAt ?? 0));
  let dropped: string | undefined;
  while (Object.keys(memory.groups).length > limit) {
    const victim = sorted.shift();
    if (victim === undefined) break;
    delete memory.groups[victim];
    dropped = victim;
  }
  return dropped;
}

/** 取最近 limit 条记录（时间正序） */
export function recentTurns(group: GroupMemory | undefined, limit: number): Turn[] {
  if (group === undefined || limit <= 0) return [];
  const turns = group.turns;
  return turns.length <= limit ? [...turns] : turns.slice(turns.length - limit);
}

/**
 * 把记录拼成给模型看的聊天记录。
 *
 * @param turns 时间正序
 * @param selfName 她自己的名字（assistant 行的前缀）
 * @param now 当前时间（给每行标相对时间，模型才知道「刚才 / 半小时前」）
 */
export function transcript(turns: Turn[], selfName: string, now: number): string {
  return turns
    .map((turn) => {
      const who = turn.role === 'user' ? turn.name : selfName;
      const stamp = relativeTime(turn.ts, now);
      return `[${stamp}] ${who}：${turn.text}`;
    })
    .join('\n');
}

/** 相对时间：刚刚 / N 分钟前 / N 小时前 / N 天前 */
export function relativeTime(then: number, now: number): string {
  const delta = Math.max(0, now - then);
  if (delta < 60_000) return '刚刚';
  if (delta < 3_600_000) return `${Math.floor(delta / 60_000)} 分钟前`;
  if (delta < 86_400_000) return `${Math.floor(delta / 3_600_000)} 小时前`;
  return `${Math.floor(delta / 86_400_000)} 天前`;
}

/** 从任意输入里读记忆文件；文件不存在/坏了都返回空记忆（并报告是否重建） */
export function readMemoryFile(path: string): { memory: MemoryFile; problem?: string } {
  let raw: string;
  try {
    raw = readFileSync(path, 'utf8');
  } catch (e) {
    const code = (e as NodeJS.ErrnoException).code;
    if (code === 'ENOENT') return { memory: emptyMemory() };
    return { memory: emptyMemory(), problem: `读取记忆文件失败：${e instanceof Error ? e.message : String(e)}` };
  }
  try {
    const parsed = JSON.parse(raw.replace(/^\uFEFF/, '')) as Partial<MemoryFile>;
    if (parsed === null || typeof parsed !== 'object' || typeof parsed.groups !== 'object' || parsed.groups === null) {
      return { memory: emptyMemory(), problem: '记忆文件结构不对（没有 groups），已按空记忆启动' };
    }
    const groups: Record<string, GroupMemory> = {};
    for (const [groupId, group] of Object.entries(parsed.groups as Record<string, unknown>)) {
      const g = group as Partial<GroupMemory>;
      if (!Array.isArray(g.turns)) continue;
      groups[groupId] = {
        name: typeof g.name === 'string' ? g.name : undefined,
        summary: typeof g.summary === 'string' ? g.summary : undefined,
        turns: g.turns.filter(isTurn).slice(-MAX_TURNS_PER_GROUP),
        updatedAt: typeof g.updatedAt === 'number' ? g.updatedAt : Date.now(),
      };
    }
    return { memory: { version: 1, groups } };
  } catch (e) {
    return { memory: emptyMemory(), problem: `记忆文件不是合法 JSON（${e instanceof Error ? e.message : String(e)}），已按空记忆启动` };
  }
}

function isTurn(value: unknown): value is Turn {
  if (value === null || typeof value !== 'object') return false;
  const t = value as Partial<Turn>;
  return (t.role === 'user' || t.role === 'assistant') && typeof t.text === 'string' && typeof t.ts === 'number';
}

/** 原子写：先写 .tmp 再 rename（Windows 上 rename 覆盖是原子的） */
export function writeMemoryFile(path: string, memory: MemoryFile): void {
  mkdirSync(dirname(path), { recursive: true });
  const tmp = `${path}.tmp`;
  writeFileSync(tmp, `${JSON.stringify(memory)}\n`, 'utf8');
  renameSync(tmp, path);
}

/** 构造记忆文件路径 */
export function memoryPath(userRoot: string): string {
  return join(userRoot, 'qq-memory.json');
}
