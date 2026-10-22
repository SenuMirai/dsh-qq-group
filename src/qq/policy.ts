/**
 * 群聊策略：什么时候回、回几条、什么时候自己开口、没人理怎么降温。
 *
 * ── 这里全是纯函数 + 一个可注入时钟/随机的状态机 ──
 * 群里的行为是这套系统最容易翻车的地方（话多、刷屏、被冷落还硬凑），所以判定逻辑
 * 必须能在测试里把时间拨来拨去地验证，而不是「上线看看」。所有函数都接受 `now`
 * 与 `random` 参数，默认值就是真实时钟与 Math.random。
 *
 * ── 三条用户明确要的行为 ──
 * 1. **有人聊天 → 主动搭话**：不是每条都插嘴。收到人类消息后开始「去抖窗口」，
 *    窗口结束才掷一次概率，避免一口气连回十条。
 * 2. **一次发一条或多条**：由 `burst.min/max` 控制，概率偏向短的那头（话痨不至于刷屏）。
 * 3. **冷场主动说，越没人理越久**：`firstDelayMs × growth^ignored`，封顶 `maxDelayMs`；
 *    **任何人说话就重置**（`resetOnHuman`）。
 */

import type { GroupPolicy, ProactiveConfig } from './config';
import type { GroupMessage } from './types';

/** 一个群的记忆/状态（只留调度需要的东西） */
export interface GroupState {
  groupId: string;
  /** 最近一次**人类**说话的时间 */
  lastHumanAt?: number;
  /** 最近一次被直接对话（@/叫名字）的时间：用于「兴奋期」 */
  lastDirectAt?: number;
  /** 最近一次直接对话她的人（同一个人接着聊时更容易接） */
  lastDirectUser?: string;
  /** 最近一次她自己说话的时间（任何类型） */
  lastSelfAt?: number;
  /** 最近一次主动开口的时间 */
  lastProactiveAt?: number;
  /** 连续几次主动开口没人接 */
  ignoredProactive: number;
  /** 已排定的下一次主动开口时间（undefined = 还没排） */
  nextProactiveAt?: number;
  /** 最近的回复时间戳（10 分钟限流窗口用；只保留窗口内的） */
  replyTimes: number[];
  /** 最近的「直接对话」回复时间戳（@/叫名字/引用/接着聊） */
  directReplyTimes: number[];
  /** 当天主动开口次数（跨天清零） */
  proactiveDay: { day: string; count: number };
  /** 去抖窗口：第一句话到达后设定，窗口结束才决定要不要接 */
  pendingSince?: number;
  /** 窗口里攒了几个人类消息 */
  pendingCount: number;
}

/** 新建一个群状态 */
export function createGroupState(groupId: string): GroupState {
  return {
    groupId,
    ignoredProactive: 0,
    replyTimes: [],
    directReplyTimes: [],
    proactiveDay: { day: '', count: 0 },
    pendingCount: 0,
  };
}

/** 本地日期键（用于「一天最多几次」） */
export function dayKey(now: number): string {
  const date = new Date(now);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

/** 10 分钟限流窗口 */
export const RATE_WINDOW_MS = 10 * 60_000;

/**
 * 人类说了一句话之后，下一次主动开口要等多久。
 * @param proactive 配置
 * @param ignored 已经被无视了几次（0 = 刚有人理过）
 * @returns 毫秒；`ignored` 越大越久，封顶 `maxDelayMs`
 */
export function proactiveDelay(proactive: ProactiveConfig, ignored: number): number {
  const n = Math.max(0, Math.floor(ignored));
  const raw = proactive.firstDelayMs * Math.pow(proactive.growth, n);
  return Math.min(proactive.maxDelayMs, Math.max(0, Math.round(raw)));
}

/** 这次主动开口该说几条：**大多数时候一条**，偶尔多几条 */
export function planBurst(policy: GroupPolicy, random: () => number = Math.random): number {
  const min = Math.max(1, Math.round(policy.burst.min));
  const max = Math.max(min, Math.round(policy.burst.max));
  if (min === max) return min;
  // 平方偏置：random()² 让尾部的概率快速衰减。
  // 为什么不用「两次取最小」（三角分布）：实测下来 2 条反而最多（1 条只占 43%），
  // 与她「大多数时候一条、偶尔连发」的设定不符。平方偏置下 1 条占 50%、
  // 2 条 37%、3 条 13%——想调成更话痨就把指数调小。
  const biased = Math.pow(random(), 2);
  return min + Math.round(biased * (max - min));
}

/** 连发之间的间隔 */
export function burstGap(policy: GroupPolicy, random: () => number = Math.random): number {
  const [lo, hi] = policy.burst.gapMs;
  return lo + Math.round(random() * Math.max(0, hi - lo));
}

/**
 * 记录一条人类消息，并更新调度状态。
 *
 * 规则（按重要性排序）：
 * 1. 任何人类消息都刷新 `lastHumanAt`；
 * 2. 如果她上次是**主动开口**且之后没人说话，那么这条消息说明「有人接话了」→ 无视计数清零；
 *    即使没人接她、只是别的人在聊，也算「群里有活人」，同样清零（用户要求：有人说话就重置）；
 * 3. 重新排下一次主动开口（`resetOnHuman` 为真时按 0 次被无视算）。
 *
 * @returns 更新后的状态（原地修改并返回）
 */
export function observeHuman(
  state: GroupState,
  policy: GroupPolicy,
  now: number,
  options: { resetOnHuman?: boolean } = {},
): GroupState {
  const reset = options.resetOnHuman ?? policy.proactive.resetOnHuman;
  state.lastHumanAt = now;
  // 有人说话就算「群活着」：无论接的是不是她
  if (reset) state.ignoredProactive = 0;
  state.nextProactiveAt = now + proactiveDelay(policy.proactive, state.ignoredProactive);
  // 冷场计时从**最后一条**消息重新开始：有人说话就不算冷场
  state.pendingSince = now;
  state.pendingCount += 1;
  return state;
}

/** 她开口之后的账：主动开口且是「这一轮最后一次」时调用，记一次可能被无视 */
export function noteSelfSpoke(
  state: GroupState,
  policy: GroupPolicy,
  now: number,
  kind: 'reply' | 'proactive',
  options: { direct?: boolean } = {},
): GroupState {
  state.lastSelfAt = now;
  state.replyTimes.push(now);
  // 只保留窗口内的，避免数组无限增长
  const cutoff = now - RATE_WINDOW_MS;
  state.replyTimes = state.replyTimes.filter((t) => t >= cutoff);
  if (options.direct === true) {
    state.directReplyTimes.push(now);
    state.directReplyTimes = state.directReplyTimes.filter((t) => t >= cutoff);
  }

  if (kind === 'proactive') {
    state.lastProactiveAt = now;
    const day = dayKey(now);
    if (state.proactiveDay.day !== day) state.proactiveDay = { day, count: 0 };
    state.proactiveDay.count += 1;
    // 先按「这次也被无视」排下一次；真有人接话时 observeHuman 会把计数清零并重排
    state.ignoredProactive += 1;
    state.nextProactiveAt = now + proactiveDelay(policy.proactive, state.ignoredProactive);
  }
  return state;
}

/** 限流判定 */
export interface RateVerdict {
  allowed: boolean;
  /** 不允许时的原因（写日志用） */
  reason?: 'cooldown' | 'window-limit';
  /** 还要等多久（毫秒） */
  waitMs?: number;
}

/** 冷却与窗口限流：两条都过了才允许说话；直接对话可忽略冷却 */
export function rateVerdict(
  state: GroupState,
  policy: GroupPolicy,
  now: number,
  options: { ignoreCooldown?: boolean; direct?: boolean } = {},
): RateVerdict {
  if (options.ignoreCooldown !== true && state.lastSelfAt !== undefined) {
    const since = now - state.lastSelfAt;
    if (since < policy.cooldownMs) {
      return { allowed: false, reason: 'cooldown', waitMs: policy.cooldownMs - since };
    }
  }
  if (options.direct === true) {
    // 直接对话不占普通插话的 10 分钟额度，只受一个更高的直接回复上限约束
    if (policy.maxDirectRepliesPer10Min > 0) {
      const cutoff = now - RATE_WINDOW_MS;
      const recentDirect = state.directReplyTimes.filter((t) => t >= cutoff).length;
      if (recentDirect >= policy.maxDirectRepliesPer10Min) {
        const oldest = state.directReplyTimes.filter((t) => t >= cutoff).sort((a, b) => a - b)[0];
        const waitMs = oldest === undefined ? policy.cooldownMs : oldest + RATE_WINDOW_MS - now;
        return { allowed: false, reason: 'window-limit', waitMs: Math.max(0, waitMs) };
      }
    }
    return { allowed: true };
  }
  if (policy.maxRepliesPer10Min > 0) {
    const cutoff = now - RATE_WINDOW_MS;
    const recent = state.replyTimes.filter((t) => t >= cutoff).length;
    if (recent >= policy.maxRepliesPer10Min) {
      // 等到最早那条滑出窗口
      const oldest = state.replyTimes.filter((t) => t >= cutoff).sort((a, b) => a - b)[0];
      const waitMs = oldest === undefined ? policy.cooldownMs : oldest + RATE_WINDOW_MS - now;
      return { allowed: false, reason: 'window-limit', waitMs: Math.max(0, waitMs) };
    }
  }
  return { allowed: true };
}

/** 一条消息值不值得接 */
export type TriggerKind = 'at' | 'call' | 'chat' | 'none';

/**
 * 判断这条消息触发哪种反应。
 *
 * 优先级：被 @ > 叫名字 > （去抖窗口结束后的）闲聊插话。
 * @param botName 机器人在群里的名字（配置的 selfName，可以逗号分隔多个）
 */
export function classifyTrigger(message: GroupMessage, policy: GroupPolicy, botName: string): TriggerKind {
  if (!policy.enabled) return 'none';
  if (message.atSelf && policy.replyOnAt) return 'at';
  if (policy.replyOnName && mentionedByName(message.text, botName)) return 'call';
  if (policy.activeChat && hasSubstantiveText(message.text)) return 'chat';
  return 'none';
}

/**
 * 去掉 [图片]/[表情]/[语音] 这类占位标记后，是否还有真正的文字。
 * 只有图片/表情、没有文字的消息不触发闲聊接话；@ / 叫名字 / 引用她仍然会回。
 */
export function hasSubstantiveText(text: string): boolean {
  const stripped = text
    .replace(/\[[^\]]*\]/g, '')
    .replace(/@\S+/g, '')
    .replace(/\s+/g, '')
    .trim();
  return stripped.length > 0;
}

/** 群友是否在明确让她看/评价图片（仅在消息真的带图时使用） */
export function asksToSeeImage(text: string): boolean {
  const value = text.trim();
  if (value === '') return false;
  const mentionsImage = /图|图片|照片|截图|表情包|画面|这张|这个|这猫|这狗|这画|这人|你|您|妳|尾巴|耳朵|鱼尾/.test(value);
  const asks = /看看|看一下|看下|瞅瞅|瞧瞧|评价|觉得|可爱|好看|怎么样|如何|是什么|啥|谁|认得出|看得见/.test(value);
  return mentionsImage && asks;
}

/** 群友是否在明确要求她发图/发表情包 */
export function asksToSendImage(text: string): boolean {
  const value = text.trim();
  if (value === '') return false;
  return (
    /(?:发|来|整|给|丢|甩|上)(?:一|个|张|点|些|两)?[^，。！？\n]{0,8}(?:图|图片|照片|表情包|表情|动图|gif)/i.test(value) ||
    /(?:图|图片|照片|表情包|表情).{0,4}(?:发|来|整|给|丢|甩)/.test(value) ||
    /斗图/.test(value)
  );
}

/**
 * 是否在要求看她本人/尾巴/耳朵/自拍。
 * 只在消息没有附图时使用；有图时优先按“看这张图”处理。
 */
export function asksForSelfie(text: string, extraKeywords: readonly string[] = []): boolean {
  const value = text.trim();
  if (value === '') return false;
  const extra = extraKeywords.some((word) => word !== '' && value.includes(word));
  const refersToHer =
    /你|您|妳|鲸鱼|大肥鱼|尾巴|耳朵|鱼尾|头发|脸|眼睛|衣服|裙子|自拍|照|长什么样|长啥样/.test(value) || extra;
  const asks = /看看|看一下|看下|露一下|展示|发|来|拍|爆|整/.test(value);
  return refersToHer && asks;
}

/** 文本里有没有叫到她的名字（支持多个名字，逗号/顿号/斜杠分隔） */
export function mentionedByName(text: string, botName: string): boolean {
  const names = botName
    .split(/[,，、/|\s]+/)
    .map((n) => n.trim())
    .filter((n) => n !== '');
  return names.some((name) => text.includes(name));
}

/** 去抖窗口：一个人说完一句，等这么久看还有没有人接着说（有就继续等） */
export const CHAT_DEBOUNCE_MS = 6_000;

/**
 * 去抖窗口是否已经结束（可以决定要不要插话了）。
 * 每来一条人类消息，`observeHuman` 都会把 `pendingSince` 重置到最新时间，
 * 也就是「等这一波彻底安静 6 秒」再决定，而不是从第一句开始计时。
 */
export function chatWindowElapsed(state: GroupState, now: number): boolean {
  if (state.pendingSince === undefined) return false;
  return now - state.pendingSince >= CHAT_DEBOUNCE_MS;
}

/** 清掉去抖窗口（决定完就清，等下一次有人说话重新开窗） */
export function clearChatWindow(state: GroupState): void {
  state.pendingSince = undefined;
  state.pendingCount = 0;
}

/** 冷场判定结果 */
export interface ProactiveVerdict {
  fire: boolean;
  /** 不触发时的原因（诊断用） */
  reason?: 'disabled' | 'not-scheduled' | 'too-soon' | 'not-idle' | 'daily-cap' | 'cooldown' | 'busy';
  /** 还有多久（毫秒） */
  waitMs?: number;
}

/**
 * 现在该不该主动开口。
 *
 * 四道闸：开关 → 排定时间到没到 → 冷场够不够久 → 当天次数/冷却。
 * 「冷场够不够久」与「排定时间」是**两条不同的线**：前者防止在别人正聊天时插话，
 * 后者负责「越没人理越久」的退避。两条都过才开口。
 */
export function proactiveVerdict(
  state: GroupState,
  policy: GroupPolicy,
  now: number,
  options: { busy?: boolean } = {},
): ProactiveVerdict {
  const cfg = policy.proactive;
  if (!cfg.enabled) return { fire: false, reason: 'disabled' };
  if (!policy.enabled) return { fire: false, reason: 'disabled' };
  if (options.busy === true) return { fire: false, reason: 'busy' };

  // 从没人说过话的群不主动开口：那是冷启动，得先有人搭理才轮到它装熟
  if (state.lastHumanAt === undefined) return { fire: false, reason: 'not-scheduled' };

  // 冷场够不够久：这条闸要**先**判，它才是「现在能不能开口」的物理条件。
  // 排定时间不再信任一个可能过期的 nextProactiveAt，而是**每次都用
  // 「最后一条人类消息 / 最后一次主动开口」重新算**：
  // 任何新消息都会把冷场时钟重置，不会继续沿用之前的等待。
  const idle = now - (state.lastHumanAt ?? now);
  if (idle < cfg.minIdleMs) {
    return { fire: false, reason: 'not-idle', waitMs: cfg.minIdleMs - idle };
  }

  const base = Math.max(state.lastHumanAt, state.lastProactiveAt ?? 0);
  const scheduledAt = base + proactiveDelay(cfg, state.ignoredProactive);
  state.nextProactiveAt = scheduledAt;
  if (now < scheduledAt) {
    return { fire: false, reason: 'not-scheduled', waitMs: scheduledAt - now };
  }

  const day = dayKey(now);
  const usedToday = state.proactiveDay.day === day ? state.proactiveDay.count : 0;
  if (cfg.maxPerDay > 0 && usedToday >= cfg.maxPerDay) {
    return { fire: false, reason: 'daily-cap' };
  }

  const rate = rateVerdict(state, policy, now);
  if (!rate.allowed) return { fire: false, reason: 'cooldown', waitMs: rate.waitMs };

  return { fire: true };
}

/** 下一次该在什么时候检查（用于定时器规划：避免每秒空转） */
export function nextWakeup(state: GroupState, policy: GroupPolicy, now: number): number | undefined {
  const candidates: number[] = [];
  if (state.pendingSince !== undefined) candidates.push(state.pendingSince + CHAT_DEBOUNCE_MS);
  if (state.lastSelfAt !== undefined) candidates.push(state.lastSelfAt + policy.cooldownMs);
  if (policy.proactive.enabled && state.lastHumanAt !== undefined) {
    const base = Math.max(state.lastHumanAt, state.lastProactiveAt ?? 0);
    candidates.push(base + proactiveDelay(policy.proactive, state.ignoredProactive));
    candidates.push(state.lastHumanAt + policy.proactive.minIdleMs);
  }
  const future = candidates.filter((t) => t > now);
  if (future.length === 0) return undefined;
  return Math.min(...future);
}
