/**
 * 群成员画像：熟识度（慢变量）+ 好感度（快变量）。
 *
 * 熟识度：每天有效发言最多 +4，每天首次 +2；14 天不来，每周 -1。
 * 好感度：她回你 / 你接她的话 / 引用她都会涨，有每日上限；被模型判定
 * 明确怼她、嘲讽、辱骂时 -2/-4；7 天不互动，每周向 0 靠拢 1 点。
 * 主人初始 +60，白名单初始 +20。
 *
 * 只影响她**主不主动、语气怎样**，不影响「@ 她必须回」。
 * 数据按 群 + QQ 存：`$DSH_HOME/dsh-qq-group/profiles.json`
 */

import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

const DAY = 24 * 60 * 60_000;
const WEEK = 7 * DAY;

export interface DayStats {
  day: string;
  messages: number;
  famGain: number;
  mentionGain: number;
  replyGain: number;
  affGain: number;
}

export interface UserProfile {
  qq: string;
  name: string;
  /** 熟识度 0~100 */
  familiarity: number;
  /** 好感度 -100~100 */
  affinity: number;
  messages: number;
  mentions: number;
  replies: number;
  /** 来过的日期（YYYY-MM-DD，最多留 60 天） */
  days: string[];
  lastSeen: number;
  /** 当天内的增量，用于每日上限 */
  dayStats?: DayStats;
  /** 上次结算衰减的时间，避免重复扣 */
  decayedThrough?: number;
  /** 是否已按主人/白名单初始化过初始好感 */
  seeded?: boolean;
}

export interface ProfileGroup {
  users: Record<string, UserProfile>;
}

export interface ProfileFile {
  version: 1;
  groups: Record<string, ProfileGroup>;
}

const MAX_USERS_PER_GROUP = 200;

export function emptyProfiles(): ProfileFile {
  return { version: 1, groups: {} };
}

const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));

export function readProfiles(path: string): ProfileFile {
  try {
    const parsed = JSON.parse(readFileSync(path, 'utf8').replace(/^\uFEFF/, '')) as Partial<ProfileFile>;
    if (parsed === null || typeof parsed !== 'object' || typeof parsed.groups !== 'object' || parsed.groups === null) {
      return emptyProfiles();
    }
    const groups: Record<string, ProfileGroup> = {};
    for (const [groupId, group] of Object.entries(parsed.groups as Record<string, unknown>)) {
      const usersRaw = (group as { users?: unknown })?.users;
      if (usersRaw === null || typeof usersRaw !== 'object') continue;
      const users: Record<string, UserProfile> = {};
      for (const [qq, raw] of Object.entries(usersRaw as Record<string, unknown>)) {
        const p = raw as Partial<UserProfile>;
        if (typeof p?.familiarity !== 'number') continue;
        users[qq] = {
          qq,
          name: typeof p.name === 'string' ? p.name : qq,
          familiarity: clamp(p.familiarity, 0, 100),
          affinity: clamp(typeof p.affinity === 'number' ? p.affinity : 0, -100, 100),
          messages: Math.max(0, Number(p.messages) || 0),
          mentions: Math.max(0, Number(p.mentions) || 0),
          replies: Math.max(0, Number(p.replies) || 0),
          days: Array.isArray(p.days) ? p.days.filter((d): d is string => typeof d === 'string').slice(-60) : [],
          lastSeen: typeof p.lastSeen === 'number' ? p.lastSeen : 0,
          ...(p.dayStats !== null && typeof p.dayStats === 'object' ? { dayStats: p.dayStats } : {}),
          ...(typeof p.decayedThrough === 'number' ? { decayedThrough: p.decayedThrough } : {}),
          ...(typeof p.seeded === 'boolean' ? { seeded: p.seeded } : {}),
        };
      }
      groups[groupId] = { users };
    }
    return { version: 1, groups };
  } catch {
    return emptyProfiles();
  }
}

export function writeProfiles(path: string, profiles: ProfileFile): void {
  mkdirSync(dirname(path), { recursive: true });
  const tmp = `${path}.tmp`;
  writeFileSync(tmp, `${JSON.stringify(profiles)}\n`, 'utf8');
  renameSync(tmp, path);
}

function today(): string {
  const now = new Date();
  const pad = (n: number): string => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

function dayStatsFor(profile: UserProfile, day: string): DayStats {
  if (profile.dayStats === undefined || profile.dayStats.day !== day) {
    profile.dayStats = { day, messages: 0, famGain: 0, mentionGain: 0, replyGain: 0, affGain: 0 };
  }
  return profile.dayStats;
}

/** 长期不互动：熟识度 14 天后每周 -1；好感度 7 天后每周向 0 靠拢 1 */
function applyDecay(profile: UserProfile, now: number): void {
  if (profile.lastSeen <= 0) return;
  const base = Math.max(profile.lastSeen, profile.decayedThrough ?? 0);
  const famStart = Math.max(base, profile.lastSeen + 14 * DAY);
  const famWeeks = Math.floor((now - famStart) / WEEK);
  if (famWeeks > 0 && profile.familiarity > 0) {
    // 14 天不来：每周 -10，最低保留 1（不会归零消失）
    profile.familiarity = Math.max(1, profile.familiarity - famWeeks * 10);
  }
  const affStart = Math.max(base, profile.lastSeen + 7 * DAY);
  const affWeeks = Math.floor((now - affStart) / WEEK);
  if (affWeeks > 0) {
    if (profile.affinity > 0) profile.affinity = clamp(profile.affinity - affWeeks, 0, 100);
    else if (profile.affinity < 0) profile.affinity = clamp(profile.affinity + affWeeks, -100, 0);
  }
  profile.decayedThrough = now;
}

/** 有人说话：熟识度慢涨（每天最多 +4），被点名额外 +1（每天最多 +3） */
export function touchUser(
  profiles: ProfileFile,
  groupId: string,
  qq: string,
  name: string,
  options: { mention?: boolean; initialAffinity?: number; now?: number } = {},
): UserProfile {
  const group = (profiles.groups[groupId] ??= { users: {} });
  const now = options.now ?? Date.now();
  let profile = group.users[qq];
  if (profile === undefined) {
    profile = {
      qq,
      name,
      familiarity: 0,
      affinity: 0,
      messages: 0,
      mentions: 0,
      replies: 0,
      days: [],
      lastSeen: 0,
    };
    group.users[qq] = profile;
  }
  applyDecay(profile, now);
  // 初次建立/旧数据补齐：主人 +60，白名单 +20
  if (profile.seeded !== true) {
    const initial = clamp(options.initialAffinity ?? 0, -100, 100);
    profile.affinity = Math.max(profile.affinity, initial);
    profile.seeded = true;
  }
  profile.name = name || profile.name;
  profile.lastSeen = now;
  profile.messages += 1;

  const day = today();
  const stats = dayStatsFor(profile, day);
  stats.messages += 1;
  const firstToday = stats.messages === 1;
  const remaining = Math.max(0, 4 - stats.famGain);
  const famGain = Math.min(firstToday ? 2 : 0.1, remaining);
  if (famGain > 0) {
    stats.famGain += famGain;
    profile.familiarity = clamp(profile.familiarity + famGain, 0, 100);
  }
  if (!profile.days.includes(day)) profile.days = [...profile.days.slice(-59), day];

  if (options.mention === true) {
    profile.mentions += 1;
    const mentionGain = Math.min(1, Math.max(0, 3 - stats.mentionGain));
    if (mentionGain > 0) {
      stats.mentionGain += mentionGain;
      profile.familiarity = clamp(profile.familiarity + mentionGain, 0, 100);
    }
  }

  const entries = Object.entries(group.users);
  if (entries.length > MAX_USERS_PER_GROUP) {
    entries.sort((a, b) => a[1].lastSeen - b[1].lastSeen);
    for (const [key] of entries.slice(0, entries.length - MAX_USERS_PER_GROUP)) delete group.users[key];
  }
  return profile;
}

/** 她回了这个人：熟识度 +0.5（每日上限 3），好感 +1（每日上限 5） */
export function noteReply(profiles: ProfileFile, groupId: string, qq: string): UserProfile | undefined {
  const profile = profiles.groups[groupId]?.users[qq];
  if (profile === undefined) return undefined;
  applyDecay(profile, Date.now());
  const stats = dayStatsFor(profile, today());
  const famGain = Math.min(0.5, Math.max(0, 3 - stats.replyGain));
  if (famGain > 0) {
    stats.replyGain += famGain;
    profile.familiarity = clamp(profile.familiarity + famGain, 0, 100);
  }
  const affGain = Math.min(1, Math.max(0, 5 - stats.affGain));
  if (affGain > 0) {
    stats.affGain += affGain;
    profile.affinity = clamp(profile.affinity + affGain, -100, 100);
  }
  profile.replies += 1;
  return profile;
}

/** 你接了她的话（5 分钟内）：好感 +2（每日上限 6） */
export function noteContinuation(profiles: ProfileFile, groupId: string, qq: string): UserProfile | undefined {
  const profile = profiles.groups[groupId]?.users[qq];
  if (profile === undefined) return undefined;
  applyDecay(profile, Date.now());
  const stats = dayStatsFor(profile, today());
  const gain = Math.min(2, Math.max(0, 6 - stats.affGain));
  if (gain > 0) {
    stats.affGain += gain;
    profile.affinity = clamp(profile.affinity + gain, -100, 100);
  }
  return profile;
}

/** 引用回复她：好感 +1（计入每日好感上限） */
export function noteQuote(profiles: ProfileFile, groupId: string, qq: string): UserProfile | undefined {
  const profile = profiles.groups[groupId]?.users[qq];
  if (profile === undefined) return undefined;
  applyDecay(profile, Date.now());
  const stats = dayStatsFor(profile, today());
  const gain = Math.min(1, Math.max(0, 5 - stats.affGain));
  if (gain > 0) {
    stats.affGain += gain;
    profile.affinity = clamp(profile.affinity + gain, -100, 100);
  }
  return profile;
}

/** 模型判定「在怼她」：severity 1 → -2，2 → -4 */
export function noteHostility(
  profiles: ProfileFile,
  groupId: string,
  qq: string,
  severity: number,
): UserProfile | undefined {
  const profile = profiles.groups[groupId]?.users[qq];
  if (profile === undefined) return undefined;
  applyDecay(profile, Date.now());
  const loss = severity >= 2 ? 4 : 2;
  profile.affinity = clamp(profile.affinity - loss, -100, 100);
  return profile;
}

export function getProfile(profiles: ProfileFile, groupId: string, qq: string): UserProfile | undefined {
  const profile = profiles.groups[groupId]?.users[qq];
  if (profile !== undefined) applyDecay(profile, Date.now());
  return profile;
}

export function listProfiles(profiles: ProfileFile, groupId: string): UserProfile[] {
  const users = profiles.groups[groupId]?.users ?? {};
  const now = Date.now();
  for (const profile of Object.values(users)) applyDecay(profile, now);
  return Object.values(users).sort((a, b) => b.familiarity - a.familiarity || b.affinity - a.affinity);
}
