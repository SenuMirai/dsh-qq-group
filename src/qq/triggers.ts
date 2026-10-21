/**
 * 接话价值评分（0~100）+ 概率 + 闸门候选。
 *
 * 旧逻辑是「每条消息一个概率」，会被一句无关的话钓走，也不会区分
 * 「在跟她说」和「只是聊到她」。现在先算一个可解释的分数：
 *
 *   直接 @ / 叫名字 / 引用她 → bridge 直接回，不进这里
 *   其他消息 → 基础分 + 关键词/成员 + 是否同一人接着聊 + 熟识度/好感度
 *              − @ 了别人 − 被冷落 − 深夜 − 单条消息
 *   白名单：分数至少抬到 floor；黑名单：分数最多压到 ceil
 *   分数 ≥ scoreThreshold 才进入候选，真正概率 = 分数/100，再过 LLM 闸门
 *
 * 所有分项都写进 reason，日志里能看出「为什么这次开口/闭嘴」。
 */

import type { GroupPolicy } from './config';
import type { GroupState } from './policy';
import type { UserProfile } from './profiles';

export type SpeakKind = 'keyword' | 'member' | 'engaged' | 'ambient' | 'none';

export type SpeakDecision = {
  speak: boolean;
  kind: SpeakKind;
  /** 真正拿去掷的概率（0~1），等于分数/100 */
  chance: number;
  /** 价值评分 0~100 */
  score: number;
  /** 分项理由（日志/日记用） */
  reasons: string[];
  reason: string;
  matched?: string;
  directish?: boolean;
};

/** 列表与作息等插件级规则 */
export type ScoreRules = {
  /** 是不是主人（主人初始好感 +60） */
  owner: boolean;
  whitelist: boolean;
  blacklist: boolean;
  whitelistFloor: number;
  blacklistCeil: number;
  night: boolean;
  /** 夜间命中时扣多少分（0 = 不扣，但仍标记命中） */
  nightPenalty: number;
};

/** 关键词匹配：中文直接包含；纯英文按单词边界（避免 "ai" 命中 "said"） */
function textHasKeyword(text: string, keyword: string): boolean {
  const lowered = text.toLowerCase();
  const word = keyword.toLowerCase().trim();
  if (word === '') return false;
  if (/^[a-z0-9][a-z0-9 _.-]*$/.test(word)) {
    const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`).test(lowered);
  }
  return lowered.includes(word);
}

export function matchKeyword(
  texts: readonly string[],
  policy: GroupPolicy,
): { word: string; chance: number } | undefined {
  const entries = Object.entries(policy.keywordChances).sort((a, b) => b[0].length - a[0].length);
  for (const [word, chance] of entries) {
    if (texts.some((text) => textHasKeyword(text, word))) return { word, chance };
  }
  return undefined;
}

export function matchMember(userId: string, policy: GroupPolicy): number | undefined {
  if (userId === '') return undefined;
  return policy.memberChances[userId];
}

const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));

/**
 * 算这一波闲聊的价值分，并给出是否开口。
 *
 * @param texts 这一波（去抖窗口内）攒下的消息
 * @param profile 最后说话那个人的画像（熟识度/好感度）
 * @param rules 白/黑名单与夜间免打扰
 * @param atOther 这一波有没有 @ 别人
 */
export function decideSpeak(input: {
  state: GroupState;
  policy: GroupPolicy;
  texts: readonly string[];
  userId?: string;
  atOther?: boolean;
  replyOther?: boolean;
  profile?: Pick<UserProfile, 'familiarity' | 'affinity'>;
  rules?: ScoreRules;
  now: number;
}): SpeakDecision {
  const { state, policy, texts, now } = input;
  const reasons: string[] = [];
  if (texts.length === 0) {
    return { speak: false, kind: 'none', chance: 0, score: 0, reasons: ['这一波没有消息'], reason: '这一波没有消息' };
  }

  let score = 30;
  let kind: SpeakKind = 'ambient';
  let matched: string | undefined;
  let directish = false;
  reasons.push('基础 30');

  const keyword = matchKeyword(texts, policy);
  const member = input.userId === undefined ? undefined : matchMember(input.userId, policy);
  if (keyword !== undefined) {
    const bonus = Math.round(keyword.chance * 50);
    score += bonus;
    kind = 'keyword';
    matched = keyword.word;
    reasons.push(`提到「${keyword.word}」+${bonus}`);
  }
  if (member !== undefined) {
    const bonus = Math.round(member * 50);
    if (bonus > (keyword === undefined ? 0 : Math.round(keyword.chance * 50))) {
      score += bonus - (keyword === undefined ? 0 : Math.round(keyword.chance * 50));
      kind = 'member';
      reasons.push(`指定成员 +${bonus}`);
    }
  }

  const sameSpeaker = state.lastDirectUser !== undefined && input.userId === state.lastDirectUser;
  const secondPerson = /[你您妳]/.test(texts.join('\n'));
  const engagedMs = policy.engageMinutes * 60_000;
  if (state.lastDirectAt !== undefined && now - state.lastDirectAt < engagedMs) {
    if (sameSpeaker) {
      score += 30;
      reasons.push('刚跟她聊过的人接着说 +30');
      // 她刚回过这个人、对方几分钟内接着说：默认这就是在接着聊
      if (state.lastSelfAt !== undefined && now - state.lastSelfAt < 5 * 60_000) {
        score += 20;
        reasons.push('接着她刚才的话 +20');
        // 几分钟内同一个人接着说、没有 @/引用别人：按「还在跟她聊」处理，跳过闸门
        if (input.atOther !== true && input.replyOther !== true) {
          directish = true;
          score += 10;
          reasons.push('连续对话，直接接 +10');
        }
      }
    }
    if (secondPerson) {
      score += 15;
      reasons.push('话里带「你」+15');
    }
    if (kind === 'ambient') kind = 'engaged';
  }

  if (input.atOther === true) {
    score -= 30;
    reasons.push('@ 了别人 -30');
  }
  if (input.replyOther === true) {
    score -= 25;
    reasons.push('引用别人 -25');
  }

  if (input.profile !== undefined) {
    const fam = Math.round((clamp(input.profile.familiarity, 0, 100) / 100) * 8);
    if (fam !== 0) {
      score += fam;
      reasons.push(`熟识度 +${fam}`);
    }
    const aff = Math.round((clamp(input.profile.affinity, -100, 100) / 100) * 10);
    if (aff !== 0) {
      score += aff;
      reasons.push(`好感度 ${aff > 0 ? '+' : ''}${aff}`);
    }
  }

  const ignored = Math.min(4, Math.max(0, state.ignoredProactive));
  if (ignored > 0) {
    score -= ignored * 8;
    reasons.push(`被冷落 ${ignored} 次 -${ignored * 8}`);
  }
  if (input.rules?.night === true) {
    const penalty = Math.max(0, input.rules.nightPenalty);
    if (penalty > 0) {
      score -= penalty;
      reasons.push(`夜间免打扰 -${penalty}`);
    }
  }
  // 单条消息减半只对「纯闲聊」：接着跟她说的话通常就是一条，不能减半
  if (texts.length < 2 && kind === 'ambient') {
    score -= 5;
    reasons.push('单条消息 -5');
  }

  score = clamp(score, 0, 100);
  if (input.rules?.whitelist === true) {
    score = Math.max(score, input.rules.whitelistFloor);
    reasons.push(`白名单抬到 ${input.rules.whitelistFloor}`);
  }
  if (input.rules?.blacklist === true) {
    score = Math.min(score, input.rules.blacklistCeil);
    reasons.push(`黑名单压到 ${input.rules.blacklistCeil}`);
  }

  const threshold = policy.scoreThreshold;
  const chance = score / 100;
  const candidate = score >= threshold;
  const speak = candidate && Math.random() < chance;
  return {
    speak,
    kind,
    chance,
    score,
    reasons,
    reason: `${kind === 'ambient' ? '闲聊' : kind === 'engaged' ? '兴奋期' : kind === 'keyword' ? '关键词' : '成员'} 评分 ${score}/${threshold}（${reasons.join('；')}）`,
    ...(matched === undefined ? {} : { matched }),
    ...(directish ? { directish: true } : {}),
  };
}
