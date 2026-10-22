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
  /** v0.2.2：按项目分开的好感度日增量，便于独立上限 */
  replyAffGain?: number;
  continuationAffGain?: number;
  quoteAffGain?: number;
  hostilityLoss?: number;
}

/** 熟识度/好感度的全部增减规则；0 表示该项每日不设上限（初始值除外） */
export interface ProfileRules {
  firstMessageFam: number;
  repeatMessageFam: number;
  messageFamDailyCap: number;
  mentionFam: number;
  mentionFamDailyCap: number;
  replyFam: number;
  replyFamDailyCap: number;
  replyAffinity: number;
  replyAffinityDailyCap: number;
  continuationAffinity: number;
  continuationAffinityDailyCap: number;
  quoteAffinity: number;
  quoteAffinityDailyCap: number;
  hostilityMildLoss: number;
  hostilitySevereLoss: number;
  hostilityDailyCap: number;
  inactiveDaysBeforeFamDecay: number;
  famDecayPerWeek: number;
  famDecayFloor: number;
  inactiveDaysBeforeAffinityDecay: number;
  affinityDecayPerWeek: number;
  initialOwnerAffinity: number;
  initialWhitelistAffinity: number;
}

export const DEFAULT_PROFILE_RULES: ProfileRules = {
  firstMessageFam: 2,
  repeatMessageFam: 0.1,
  messageFamDailyCap: 4,
  mentionFam: 1,
  mentionFamDailyCap: 3,
  replyFam: 0.5,
  replyFamDailyCap: 3,
  replyAffinity: 1,
  replyAffinityDailyCap: 5,
  continuationAffinity: 2,
  continuationAffinityDailyCap: 6,
  quoteAffinity: 1,
  quoteAffinityDailyCap: 5,
  hostilityMildLoss: 2,
  hostilitySevereLoss: 4,
  hostilityDailyCap: 0,
  inactiveDaysBeforeFamDecay: 14,
  famDecayPerWeek: 10,
  famDecayFloor: 1,
  inactiveDaysBeforeAffinityDecay: 7,
  affinityDecayPerWeek: 1,
  initialOwnerAffinity: 60,
  initialWhitelistAffinity: 20,
};

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
    profile.dayStats = {
      day,
      messages: 0,
      famGain: 0,
      mentionGain: 0,
      replyGain: 0,
      affGain: 0,
      replyAffGain: 0,
      continuationAffGain: 0,
      quoteAffGain: 0,
      hostilityLoss: 0,
    };
  }
  const stats = profile.dayStats;
  stats.famGain = Number(stats.famGain) || 0;
  stats.mentionGain = Number(stats.mentionGain) || 0;
  stats.replyGain = Number(stats.replyGain) || 0;
  stats.affGain = Number(stats.affGain) || 0;
  stats.replyAffGain = Number(stats.replyAffGain) || 0;
  stats.continuationAffGain = Number(stats.continuationAffGain) || 0;
  stats.quoteAffGain = Number(stats.quoteAffGain) || 0;
  stats.hostilityLoss = Number(stats.hostilityLoss) || 0;
  return stats;
}

/** 当日上限：cap <= 0 = 不限；返回本次实际可加值 */
function cappedGain(value: number, cap: number, used: number): number {
  if (value <= 0) return 0;
  if (cap <= 0) return value;
  return Math.min(value, Math.max(0, cap - used));
}

/** 长期不互动：熟识度/好感度按规则衰减 */
function applyDecay(profile: UserProfile, now: number, rules: ProfileRules = DEFAULT_PROFILE_RULES): void {
  if (profile.lastSeen <= 0) return;
  const base = Math.max(profile.lastSeen, profile.decayedThrough ?? 0);
  const famDays = Math.max(0, rules.inactiveDaysBeforeFamDecay);
  const famStart = Math.max(base, profile.lastSeen + famDays * DAY);
  const famWeeks = Math.floor((now - famStart) / WEEK);
  if (famWeeks > 0 && profile.familiarity > 0 && rules.famDecayPerWeek > 0) {
    profile.familiarity = Math.max(
      Math.max(0, rules.famDecayFloor),
      profile.familiarity - famWeeks * rules.famDecayPerWeek,
    );
  }
  const affDays = Math.max(0, rules.inactiveDaysBeforeAffinityDecay);
  const affStart = Math.max(base, profile.lastSeen + affDays * DAY);
  const affWeeks = Math.floor((now - affStart) / WEEK);
  if (affWeeks > 0 && rules.affinityDecayPerWeek > 0) {
    if (profile.affinity > 0) profile.affinity = clamp(profile.affinity - affWeeks * rules.affinityDecayPerWeek, 0, 100);
    else if (profile.affinity < 0) profile.affinity = clamp(profile.affinity + affWeeks * rules.affinityDecayPerWeek, -100, 0);
  }
  profile.decayedThrough = now;
}

/** 有人说话：熟识度慢涨（每天最多 +4），被点名额外 +1（每天最多 +3） */
export function touchUser(
  profiles: ProfileFile,
  groupId: string,
  qq: string,
  name: string,
  options: { mention?: boolean; initialAffinity?: number; now?: number; rules?: ProfileRules } = {},
): UserProfile {
  const rules = options.rules ?? DEFAULT_PROFILE_RULES;
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
  applyDecay(profile, now, rules);
  // 初次建立/旧数据补齐：主人/白名单的初始好感由规则决定
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
  const famValue = firstToday ? rules.firstMessageFam : rules.repeatMessageFam;
  const famGain = cappedGain(famValue, rules.messageFamDailyCap, stats.famGain);
  if (famGain > 0) {
    stats.famGain += famGain;
    profile.familiarity = clamp(profile.familiarity + famGain, 0, 100);
  }
  if (!profile.days.includes(day)) profile.days = [...profile.days.slice(-59), day];

  if (options.mention === true) {
    profile.mentions += 1;
    const mentionGain = cappedGain(rules.mentionFam, rules.mentionFamDailyCap, stats.mentionGain);
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

/** 她回了这个人 */
export function noteReply(
  profiles: ProfileFile,
  groupId: string,
  qq: string,
  rules: ProfileRules = DEFAULT_PROFILE_RULES,
): UserProfile | undefined {
  const profile = profiles.groups[groupId]?.users[qq];
  if (profile === undefined) return undefined;
  applyDecay(profile, Date.now(), rules);
  const stats = dayStatsFor(profile, today());
  const famGain = cappedGain(rules.replyFam, rules.replyFamDailyCap, stats.replyGain);
  if (famGain > 0) {
    stats.replyGain += famGain;
    profile.familiarity = clamp(profile.familiarity + famGain, 0, 100);
  }
  const affGain = cappedGain(rules.replyAffinity, rules.replyAffinityDailyCap, stats.replyAffGain ?? 0);
  if (affGain > 0) {
    stats.replyAffGain = (stats.replyAffGain ?? 0) + affGain;
    stats.affGain += affGain;
    profile.affinity = clamp(profile.affinity + affGain, -100, 100);
  }
  profile.replies += 1;
  return profile;
}

/** 你接了她的话（5 分钟内） */
export function noteContinuation(
  profiles: ProfileFile,
  groupId: string,
  qq: string,
  rules: ProfileRules = DEFAULT_PROFILE_RULES,
): UserProfile | undefined {
  const profile = profiles.groups[groupId]?.users[qq];
  if (profile === undefined) return undefined;
  applyDecay(profile, Date.now(), rules);
  const stats = dayStatsFor(profile, today());
  const gain = cappedGain(rules.continuationAffinity, rules.continuationAffinityDailyCap, stats.continuationAffGain ?? 0);
  if (gain > 0) {
    stats.continuationAffGain = (stats.continuationAffGain ?? 0) + gain;
    stats.affGain += gain;
    profile.affinity = clamp(profile.affinity + gain, -100, 100);
  }
  return profile;
}

/** 引用回复她 */
export function noteQuote(
  profiles: ProfileFile,
  groupId: string,
  qq: string,
  rules: ProfileRules = DEFAULT_PROFILE_RULES,
): UserProfile | undefined {
  const profile = profiles.groups[groupId]?.users[qq];
  if (profile === undefined) return undefined;
  applyDecay(profile, Date.now(), rules);
  const stats = dayStatsFor(profile, today());
  const gain = cappedGain(rules.quoteAffinity, rules.quoteAffinityDailyCap, stats.quoteAffGain ?? 0);
  if (gain > 0) {
    stats.quoteAffGain = (stats.quoteAffGain ?? 0) + gain;
    stats.affGain += gain;
    profile.affinity = clamp(profile.affinity + gain, -100, 100);
  }
  return profile;
}

/** 模型判定「在怼她」 */
export function noteHostility(
  profiles: ProfileFile,
  groupId: string,
  qq: string,
  severity: number,
  rules: ProfileRules = DEFAULT_PROFILE_RULES,
): UserProfile | undefined {
  const profile = profiles.groups[groupId]?.users[qq];
  if (profile === undefined) return undefined;
  applyDecay(profile, Date.now(), rules);
  const stats = dayStatsFor(profile, today());
  const baseLoss = severity >= 2 ? rules.hostilitySevereLoss : rules.hostilityMildLoss;
  const loss = cappedGain(baseLoss, rules.hostilityDailyCap, stats.hostilityLoss ?? 0);
  if (loss > 0) {
    stats.hostilityLoss = (stats.hostilityLoss ?? 0) + loss;
    profile.affinity = clamp(profile.affinity - loss, -100, 100);
  }
  return profile;
}

export function getProfile(
  profiles: ProfileFile,
  groupId: string,
  qq: string,
  rules: ProfileRules = DEFAULT_PROFILE_RULES,
): UserProfile | undefined {
  const profile = profiles.groups[groupId]?.users[qq];
  if (profile !== undefined) applyDecay(profile, Date.now(), rules);
  return profile;
}

export function listProfiles(
  profiles: ProfileFile,
  groupId: string,
  rules: ProfileRules = DEFAULT_PROFILE_RULES,
): UserProfile[] {
  const users = profiles.groups[groupId]?.users ?? {};
  const now = Date.now();
  for (const profile of Object.values(users)) applyDecay(profile, now, rules);
  return Object.values(users).sort((a, b) => b.familiarity - a.familiarity || b.affinity - a.affinity);
}
