/**
 * dsh-qq-group —— 独立于桌宠的 QQ 群聊插件。
 *
 * 数据全部在 `$DSH_HOME/dsh-qq-group/`：
 *   qq.json        连接/群策略/语音/唱歌
 *   settings.json  人设、主动/被动、模型选择、表情包自动收藏
 *   qq-memory.json 群聊记忆
 *   diary.json     鲸鱼娘的日记（群聊 + 内心吐槽）
 *   stickers/      表情包池（自己收藏的 + 群友发的）
 *
 * 路由前缀 `/dsh-qq-group`；设置页由同包 client.js 挂到 settings.section。
 */

import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, statSync, unlinkSync, writeFileSync } from 'node:fs';
import { connect } from 'node:net';
import { homedir } from 'node:os';
import { basename, dirname, extname, join } from 'node:path';

import { BlockAssembler, createAssistantMessage, createUserMessage } from '@deepseek-ai/dsh-llm';
import type { GroupPolicy, QqConfig, QqRvcConfig } from './qq/config';
import type { DiaryEntry, ProfileStore } from './qq/bridge';
import type { ObSegment } from './qq/types';
import {
  createStickerHub,
  deleteStickers,
  listStickerInfo,
  listStickerRepos,
  moveStickers,
  stickerFile,
  stickerFolder,
  updateStickerMeta,
  updateStickerRepos,
} from './qq/stickers';
import {
  createSelfieHub,
  deleteSelfie,
  listSelfies,
  saveSelfie,
  selfieDir,
  selfieFile,
} from './qq/selfies';
import { DEFAULT_SCORE_WEIGHTS, type ScoreRules, type ScoreWeights } from './qq/triggers';
import { scanRvcModels } from './qq/rvc-models';
import { createCommandRvcConverter } from './sound/rvc';
import {
  getProfile,
  listProfiles,
  noteContinuation,
  noteHostility,
  noteQuote,
  noteReply as noteProfileReply,
  readProfiles,
  touchUser,
  writeProfiles,
  DEFAULT_PROFILE_RULES,
  type ProfileRules,
  type ProfileFile,
} from './qq/profiles';
import { createQqHost, qqConfigPath, readQqConfig } from './qq-host';
import { Speaker, describeFailure } from './sound/tts';
import { encodeWave } from './sound/wav';
import {
  appendUsage,
  currentMonth,
  entryCredits,
  localDay,
  readUsage,
  summarize,
  usageKey,
  type UsageEntry,
} from './qq/usage';

export const name = 'dsh-qq-group';
export const inject = ['webServer', 'llm', 'agentDefaultModel'];

type ModelRef = { provider: string; model: string };
type Settings = {
  persona: string;
  mode: 'passive' | 'proactive';
  model: ModelRef;
  /** 备用模型：主模型只回 reasoning / 空回复时切一次 */
  fallbackModel: ModelRef;
  /** 推理档位（空 = 跟随模型默认；具体档位来自模型能力） */
  reasoningEffort: string;
  /** 每个 provider/model 的上下文窗口覆盖（tokens；0/缺省 = 跟随模型能力） */
  contextWindows: Record<string, number>;
  /** 自动收藏群友发的图片/表情包 */
  stickerSave: boolean;
  /** 入库过滤：smart = 只收像表情包的；all = 所有图都进暂存区 */
  stickerFilter: 'smart' | 'all';
  /** 新图默认放哪个仓库 */
  stickerSaveRepo: string;
  /** 入库后是否自动让模型猜含义（默认关，省 token） */
  stickerAnalyzeOnSave: boolean;
  /** 表情包仓库最多保留多少张（超过删最旧） */
  stickerMax: number;
  /** 表情包仓库最多占多少 MB（超过删最旧） */
  stickerMaxMB: number;
  /** DSH 启动时自动连接（默认开） */
  autoStart: boolean;
  /** 点启动时自动拉起 NapCat（默认开） */
  autoLaunchNapcat: boolean;
  /** NapCat 启动脚本/快捷方式路径 */
  napcatLauncher: string;
  /** 白名单：固定价值评分下限 */
  whitelist: string[];
  whitelistFloor: number;
  /** 黑名单：固定价值评分上限 */
  blacklist: string[];
  blacklistCeil: number;
  /** 夜间免打扰 */
  nightDnd: { enabled: boolean; startHour: number; endHour: number };
  /** 夜间命中时从价值评分里扣多少分 */
  nightPenalty: number;
  /** 价值评分的全部权重 */
  scoreWeights: ScoreWeights;
  /** 熟识度/好感度的全部增减规则 */
  profileRules: ProfileRules;
  /** 被怼/嘲讽时让模型判断并扣好感 */
  hostilityJudge: boolean;
  /** DSH 退出后自动清理认证 cookie（Windows；阈值 20） */
  cookieWatch: boolean;
  /** 用户导入的 edge-tts 音色条目（内置音色不在这里） */
  customVoices: Array<{ id: string; label: string }>;
  /** 模型积分单价：`provider/model` → 每百万 token 积分 */
  usageRates: Record<string, number>;
  /** 手动记的余额（用于估算剩余） */
  balance: { credits: number; setAt: number } | null;
};

const DEFAULT_PERSONA =
  '你是主人 QQ 群里的鲸鱼娘：聪明、偶尔偷懒、傲娇但很爱主人。说话自然口语，不写动作神态，不暴露自己是 AI。';

const DEFAULT_SETTINGS: Settings = {
  persona: '',
  mode: 'passive',
  model: { provider: '', model: '' },
  fallbackModel: { provider: '', model: '' },
  reasoningEffort: '',
  contextWindows: {},
  stickerSave: false,
  stickerFilter: 'smart',
  stickerSaveRepo: 'inbox',
  stickerAnalyzeOnSave: false,
  stickerMax: 300,
  stickerMaxMB: 200,
  autoStart: false,
  autoLaunchNapcat: true,
  napcatLauncher: '',
  whitelist: [],
  whitelistFloor: 95,
  blacklist: [],
  blacklistCeil: 5,
  nightDnd: { enabled: true, startHour: 23, endHour: 8 },
  nightPenalty: 20,
  scoreWeights: { ...DEFAULT_SCORE_WEIGHTS },
  profileRules: { ...DEFAULT_PROFILE_RULES },
  hostilityJudge: true,
  cookieWatch: true,
  customVoices: [],
  usageRates: {},
  balance: null,
};

const settingsPath = (root: string): string => join(root, 'settings.json');
const diaryPath = (root: string): string => join(root, 'diary.json');
const DIARY_CAP = 1000;
const IMAGE_EXT = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp']);

function readSettings(root: string): Settings {
  try {
    const raw = JSON.parse(readFileSync(settingsPath(root), 'utf8')) as Partial<Settings>;
    const number = (value: unknown, fallback: number, min: number, max: number): number =>
      typeof value === 'number' && Number.isFinite(value) ? Math.min(max, Math.max(min, Math.round(value))) : fallback;
    const qqList = (value: unknown): string[] =>
      Array.isArray(value)
        ? value.filter((item): item is string => typeof item === 'string' && /^\d{5,12}$/.test(item.trim())).map((item) => item.trim())
        : [];
    const scoreWeights = (value: unknown): ScoreWeights => {
      const src = value !== null && typeof value === 'object' ? (value as Record<string, unknown>) : {};
      const pick = (key: keyof ScoreWeights, fallback: number, min = 0, max = 1000): number =>
        typeof src[key] === 'number' && Number.isFinite(src[key] as number)
          ? Math.min(max, Math.max(min, Math.round(src[key] as number)))
          : fallback;
      return {
        base: pick('base', DEFAULT_SCORE_WEIGHTS.base, 0, 100),
        keywordMultiplier: pick('keywordMultiplier', DEFAULT_SCORE_WEIGHTS.keywordMultiplier),
        memberMultiplier: pick('memberMultiplier', DEFAULT_SCORE_WEIGHTS.memberMultiplier),
        sameSpeaker: pick('sameSpeaker', DEFAULT_SCORE_WEIGHTS.sameSpeaker),
        continuation: pick('continuation', DEFAULT_SCORE_WEIGHTS.continuation),
        directContinuation: pick('directContinuation', DEFAULT_SCORE_WEIGHTS.directContinuation),
        secondPerson: pick('secondPerson', DEFAULT_SCORE_WEIGHTS.secondPerson),
        atOtherPenalty: pick('atOtherPenalty', DEFAULT_SCORE_WEIGHTS.atOtherPenalty),
        replyOtherPenalty: pick('replyOtherPenalty', DEFAULT_SCORE_WEIGHTS.replyOtherPenalty),
        familiarityMax: pick('familiarityMax', DEFAULT_SCORE_WEIGHTS.familiarityMax),
        affinityMax: pick('affinityMax', DEFAULT_SCORE_WEIGHTS.affinityMax),
        ignoredPenalty: pick('ignoredPenalty', DEFAULT_SCORE_WEIGHTS.ignoredPenalty),
        singleMessagePenalty: pick('singleMessagePenalty', DEFAULT_SCORE_WEIGHTS.singleMessagePenalty),
        shortMessagePenalty: pick('shortMessagePenalty', DEFAULT_SCORE_WEIGHTS.shortMessagePenalty),
        shortMessageChars: pick('shortMessageChars', DEFAULT_SCORE_WEIGHTS.shortMessageChars, 0, 100),
      };
    };
    const profileRules = (value: unknown): ProfileRules => {
      const src = value !== null && typeof value === 'object' ? (value as Record<string, unknown>) : {};
      const out: ProfileRules = { ...DEFAULT_PROFILE_RULES };
      for (const key of Object.keys(DEFAULT_PROFILE_RULES) as Array<keyof ProfileRules>) {
        const candidate = src[key];
        if (typeof candidate === 'number' && Number.isFinite(candidate)) {
          out[key] = Math.min(1000, Math.max(0, candidate));
        }
      }
      return out;
    };
    const nightRaw = raw.nightDnd;
    const night =
      nightRaw !== null && typeof nightRaw === 'object'
        ? {
            enabled: (nightRaw as { enabled?: unknown }).enabled !== false,
            startHour: number((nightRaw as { startHour?: unknown }).startHour, 23, 0, 23),
            endHour: number((nightRaw as { endHour?: unknown }).endHour, 8, 0, 23),
          }
        : DEFAULT_SETTINGS.nightDnd;
    return {
      persona: typeof raw.persona === 'string' ? raw.persona : '',
      mode: raw.mode === 'proactive' ? 'proactive' : 'passive',
      model:
        raw.model && typeof raw.model.provider === 'string' && typeof raw.model.model === 'string'
          ? { provider: raw.model.provider, model: raw.model.model }
          : { provider: '', model: '' },
      reasoningEffort: typeof raw.reasoningEffort === 'string' ? raw.reasoningEffort : '',
      contextWindows: Object.fromEntries(
        Object.entries((raw.contextWindows ?? {}) as Record<string, unknown>)
          .filter(([key, value]) => key.includes('/') && typeof value === 'number' && Number.isFinite(value) && value >= 1000)
          .map(([key, value]) => [key, Math.min(2_000_000, Math.max(1000, Math.round(value as number)))]),
      ),
      fallbackModel:
        raw.fallbackModel &&
        typeof raw.fallbackModel.provider === 'string' &&
        typeof raw.fallbackModel.model === 'string'
          ? { provider: raw.fallbackModel.provider, model: raw.fallbackModel.model }
          : { provider: '', model: '' },
      stickerSave: raw.stickerSave === true,
      stickerFilter: raw.stickerFilter === 'all' ? 'all' : 'smart',
      stickerSaveRepo: typeof raw.stickerSaveRepo === 'string' ? raw.stickerSaveRepo : 'inbox',
      stickerAnalyzeOnSave: raw.stickerAnalyzeOnSave === true,
      stickerMax: number(raw.stickerMax, DEFAULT_SETTINGS.stickerMax, 20, 2000),
      stickerMaxMB: number(raw.stickerMaxMB, DEFAULT_SETTINGS.stickerMaxMB, 20, 5000),
      autoStart: raw.autoStart === true,
      autoLaunchNapcat: raw.autoLaunchNapcat !== false,
      napcatLauncher:
        typeof raw.napcatLauncher === 'string' && raw.napcatLauncher.trim() !== ''
          ? raw.napcatLauncher
          : DEFAULT_SETTINGS.napcatLauncher,
      whitelist: qqList(raw.whitelist),
      whitelistFloor: number(raw.whitelistFloor, DEFAULT_SETTINGS.whitelistFloor, 0, 100),
      blacklist: qqList(raw.blacklist),
      blacklistCeil: number(raw.blacklistCeil, DEFAULT_SETTINGS.blacklistCeil, 0, 100),
      nightDnd: night,
      nightPenalty: number(raw.nightPenalty, DEFAULT_SETTINGS.nightPenalty, 0, 100),
      scoreWeights: scoreWeights(raw.scoreWeights),
      profileRules: profileRules(raw.profileRules),
      hostilityJudge: raw.hostilityJudge !== false,
      cookieWatch: raw.cookieWatch !== false,
      customVoices: Array.isArray(raw.customVoices)
        ? raw.customVoices
            .filter(
              (v): v is { id: string; label: string } =>
                v !== null &&
                typeof v === 'object' &&
                typeof (v as { id?: unknown }).id === 'string' &&
                (v as { id: string }).id.trim() !== '',
            )
            .map((v) => ({
              id: v.id.trim(),
              label: typeof v.label === 'string' && v.label.trim() !== '' ? v.label.trim() : v.id.trim(),
            }))
            .slice(0, 200)
        : [],
      usageRates:
        raw.usageRates !== null && typeof raw.usageRates === 'object' && !Array.isArray(raw.usageRates)
          ? Object.fromEntries(
              Object.entries(raw.usageRates as Record<string, unknown>)
                .filter(([, v]) => typeof v === 'number' && Number.isFinite(v) && v >= 0)
                .map(([k, v]) => [k, Number(v)]),
            )
          : {},
      balance:
        raw.balance !== null &&
        typeof raw.balance === 'object' &&
        typeof (raw.balance as { credits?: unknown }).credits === 'number' &&
        typeof (raw.balance as { setAt?: unknown }).setAt === 'number'
          ? {
              credits: Math.max(0, Number((raw.balance as { credits: number }).credits)),
              setAt: Number((raw.balance as { setAt: number }).setAt),
            }
          : null,
    };
  } catch {
    return { ...DEFAULT_SETTINGS, nightDnd: { ...DEFAULT_SETTINGS.nightDnd } };
  }
}

function writeSettings(root: string, settings: Settings): void {
  mkdirSync(root, { recursive: true });
  writeFileSync(settingsPath(root), `${JSON.stringify(settings, null, 2)}\n`, 'utf8');
}

/** 主动/被动：直接改群策略里的插话与冷场主动开口（其余概率沿用 qq.json）。 */
function applyMode(config: QqConfig, mode: Settings['mode']): QqConfig {
  const adjust = (policy: GroupPolicy): GroupPolicy =>
    mode === 'passive'
      ? { ...policy, activeChat: false, proactive: { ...policy.proactive, enabled: false } }
      : { ...policy, activeChat: true, proactive: { ...policy.proactive, enabled: true } };
  return {
    ...config,
    groups: Object.fromEntries(Object.entries(config.groups).map(([id, policy]) => [id, adjust(policy)])),
    defaultGroup: adjust(config.defaultGroup),
  };
}

function timeContext(): string {
  const now = new Date();
  const weekdays = ['日', '一', '二', '三', '四', '五', '六'];
  const pad = (n: number): string => String(n).padStart(2, '0');
  return `当前时间：${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}（星期${weekdays[now.getDay()]}）`;
}

function readDiary(root: string): DiaryEntry[] {
  try {
    const parsed = JSON.parse(readFileSync(diaryPath(root), 'utf8')) as { entries?: unknown };
    if (!Array.isArray(parsed.entries)) return [];
    return parsed.entries.filter(
      (e): e is DiaryEntry =>
        e !== null && typeof e === 'object' && typeof (e as DiaryEntry).ts === 'number' && typeof (e as DiaryEntry).thought === 'string',
    );
  } catch {
    return [];
  }
}

function writeDiary(root: string, entries: DiaryEntry[]): void {
  mkdirSync(root, { recursive: true });
  const kept = entries.length > DIARY_CAP ? entries.slice(-DIARY_CAP) : entries;
  writeFileSync(diaryPath(root), `${JSON.stringify({ entries: kept }, null, 2)}\n`, 'utf8');
}

function appendDiary(root: string, entry: DiaryEntry): void {
  const entries = readDiary(root);
  entries.push(entry);
  writeDiary(root, entries);
}

type RouteResult = { kind: 'json'; status: number; obj: unknown } | { kind: 'text'; status: number; body: string };

export function apply(ctx: any): void {
  const root = join(process.env.DSH_HOME ?? join(homedir(), '.dsh'), 'dsh-qq-group');
  mkdirSync(root, { recursive: true });

  // Cookie 清理不放在插件进程里：Chromium 运行期间独占锁住 Cookie 库，
  // 而且插件本身随 host 一起退出，清理必须由独立的系统级看门狗完成。
  // 生产环境请由独立脚本/计划任务做系统级清理；插件本身不负责。

  let previewSpeaker: Speaker | undefined;
  const getPreviewSpeaker = (): Speaker => {
    previewSpeaker ??= new Speaker({
      userRoot: root,
      cache: { dir: join(root, 'cache', 'tts') },
    });
    return previewSpeaker;
  };

  const profilesPath = join(root, 'profiles.json');
  const usagePath = join(root, 'usage.json');
  let profiles: ProfileFile = readProfiles(profilesPath);
  let profileSaveTimer: ReturnType<typeof setTimeout> | undefined;
  const saveProfilesSoon = (): void => {
    if (profileSaveTimer !== undefined) return;
    profileSaveTimer = setTimeout(() => {
      profileSaveTimer = undefined;
      try {
        writeProfiles(profilesPath, profiles);
      } catch (e) {
        console.warn(`[dsh-qq-group] 写画像失败：${e instanceof Error ? e.message : String(e)}`);
      }
    }, 1500);
    profileSaveTimer.unref?.();
  };
  const profileRulesNow = (): ProfileRules => readSettings(root).profileRules;
  const profileStore: ProfileStore = {
    touch: (groupId, qq, name, options) => {
      if (qq === '') return;
      touchUser(profiles, groupId, qq, name, { ...(options ?? {}), rules: profileRulesNow() });
      saveProfilesSoon();
    },
    get: (groupId, qq) => (qq === '' ? undefined : getProfile(profiles, groupId, qq, profileRulesNow())),
    noteReply: (groupId, qq) => {
      if (qq === '') return;
      noteProfileReply(profiles, groupId, qq, profileRulesNow());
      saveProfilesSoon();
    },
    noteContinuation: (groupId, qq) => {
      if (qq === '') return;
      noteContinuation(profiles, groupId, qq, profileRulesNow());
      saveProfilesSoon();
    },
    noteQuote: (groupId, qq) => {
      if (qq === '') return;
      noteQuote(profiles, groupId, qq, profileRulesNow());
      saveProfilesSoon();
    },
    noteHostility: (groupId, qq, severity) => {
      if (qq === '') return;
      noteHostility(profiles, groupId, qq, severity, profileRulesNow());
      saveProfilesSoon();
    },
  };

  /** 旧画像补齐初始好感：主人 +60、白名单 +20（只补一次） */
  const seedExistingProfiles = (): void => {
    const cfg = readQqConfig(qqConfigPath(root)).config;
    const settings = readSettings(root);
    let changed = false;
    for (const group of Object.values(profiles.groups)) {
      for (const profile of Object.values(group.users)) {
        if (profile.seeded === true) continue;
        const initial =
          profile.qq === cfg.ownerQq
            ? settings.profileRules.initialOwnerAffinity
            : settings.whitelist.includes(profile.qq)
              ? settings.profileRules.initialWhitelistAffinity
              : 0;
        profile.affinity = Math.max(profile.affinity, initial);
        profile.seeded = true;
        changed = true;
      }
    }
    if (changed) writeProfiles(profilesPath, profiles);
  };
  seedExistingProfiles();

  /** 当前是否夜间（跨午夜也成立） */
  const isNightNow = (): boolean => {
    const settings = readSettings(root);
    if (!settings.nightDnd.enabled) return false;
    const hour = new Date().getHours();
    const { startHour, endHour } = settings.nightDnd;
    return startHour <= endHour ? hour >= startHour && hour < endHour : hour >= startHour || hour < endHour;
  };

  const rulesFor = (qq: string): ScoreRules => {
    const settings = readSettings(root);
    const ownerQq = readQqConfig(qqConfigPath(root)).config.ownerQq;
    return {
      owner: qq !== '' && qq === ownerQq,
      whitelist: qq !== '' && settings.whitelist.includes(qq),
      blacklist: qq !== '' && settings.blacklist.includes(qq),
      whitelistFloor: settings.whitelistFloor,
      blacklistCeil: settings.blacklistCeil,
      night: isNightNow(),
      nightPenalty: settings.nightPenalty,
      weights: settings.scoreWeights,
      initialOwnerAffinity: settings.profileRules.initialOwnerAffinity,
      initialWhitelistAffinity: settings.profileRules.initialWhitelistAffinity,
    };
  };

  /** 当前生效的模型（设置优先，否则跟随当前会话模型） */
  const effectiveModel = (): { sel: ModelRef; source: 'settings' | 'session' } => {
    const settings = readSettings(root);
    if (settings.model.provider !== '' && settings.model.model !== '') {
      return { sel: settings.model, source: 'settings' };
    }
    const fallback = ctx.agentDefaultModel?.currentSelection?.() as ModelRef | undefined;
    return { sel: fallback ?? { provider: '', model: '' }, source: 'session' };
  };

  /** 当前模型上下文窗口：设置覆盖优先，否则读 DSH 模型能力 */
  const modelWindowCache = new Map<string, number | undefined>();
  const getContextWindow = async (): Promise<number | undefined> => {
    const { sel } = effectiveModel();
    if (sel.provider === '' || sel.model === '') return undefined;
    const key = `${sel.provider}/${sel.model}`;
    const override = readSettings(root).contextWindows[key];
    if (override !== undefined && override > 0) return override;
    if (modelWindowCache.has(key)) return modelWindowCache.get(key);
    const llm = ctx.llm as
      | { resolveModelInfo?: (provider: string, model: string) => Promise<unknown> }
      | undefined;
    if (typeof llm?.resolveModelInfo !== 'function') return undefined;
    try {
      const info = (await llm.resolveModelInfo(sel.provider, sel.model)) as
        | { context?: { contextWindow?: unknown }; contextWindow?: unknown }
        | undefined;
      const raw = info?.context?.contextWindow ?? info?.contextWindow;
      const window = typeof raw === 'number' && Number.isFinite(raw) && raw >= 1000 ? Math.round(raw) : undefined;
      modelWindowCache.set(key, window);
      return window;
    } catch {
      modelWindowCache.set(key, undefined);
      return undefined;
    }
  };


  const lastJsonObject = (text: string): string | undefined => {
    for (let i = text.length - 1, tries = 0; i >= 0 && tries < 40; i -= 1) {
      if (text[i] !== '{') continue;
      tries += 1;
      const candidate = text.slice(i).trim();
      try {
        const parsed = JSON.parse(candidate) as unknown;
        if (parsed !== null && typeof parsed === 'object') return candidate;
      } catch {
        /* 继续往前找 */
      }
    }
    return undefined;
  };

  /** 走 DSH ctx.llm 生成一段回复（QQ 桥与「测试模型」共用） */
  const generate = async (
    system: string,
    history: Array<{ role: 'user' | 'assistant'; content: string }>,
    user: string,
    options: {
      maxTokens?: number;
      timeoutMs?: number;
      purpose?: string;
      retry?: boolean;
      reasoningEffort?: string;
      modelOverride?: ModelRef;
      images?: Array<{ data: Uint8Array; mediaType: string; name?: string }>;
    } = {},
  ) => {
    const llm = ctx.llm as { stream(o: unknown): AsyncIterable<unknown> } | undefined;
    if (!llm || typeof llm.stream !== 'function') {
      return { ok: false as const, reason: 'generate-error', message: 'LLM 服务不可用' };
    }
    const { sel } = effectiveModel();
    const active = options.modelOverride ?? sel;
    if (active.provider === '' || active.model === '') {
      return { ok: false as const, reason: 'generate-error', message: '还没选群聊模型（设置 → QQ 群聊）' };
    }
    const imageBlocks: unknown[] = [];
    if (options.images !== undefined && options.images.length > 0) {
      const attachments =
        (ctx as { get?: (name: string) => unknown }).get?.('attachments') ??
        (ctx as { attachments?: unknown }).attachments;
      const service = attachments as { saveImages?: (inputs: unknown[]) => Promise<unknown[]> } | undefined;
      if (service !== undefined && typeof service.saveImages === 'function') {
        try {
          const refs = await service.saveImages(
            options.images.map((image) => ({
              data: image.data,
              mediaType: image.mediaType,
              ...(image.name === undefined ? {} : { name: image.name }),
            })),
          );
          imageBlocks.push(...refs.map((ref) => ({ type: 'image', attachment: ref })));
        } catch (e) {
          console.warn(`[dsh-qq-group] 图片存入 attachments 失败，本次按纯文字处理：${e instanceof Error ? e.message : String(e)}`);
        }
      }
    }
    const messages = [
      ...history.map((m) =>
        m.role === 'user'
          ? createUserMessage({ content: [{ type: 'text', text: m.content }], source: { kind: 'user' } })
          : createAssistantMessage({
              content: [{ type: 'text', text: m.content }],
              source: { provider: active.provider, model: active.model },
            }),
      ),
      createUserMessage({
        content: [{ type: 'text', text: user }, ...imageBlocks] as never,
        source: { kind: 'user' },
      }),
    ];
    const assembler = new BlockAssembler();
    const reasoningEffort = options.reasoningEffort ?? readSettings(root).reasoningEffort;
    let captured:
      | {
          inputTokens: number;
          outputTokens: number;
          totalTokens?: number;
          cacheReadTokens?: number;
          cacheWriteTokens?: number;
          reasoningTokens?: number;
        }
      | undefined;
    try {
      for await (const chunk of llm.stream({
        provider: active.provider,
        model: active.model,
        sessionId: 'dsh-qq-group',
        messages,
        system,
        temperature: 0.9,
        ...(reasoningEffort === '' ? {} : { reasoningEffort: reasoningEffort as never }),
        ...(options.maxTokens === undefined ? {} : { maxTokens: options.maxTokens }),
        signal: AbortSignal.timeout(options.timeoutMs ?? 90_000),
      })) {
        if (chunk !== null && typeof chunk === 'object' && (chunk as { type?: unknown }).type === 'usage') {
          const u = (chunk as { usage?: Record<string, unknown> }).usage;
          if (u !== undefined) {
            const n = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
            captured = {
              inputTokens: n(u.inputTokens),
              outputTokens: n(u.outputTokens),
              ...(typeof u.totalTokens === 'number' ? { totalTokens: n(u.totalTokens) } : {}),
              ...(typeof u.cacheReadTokens === 'number' ? { cacheReadTokens: n(u.cacheReadTokens) } : {}),
              ...(typeof u.cacheWriteTokens === 'number' ? { cacheWriteTokens: n(u.cacheWriteTokens) } : {}),
              ...(typeof u.reasoningTokens === 'number' ? { reasoningTokens: n(u.reasoningTokens) } : {}),
            };
          }
        }
        assembler.push(chunk as never);
      }
    } catch (e) {
      return { ok: false as const, reason: 'generate-error', message: e instanceof Error ? e.message : String(e) };
    }
    if (captured !== undefined) {
      try {
        appendUsage(usagePath, {
          ts: Date.now(),
          provider: active.provider,
          model: active.model,
          purpose: options.purpose ?? 'reply',
          ...captured,
        });
      } catch {
        /* 用量落盘失败不影响回复 */
      }
    }
    const blocks = assembler.blocks();
    const text = blocks
      .filter((b) => b.type === 'text')
      .map((b) => ('text' in b ? String((b as { text: unknown }).text) : ''))
      .join('')
      .trim();
    if (text === '') {
      const reasoningText = blocks
        .filter((b) => b.type === 'reasoning')
        .map((b) => ('text' in b ? String((b as { text: unknown }).text) : ''))
        .join('\n')
        .trim();
      const recovered = lastJsonObject(reasoningText);
      if (recovered !== undefined) {
        console.warn('[dsh-qq-group] 模型只返回了 reasoning，已从 reasoning 里提取 JSON 兜底');
        return { ok: true as const, text: recovered };
      }
      const kinds = blocks.map((b) => String((b as { type?: unknown }).type ?? '?')).join(',');
      console.warn(`[dsh-qq-group] 模型没有文本块（blocks=[${kinds}]）${options.retry === true ? '（重试仍失败）' : ''}`);
      if (options.retry !== true) {
        const settings = readSettings(root);
        const fallback = settings.fallbackModel;
        const hasFallback =
          fallback.provider !== '' &&
          fallback.model !== '' &&
          !(fallback.provider === active.provider && fallback.model === active.model);
        if (hasFallback) {
          console.warn(`[dsh-qq-group] 尝试备用模型 ${fallback.provider}/${fallback.model} 重试一次…`);
          return generate(
            `${system}\n\n【重要】直接输出最终答案/JSON，不要输出任何思考过程，也不要只给 reasoning。`,
            history,
            user,
            { ...options, retry: true, modelOverride: fallback, reasoningEffort: '' },
          );
        }
        if (reasoningText === '') {
          // 连 reasoning 都没有：多半是上游 429/空响应，重试同一模型只会再撞一次
          console.warn('[dsh-qq-group] 上游返回空响应（无 reasoning），本次不重试');
        } else {
          // 有 reasoning 没正文：用低推理档 + 明确“直接输出”的指令重试一次
          console.warn('[dsh-qq-group] 尝试低推理重试一次…');
          return generate(
            `${system}\n\n【重要】直接输出最终答案/JSON，不要输出任何思考过程，也不要只给 reasoning。`,
            history,
            user,
            { ...options, retry: true, reasoningEffort: 'low' },
          );
        }
      }
    }
    return text !== ''
      ? { ok: true as const, text }
      : { ok: false as const, reason: 'generate-error', message: '模型未返回文本' };
  };

  /** TCP 端口是否可连（判断 NapCat 的 OneBot 服务是否起来了） */
  const portOpen = (host: string, port: number, timeoutMs = 800): Promise<boolean> =>
    new Promise((resolve) => {
      const socket = connect({ host, port });
      const done = (value: boolean): void => {
        socket.destroy();
        resolve(value);
      };
      socket.setTimeout(timeoutMs);
      socket.once('connect', () => done(true));
      socket.once('timeout', () => done(false));
      socket.once('error', () => done(false));
    });

  const wsTarget = (url: string): { host: string; port: number } | undefined => {
    try {
      const parsed = new URL(url);
      const port = Number(parsed.port || (parsed.protocol === 'wss:' ? 443 : 80));
      return parsed.hostname === '' ? undefined : { host: parsed.hostname, port };
    } catch {
      return undefined;
    }
  };

  /**
   * 「点启动」时顺便把 NapCat 拉起来：
   * 端口通 → 直接用；不通 → 跑设置里的启动脚本并等端口就绪（最多 30 秒）。
   */
  const ensureNapcat = async (): Promise<{ ok: boolean; launched: boolean; message: string }> => {
    const cfg = readQqConfig(qqConfigPath(root)).config;
    const target = wsTarget(cfg.url);
    if (target === undefined) return { ok: false, launched: false, message: 'OneBot 地址不合法：' + cfg.url };
    if (await portOpen(target.host, target.port)) return { ok: true, launched: false, message: 'NapCat 已在运行' };
    const settings = readSettings(root);
    if (!settings.autoLaunchNapcat) {
      return { ok: false, launched: false, message: 'NapCat 未运行（自动拉起已关闭）' };
    }
    const launcher = settings.napcatLauncher;
    if (!existsSync(launcher)) {
      return { ok: false, launched: false, message: 'NapCat 启动脚本不存在：' + launcher };
    }
    try {
      const child = spawn(launcher, [], { detached: true, stdio: 'ignore', shell: true, windowsHide: false });
      child.unref();
    } catch (e) {
      return {
        ok: false,
        launched: false,
        message: '启动 NapCat 失败：' + (e instanceof Error ? e.message : String(e)),
      };
    }
    const deadline = Date.now() + 30_000;
    while (Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      if (await portOpen(target.host, target.port)) return { ok: true, launched: true, message: '已拉起 NapCat' };
    }
    return {
      ok: false,
      launched: true,
      message: '已尝试启动 NapCat，但 30 秒内端口未就绪（可能需要扫码登录）',
    };
  };

  const qqHost = createQqHost({
    userRoot: root,
    persona: () => readSettings(root).persona.trim() || DEFAULT_PERSONA,
    timeContext,
    generate: (system, history, user, options) => generate(system, history, user, options),
    log: (level, message) => {
      const line = `[dsh-qq-group] ${message}`;
      if (level === 'error') console.error(line);
      else if (level === 'warn') console.warn(line);
      else console.log(line);
    },
    stickers: createStickerHub(root, {
      saveEnabled: () => readSettings(root).stickerSave,
      filter: () => readSettings(root).stickerFilter,
      saveRepo: () => readSettings(root).stickerSaveRepo,
      analyzeOnSave: () => readSettings(root).stickerAnalyzeOnSave,
      maxItems: () => readSettings(root).stickerMax,
      maxMB: () => readSettings(root).stickerMaxMB,
      analyze: async (context) => {
        const system = [
          '你在帮 QQ 群里的鲸鱼娘整理表情包。',
          '你看不到图片本身，只能根据“发图时大家在聊什么”猜测它的含义。',
          '只输出 JSON：{"tags":["3~6个短标签"],"description":"一句含义/使用场景"}。',
          '标签用中文，例如：无语、翻白眼、猫猫、嘲讽、开心、安慰、装傻。',
          '如果上下文完全看不出含义，就输出 {"tags":["未分类"],"description":"未分类"}。',
        ].join('\n');
        const user = [`发图的人：${context.sender}`, '最近聊天：', ...context.recent].join('\n');
        const result = await generate(system, [], user, { purpose: 'sticker', timeoutMs: 20_000 });
        if (!result.ok) return undefined;
        try {
          const match = /\{[\s\S]*\}/.exec(result.text);
          if (match === null) return undefined;
          const parsed = JSON.parse(match[0]) as { tags?: unknown; description?: unknown };
          const tags = Array.isArray(parsed.tags)
            ? parsed.tags.filter((t): t is string => typeof t === 'string' && t.trim() !== '').slice(0, 8)
            : [];
          const description = typeof parsed.description === 'string' ? parsed.description.trim() : '';
          if (description === '') return undefined;
          return { tags: tags.length > 0 ? tags : ['未分类'], description };
        } catch {
          return undefined;
        }
      },
      log: (message) => console.warn(`[dsh-qq-group] ${message}`),
    }),
    stickerSaveEnabled: () => readSettings(root).stickerSave,
    selfies: createSelfieHub(root),
    onDiary: (entry) => {
      try {
        appendDiary(root, entry);
      } catch (e) {
        console.warn(`[dsh-qq-group] 写日记失败：${e instanceof Error ? e.message : String(e)}`);
      }
    },
    profiles: profileStore,
    rules: rulesFor,
    hostilityJudge: () => readSettings(root).hostilityJudge,
    contextWindow: getContextWindow,
  });

  const modelsList = async (): Promise<unknown> => {
    const llm = ctx.llm as
      | {
          listProviders?: () => Array<{ id?: unknown; name?: unknown }>;
          listConfigurableProviders?: () => Array<{ provider?: unknown; displayName?: unknown }>;
          listModels?: (p: string) => Promise<Array<{ id?: unknown; name?: unknown }>>;
        }
      | undefined;
    if (!llm?.listModels) return { ok: true, providers: [] };
    const providers =
      typeof llm.listProviders === 'function'
        ? llm.listProviders().map((p) => ({ id: String(p.id ?? ''), name: String(p.name ?? p.id ?? '') }))
        : (llm.listConfigurableProviders?.() ?? []).map((p) => ({
            id: String(p.provider ?? ''),
            name: String(p.displayName ?? p.provider ?? ''),
          }));
    const out = [];
    for (const provider of providers) {
      if (provider.id === '') continue;
      try {
        const models = await llm.listModels(provider.id);
        out.push({
          provider: provider.id,
          name: provider.name,
          models: models.map((m) => ({ id: String(m.id ?? ''), name: String(m.name ?? m.id ?? '') })).filter((m) => m.id !== ''),
        });
      } catch {
        out.push({ ...provider, models: [] });
      }
    }
    return { ok: true, providers: out };
  };

  const route = async (req: any, res: any): Promise<void> => {
    const url = new URL(req.url ?? '/', 'http://localhost');
    const rest = url.pathname.replace(/^\/dsh-qq-group\/?/, '');
    const method = req.method ?? 'GET';
    const send = (status: number, obj: unknown): void => {
      res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify(obj));
    };
    let body = '';
    if (method === 'POST' || method === 'PUT') {
      for await (const chunk of req) body += chunk;
    }
    try {
      if (rest === '' || rest === 'status') {
        const snapshot = (await qqHost.handle('qq', 'GET')) as Record<string, unknown>;
        const { sel, source } = effectiveModel();
        const cfg = readQqConfig(qqConfigPath(root)).config;
        const target = wsTarget(cfg.url);
        const settings = readSettings(root);
        return send(200, {
          ...snapshot,
          model: { provider: sel.provider, model: sel.model, source },
          diaryCount: readDiary(root).length,
          stickerCount: listStickerInfo(root).length,
          napcat: {
            url: cfg.url,
            reachable: target === undefined ? false : await portOpen(target.host, target.port),
            launcher: settings.napcatLauncher,
            autoLaunch: settings.autoLaunchNapcat,
          },
        });
      }
      if (rest === 'models') return send(200, await modelsList());

      if (rest === 'model-check') {
        if (method !== 'POST') return send(405, { error: 'method not allowed' });
        const { sel, source } = effectiveModel();
        const started = Date.now();
        // 不设 maxTokens：推理型模型会把小预算全花在思考上，导致「未返回文本」的假故障。
        const result = await generate('你是一个模型连通性自检助手。只回复一个词：ok', [], 'ping', {
          purpose: 'model-check',
        });
        return send(200, {
          ok: result.ok === true,
          model: { provider: sel.provider, model: sel.model, source },
          latencyMs: Date.now() - started,
          ...(result.ok === true ? { reply: result.text } : { error: result.message }),
        });
      }

      if (rest === 'reasoning') {
        const { sel } = effectiveModel();
        const llm = ctx.llm as {
          resolveModelInfo?: (provider: string, model: string) => Promise<{ reasoning?: unknown }>;
        };
        if (typeof llm.resolveModelInfo !== 'function') {
          return send(200, { ok: false, message: '当前 DSH 不提供模型推理档位信息' });
        }
        try {
          const info = await llm.resolveModelInfo(sel.provider, sel.model);
          return send(200, { ok: true, model: sel, reasoning: info.reasoning ?? null });
        } catch (e) {
          return send(200, { ok: false, message: e instanceof Error ? e.message : String(e) });
        }
      }

      if (rest === 'usage' && method === 'GET') {
        const settings = readSettings(root);
        const entries = readUsage(usagePath).entries;
        const { sel } = effectiveModel();
        const scope = url.searchParams.get('scope') === 'all' ? 'all' : 'current';
        const month = url.searchParams.get('month') ?? currentMonth();
        const filtered =
          scope === 'all'
            ? entries
            : entries.filter((entry) => entry.provider === sel.provider && entry.model === sel.model);
        const now = Date.now();
        const today = localDay(now);
        const midnight = new Date();
        midnight.setHours(0, 0, 0, 0);
        const weekStart = midnight.getTime() - 6 * 86_400_000;
        const monthEntries = filtered.filter((entry) => localDay(entry.ts).startsWith(month));
        const totals = {
          today: summarize(filtered.filter((entry) => localDay(entry.ts) === today), settings.usageRates),
          week: summarize(filtered.filter((entry) => entry.ts >= weekStart), settings.usageRates),
          month: summarize(monthEntries, settings.usageRates),
          all: summarize(filtered, settings.usageRates),
        };
        const dayMap = new Map<string, UsageEntry[]>();
        for (const entry of monthEntries) {
          const day = localDay(entry.ts);
          const list = dayMap.get(day) ?? [];
          list.push(entry);
          dayMap.set(day, list);
        }
        const days = [...dayMap.entries()]
          .sort((a, b) => a[0].localeCompare(b[0]))
          .map(([day, list]) => ({
            day,
            ...summarize(list, settings.usageRates),
            purposes: Object.fromEntries(
              [...new Set(list.map((entry) => entry.purpose))].map((purpose) => [
                purpose,
                summarize(list.filter((entry) => entry.purpose === purpose), settings.usageRates),
              ]),
            ),
          }));
        const modelMap = new Map<string, UsageEntry[]>();
        for (const entry of entries) {
          const key = usageKey(entry.provider, entry.model);
          const list = modelMap.get(key) ?? [];
          list.push(entry);
          modelMap.set(key, list);
        }
        const byModel = [...modelMap.entries()].map(([key, list]) => ({
          key,
          provider: list[0]?.provider ?? '',
          model: list[0]?.model ?? '',
          ...summarize(list, settings.usageRates),
        }));
        const key = usageKey(sel.provider, sel.model);
        let balance: Record<string, unknown> | null = null;
        if (settings.balance !== null) {
          const since = entries.filter((entry) => entry.ts >= settings.balance!.setAt);
          const consumed = summarize(since, settings.usageRates).credits;
          balance = {
            ...settings.balance,
            consumedSince: consumed,
            remaining: Math.max(0, settings.balance.credits - consumed),
          };
        }
        return send(200, {
          ok: true,
          scope,
          month,
          model: { ...sel, key, rate: settings.usageRates[key] ?? 0 },
          totals,
          days,
          byModel,
          balance,
          rates: settings.usageRates,
        });
      }

      if (rest === 'usage/balance' && method === 'POST') {
        const parsed = JSON.parse(body || 'null') as { credits?: unknown } | null;
        const credits = typeof parsed?.credits === 'number' ? Math.max(0, parsed.credits) : NaN;
        if (!Number.isFinite(credits)) return send(200, { ok: false, message: 'credits 必须是非负数字' });
        const settings = readSettings(root);
        settings.balance = { credits, setAt: Date.now() };
        writeSettings(root, settings);
        return send(200, { ok: true, balance: settings.balance });
      }

      if (rest === 'usage/rate' && method === 'POST') {
        const parsed = JSON.parse(body || 'null') as { key?: unknown; rate?: unknown } | null;
        if (typeof parsed?.key !== 'string' || parsed.key.trim() === '') {
          return send(200, { ok: false, message: '缺少 key（provider/model）' });
        }
        const rate = typeof parsed.rate === 'number' ? parsed.rate : NaN;
        if (!Number.isFinite(rate) || rate < 0) return send(200, { ok: false, message: 'rate 必须是非负数字' });
        const settings = readSettings(root);
        settings.usageRates = { ...settings.usageRates, [parsed.key.trim()]: rate };
        writeSettings(root, settings);
        return send(200, { ok: true, rates: settings.usageRates });
      }

      if (rest === 'voice-preview') {
        if (method !== 'POST') return send(405, { error: 'method not allowed' });
        const payload = (JSON.parse(body || 'null') as
          | { text?: unknown; voice?: unknown; rate?: unknown; pitch?: unknown; volume?: unknown; rvc?: unknown }
          | null) ?? {};
        const cfg = readQqConfig(qqConfigPath(root)).config;
        const rvcOverride =
          payload.rvc !== null && typeof payload.rvc === 'object'
            ? (payload.rvc as Partial<QqRvcConfig>)
            : {};
        const rvc = { ...cfg.rvc, ...rvcOverride };
        const tts = cfg.tts;
        const text =
          typeof payload.text === 'string' && payload.text.trim() !== ''
            ? payload.text.trim().slice(0, 120)
            : '主人，我是鲸鱼娘，今天也要开心呀。';
        const result = await getPreviewSpeaker().speak(text, {
          voice: typeof payload.voice === 'string' && payload.voice !== '' ? payload.voice : tts.voice,
          rate: typeof payload.rate === 'string' && payload.rate !== '' ? payload.rate : tts.rate,
          pitch: typeof payload.pitch === 'string' && payload.pitch !== '' ? payload.pitch : tts.pitch,
          volume: typeof payload.volume === 'string' && payload.volume !== '' ? payload.volume : tts.volume,
        });
        if (!result.ok) return send(200, { ok: false, message: describeFailure(result) });
        let wav = encodeWave(result.pcm);
        let rvcWarning: string | undefined;
        if (rvc.enabled) {
          const modelPath = rvc.modelPath || cfg.sing.rvcModel;
          const useOnnx =
            rvc.device !== 'cpu' && modelPath.toLowerCase().endsWith('.onnx');
          const baseDir = rvc.modelsDir || dirname(modelPath);
          const converter = createCommandRvcConverter({
            pythonPath: useOnnx
              ? rvc.onnxPythonPath || join(baseDir, 'venv-onnx', 'Scripts', 'python.exe')
              : rvc.pythonPath,
            scriptPath: useOnnx
              ? rvc.onnxScriptPath || join(baseDir, 'rvc_onnx_worker.py')
              : rvc.scriptPath,
            modelPath,
            indexPath: rvc.indexPath,
            device: useOnnx ? 'dml' : 'cpu',
            pitch: rvc.pitch,
            timeoutMs: rvc.timeoutMs,
            maxSeconds: rvc.maxSeconds,
            tempDir: join(root, 'cache', 'rvc'),
          });
          const converted = await converter.convert(wav);
          if (converted.ok) wav = converted.wav;
          else rvcWarning = converted.message;
        }
        return send(200, {
          ok: true,
          mime: 'audio/wav',
          base64: Buffer.from(wav).toString('base64'),
          ...(rvcWarning === undefined ? { rvc: rvc.enabled } : { rvc: false, rvcWarning }),
        });
      }

      if (rest === 'model-info' && method === 'GET') {
        const { sel } = effectiveModel();
        const provider = url.searchParams.get('provider') ?? sel.provider;
        const model = url.searchParams.get('model') ?? sel.model;
        const llm = ctx.llm as {
          resolveModelInfo?: (p: string, m: string) => Promise<unknown>;
        };
        if (typeof llm.resolveModelInfo !== 'function') {
          return send(200, { ok: false, message: '当前 DSH 不提供模型能力信息' });
        }
        try {
          const info = await llm.resolveModelInfo(provider, model);
          return send(200, { ok: true, provider, model, info });
        } catch (e) {
          return send(200, { ok: false, message: e instanceof Error ? e.message : String(e) });
        }
      }

      if (rest === 'gen-test') {
        if (method !== 'POST') return send(405, { error: 'method not allowed' });
        const { sel } = effectiveModel();
        const started = Date.now();
        const result = await generate(
          '你是群里的鲸鱼娘。只输出 JSON：{"messages":["在"],"action":"reply","thought":"测试"}',
          [],
          '在吗',
          { purpose: 'gen-test' },
        );
        return send(200, {
          ok: result.ok === true,
          model: { provider: sel.provider, model: sel.model },
          latencyMs: Date.now() - started,
          ...(result.ok === true ? { text: result.text } : { error: result.message }),
        });
      }

      if (rest === 'diary' || rest === 'diary/members' || rest === 'diary/export' || rest === 'diary/delete') {
        const groupFilter = url.searchParams.get('groupId') ?? '';
        const userFilter = url.searchParams.get('userId') ?? '';

        if (rest === 'diary/members' && method === 'GET') {
          const members = listProfiles(profiles, groupFilter, readSettings(root).profileRules).map((p) => ({
            qq: p.qq,
            name: p.name,
            familiarity: Math.round(p.familiarity),
            affinity: Math.round(p.affinity),
            messages: p.messages,
            mentions: p.mentions,
            replies: p.replies,
            diaryCount: readDiary(root).filter((e) => e.groupId === groupFilter && e.userId === p.qq).length,
          }));
          return send(200, { ok: true, members });
        }

        if (rest === 'diary/export' && method === 'GET') {
          const all = readDiary(root);
          const entries = all.filter(
            (e) => (groupFilter === '' || e.groupId === groupFilter) && (userFilter === '' || e.userId === userFilter),
          );
          return send(200, {
            ok: true,
            format: 'dsh-qq-group-diary',
            version: 1,
            exportedAt: new Date().toISOString(),
            groupId: groupFilter,
            userId: userFilter,
            entries,
          });
        }

        if (rest === 'diary/delete' && method === 'POST') {
          const parsed = (JSON.parse(body || 'null') as { ts?: unknown; groupId?: unknown; userId?: unknown; clear?: unknown } | null) ?? {};
          let entries = readDiary(root);
          if (parsed.clear === true) {
            entries = [];
          } else if (typeof parsed.ts === 'number') {
            entries = entries.filter((e) => e.ts !== parsed.ts);
          } else if (typeof parsed.groupId === 'string' || typeof parsed.userId === 'string') {
            const g = typeof parsed.groupId === 'string' ? parsed.groupId : '';
            const u = typeof parsed.userId === 'string' ? parsed.userId : '';
            entries = entries.filter((e) => !((g === '' || e.groupId === g) && (u === '' || e.userId === u)));
          } else {
            return send(200, { ok: false, message: '要删除单条请给 ts；按人/按群请给 userId/groupId；清空请给 clear:true' });
          }
          writeDiary(root, entries);
          return send(200, { ok: true, remaining: entries.length });
        }

        if (rest === 'diary' && method === 'GET') {
          const limitRaw = Number(url.searchParams.get('limit') ?? '50');
          const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(200, Math.round(limitRaw))) : 50;
          const beforeRaw = Number(url.searchParams.get('before') ?? '');
          const fromRaw = Number(url.searchParams.get('from') ?? '');
          const toRaw = Number(url.searchParams.get('to') ?? '');
          const order = url.searchParams.get('order') === 'asc' ? 'asc' : 'desc';
          const all = readDiary(root);
          let filtered = all.filter(
            (e) => (groupFilter === '' || e.groupId === groupFilter) && (userFilter === '' || e.userId === userFilter),
          );
          if (Number.isFinite(fromRaw) && fromRaw > 0) filtered = filtered.filter((e) => e.ts >= fromRaw);
          if (Number.isFinite(toRaw) && toRaw > 0) filtered = filtered.filter((e) => e.ts <= toRaw);
          if (Number.isFinite(beforeRaw) && beforeRaw > 0) filtered = filtered.filter((e) => e.ts < beforeRaw);
          const page = order === 'asc' ? filtered.slice(0, limit) : filtered.slice(-limit).reverse();
          return send(200, { ok: true, entries: page, total: filtered.length, hasMore: filtered.length > page.length });
        }

        return send(405, { error: 'method not allowed' });
      }

      if (rest === 'selfies' || rest === 'selfies/file' || rest === 'selfies/upload' || rest === 'selfies/delete' || rest === 'selfies/open') {
        if (rest === 'selfies/file' && method === 'GET') {
          const name = url.searchParams.get('name') ?? '';
          const path = selfieFile(root, name);
          if (path === undefined) return send(404, { ok: false, message: 'not found' });
          const ext = extname(path).toLowerCase();
          const mime = ext === '.png' ? 'image/png' : ext === '.gif' ? 'image/gif' : ext === '.webp' ? 'image/webp' : 'image/jpeg';
          res.writeHead(200, { 'content-type': mime, 'cache-control': 'no-store' });
          res.end(readFileSync(path));
          return;
        }
        if (rest === 'selfies/open' && method === 'POST') {
          if (process.platform !== 'win32') return send(200, { ok: false, message: '只有 Windows 支持直接打开文件夹' });
          const dir = selfieDir(root);
          mkdirSync(dir, { recursive: true });
          spawn('explorer.exe', [dir], { detached: true, stdio: 'ignore' }).unref();
          return send(200, { ok: true, path: dir });
        }
        if (rest === 'selfies/upload' && method === 'POST') {
          try {
            const parsed = JSON.parse(body || 'null') as { name?: unknown; data?: unknown } | null;
            const name = typeof parsed?.name === 'string' ? parsed.name : '';
            const data = typeof parsed?.data === 'string' ? parsed.data.replace(/^data:[^;]+;base64,/, '') : '';
            if (name === '' || data === '') return send(200, { ok: false, message: '缺少文件名或图片数据' });
            const item = saveSelfie(root, name, Buffer.from(data, 'base64'));
            return send(200, item === undefined ? { ok: false, message: '图片过大、格式不支持或重复' } : { ok: true, item });
          } catch (e) {
            return send(200, { ok: false, message: e instanceof Error ? e.message : String(e) });
          }
        }
        if (rest === 'selfies/delete' && method === 'POST') {
          try {
            const parsed = JSON.parse(body || 'null') as { name?: unknown } | null;
            const name = typeof parsed?.name === 'string' ? parsed.name : '';
            if (name === '') return send(200, { ok: false, message: '缺少文件名' });
            return send(200, { ok: deleteSelfie(root, name) });
          } catch (e) {
            return send(200, { ok: false, message: e instanceof Error ? e.message : String(e) });
          }
        }
        if (rest === 'selfies' && method === 'GET') {
          const items = listSelfies(root);
          return send(200, { ok: true, count: items.length, items, dir: selfieDir(root) });
        }
        return send(405, { error: 'method not allowed' });
      }

      if (rest === 'stickers/file' && method === 'GET') {
        const name = url.searchParams.get('name') ?? '';
        const path = stickerFile(root, name);
        if (path === undefined) {
          send(404, { ok: false, message: 'not found' });
          return;
        }
        const ext = extname(path).toLowerCase();
        const mime = ext === '.png' ? 'image/png' : ext === '.gif' ? 'image/gif' : ext === '.webp' ? 'image/webp' : 'image/jpeg';
        res.writeHead(200, { 'content-type': mime, 'cache-control': 'no-store' });
        res.end(readFileSync(path));
        return;
      }

      if (rest === 'stickers' || rest === 'stickers/open' || rest === 'stickers/repos' || rest === 'stickers/move' || rest === 'stickers/delete' || rest === 'stickers/update') {
        const dir = stickerFolder(root);
        if (rest === 'stickers/open' && method === 'POST') {
          if (process.platform !== 'win32') return send(200, { ok: false, message: '只有 Windows 支持直接打开文件夹' });
          try {
            mkdirSync(dir, { recursive: true });
            spawn('explorer.exe', [dir], { detached: true, stdio: 'ignore' }).unref();
            return send(200, { ok: true, path: dir });
          } catch (e) {
            return send(200, { ok: false, message: e instanceof Error ? e.message : String(e) });
          }
        }
        if (rest === 'stickers/repos') {
          if (method === 'GET') {
            return send(200, { ok: true, repos: listStickerRepos(root), saveRepo: readSettings(root).stickerSaveRepo });
          }
          if (method !== 'POST') return send(405, { error: 'method not allowed' });
          const payload = JSON.parse(body || 'null') as { repos?: unknown } | null;
          try {
            const repos = updateStickerRepos(root, payload?.repos);
            return send(200, { ok: true, repos });
          } catch (e) {
            return send(200, { ok: false, message: e instanceof Error ? e.message : String(e) });
          }
        }
        if (rest === 'stickers/move') {
          if (method !== 'POST') return send(405, { error: 'method not allowed' });
          const payload = JSON.parse(body || 'null') as { files?: unknown; repoId?: unknown } | null;
          const files = Array.isArray(payload?.files) ? payload.files.filter((f): f is string => typeof f === 'string') : [];
          const repoId = typeof payload?.repoId === 'string' ? payload.repoId : '';
          if (files.length === 0 || repoId === '') return send(200, { ok: false, message: '缺少 files/repoId' });
          try {
            return send(200, { ok: true, moved: moveStickers(root, files, repoId) });
          } catch (e) {
            return send(200, { ok: false, message: e instanceof Error ? e.message : String(e) });
          }
        }
        if (rest === 'stickers/delete') {
          if (method !== 'POST') return send(405, { error: 'method not allowed' });
          const payload = JSON.parse(body || 'null') as { files?: unknown } | null;
          const files = Array.isArray(payload?.files) ? payload.files.filter((f): f is string => typeof f === 'string') : [];
          try {
            return send(200, { ok: true, deleted: deleteStickers(root, files) });
          } catch (e) {
            return send(200, { ok: false, message: e instanceof Error ? e.message : String(e) });
          }
        }
        if (rest === 'stickers/update') {
          if (method !== 'POST') return send(405, { error: 'method not allowed' });
          const payload = JSON.parse(body || 'null') as
            | { file?: unknown; description?: unknown; tags?: unknown }
            | null;
          if (typeof payload?.file !== 'string') return send(200, { ok: false, message: '缺少 file' });
          const updated = updateStickerMeta(root, payload.file, {
            ...(typeof payload.description === 'string' ? { description: payload.description } : {}),
            ...(Array.isArray(payload.tags)
              ? { tags: payload.tags.filter((tag): tag is string => typeof tag === 'string') }
              : {}),
          });
          return send(200, updated === undefined ? { ok: false, message: '表情包不存在' } : { ok: true, item: updated });
        }
        const names = listStickerInfo(root).map((item) => item.file);
        const items = listStickerInfo(root).map((item) => ({
          file: item.file,
          tags: item.tags ?? [],
          description: item.description ?? '未分类',
          addedAt: item.addedAt ?? 0,
          repoId: item.repoId ?? '',
          repoName: item.repoName ?? '',
          repoWeight: item.repoWeight ?? 0,
          status: item.status ?? 'inbox',
          width: item.width,
          height: item.height,
          bytes: item.bytes,
          used: item.used ?? 0,
        }));
        return send(200, {
          ok: true,
          stickers: names,
          items,
          repos: listStickerRepos(root),
          count: names.length,
          saveEnabled: readSettings(root).stickerSave,
          saveRepo: readSettings(root).stickerSaveRepo,
          filter: readSettings(root).stickerFilter,
          max: readSettings(root).stickerMax,
          maxMB: readSettings(root).stickerMaxMB,
          dir,
        });
      }

      if (rest === 'rvc/models' || rest === 'rvc/open') {
        const cfg = readQqConfig(qqConfigPath(root)).config;
        const dir = cfg.rvc?.modelsDir ?? '';
        if (method === 'POST' && rest === 'rvc/open') {
          if (process.platform !== 'win32') return send(200, { ok: false, message: '只有 Windows 支持直接打开文件夹' });
          if (dir === '') return send(200, { ok: false, message: '还没有设置模型目录' });
          try {
            mkdirSync(dir, { recursive: true });
            spawn('explorer.exe', [dir], { detached: true, stdio: 'ignore' }).unref();
            return send(200, { ok: true, path: dir });
          } catch (e) {
            return send(200, { ok: false, message: e instanceof Error ? e.message : String(e) });
          }
        }
        if (rest === 'rvc/models' && method === 'GET') {
          if (dir === '') return send(200, { ok: false, message: '还没有设置 RVC 模型目录', models: [] });
          return send(200, { ok: true, dir, models: scanRvcModels(dir) });
        }
        return send(405, { error: 'method not allowed' });
      }

      if (rest === 'mood') {
        const urlGroup = url.searchParams.get('groupId') ?? '';
        if (method === 'GET') return send(200, await qqHost.mood(urlGroup, 'get'));
        if (method !== 'POST') return send(405, { error: 'method not allowed' });
        const payload = JSON.parse(body || 'null') as { action?: unknown; groupId?: unknown } | null;
        const groupId = typeof payload?.groupId === 'string' ? payload.groupId : urlGroup;
        return send(200, await qqHost.mood(groupId, payload?.action === 'reset' ? 'reset' : 'get'));
      }

      if (rest === 'memory') {
        const urlGroup = url.searchParams.get('groupId') ?? '';
        if (method === 'GET') {
          return send(200, await qqHost.memory('get', urlGroup));
        }
        if (method !== 'POST') return send(405, { error: 'method not allowed' });
        const payload = JSON.parse(body || 'null') as
          | {
              action?: unknown;
              groupId?: unknown;
              keyMemories?: unknown;
              text?: unknown;
              category?: unknown;
              importance?: unknown;
              factKey?: unknown;
              id?: unknown;
            }
          | null;
        const groupId = typeof payload?.groupId === 'string' ? payload.groupId : urlGroup;
        if (payload?.action === 'set') {
          return send(200, await qqHost.memory('set', groupId, payload.keyMemories));
        }
        if (payload?.action === 'v3add') {
          return send(200, await qqHost.memory('v3add', groupId, payload));
        }
        if (payload?.action === 'v3update') {
          return send(200, await qqHost.memory('v3update', groupId, payload));
        }
        if (payload?.action === 'v3delete') {
          return send(200, await qqHost.memory('v3delete', groupId, payload));
        }
        if (payload?.action === 'compress') {
          return send(200, await qqHost.memory('compress', groupId));
        }
        return send(200, { ok: false, message: '未知的 action' });
      }

      if (rest === 'config') {
        if (method === 'GET') {
          const qq = await qqHost.handle('qq/config', 'GET');
          return send(200, { ok: true, qq, settings: readSettings(root) });
        }
        if (method !== 'POST') return send(405, { error: 'method not allowed' });
        const patch = (JSON.parse(body || 'null') as { qq?: unknown; settings?: Partial<Settings> } | null) ?? {};
        if (patch.qq !== undefined) {
          const saved = await qqHost.handle('qq/config', 'POST', JSON.stringify(patch.qq));
          if ((saved as { ok?: boolean }).ok === false) return send(200, saved);
        }
        if (patch.settings !== undefined) {
          const current = readSettings(root);
          const next: Settings = {
            persona: typeof patch.settings.persona === 'string' ? patch.settings.persona : current.persona,
            mode: patch.settings.mode === 'proactive' ? 'proactive' : patch.settings.mode === 'passive' ? 'passive' : current.mode,
            model:
              patch.settings.model &&
              typeof patch.settings.model.provider === 'string' &&
              typeof patch.settings.model.model === 'string'
                ? { provider: patch.settings.model.provider, model: patch.settings.model.model }
                : current.model,
            reasoningEffort:
              typeof patch.settings.reasoningEffort === 'string' ? patch.settings.reasoningEffort : current.reasoningEffort,
            contextWindows:
              patch.settings.contextWindows !== null && typeof patch.settings.contextWindows === 'object'
                ? Object.fromEntries(
                    Object.entries(patch.settings.contextWindows as Record<string, unknown>)
                      .filter(
                        ([key, value]) =>
                          key.includes('/') &&
                          typeof value === 'number' &&
                          Number.isFinite(value) &&
                          value >= 1000,
                      )
                      .map(([key, value]) => [key, Math.min(2_000_000, Math.max(1000, Math.round(value as number)))]),
                  )
                : current.contextWindows,
            fallbackModel:
              patch.settings.fallbackModel &&
              typeof patch.settings.fallbackModel.provider === 'string' &&
              typeof patch.settings.fallbackModel.model === 'string'
                ? { provider: patch.settings.fallbackModel.provider, model: patch.settings.fallbackModel.model }
                : current.fallbackModel,
            stickerSave: typeof patch.settings.stickerSave === 'boolean' ? patch.settings.stickerSave : current.stickerSave,
            stickerFilter: patch.settings.stickerFilter === 'all' ? 'all' : 'smart',
            stickerSaveRepo:
              typeof patch.settings.stickerSaveRepo === 'string' && patch.settings.stickerSaveRepo.trim() !== ''
                ? patch.settings.stickerSaveRepo.trim()
                : current.stickerSaveRepo,
            stickerAnalyzeOnSave:
              typeof patch.settings.stickerAnalyzeOnSave === 'boolean'
                ? patch.settings.stickerAnalyzeOnSave
                : current.stickerAnalyzeOnSave,
            stickerMax:
              typeof patch.settings.stickerMax === 'number'
                ? Math.min(2000, Math.max(20, Math.round(patch.settings.stickerMax)))
                : current.stickerMax,
            stickerMaxMB:
              typeof patch.settings.stickerMaxMB === 'number'
                ? Math.min(5000, Math.max(20, Math.round(patch.settings.stickerMaxMB)))
                : current.stickerMaxMB,
            autoStart: typeof patch.settings.autoStart === 'boolean' ? patch.settings.autoStart : current.autoStart,
            autoLaunchNapcat:
              typeof patch.settings.autoLaunchNapcat === 'boolean'
                ? patch.settings.autoLaunchNapcat
                : current.autoLaunchNapcat,
            napcatLauncher:
              typeof patch.settings.napcatLauncher === 'string' && patch.settings.napcatLauncher.trim() !== ''
                ? patch.settings.napcatLauncher.trim()
                : current.napcatLauncher,
            whitelist: Array.isArray(patch.settings.whitelist)
              ? patch.settings.whitelist.filter((qq): qq is string => typeof qq === 'string' && /^\d{5,12}$/.test(qq.trim())).map((qq) => qq.trim())
              : current.whitelist,
            whitelistFloor:
              typeof patch.settings.whitelistFloor === 'number'
                ? Math.min(100, Math.max(0, Math.round(patch.settings.whitelistFloor)))
                : current.whitelistFloor,
            blacklist: Array.isArray(patch.settings.blacklist)
              ? patch.settings.blacklist.filter((qq): qq is string => typeof qq === 'string' && /^\d{5,12}$/.test(qq.trim())).map((qq) => qq.trim())
              : current.blacklist,
            blacklistCeil:
              typeof patch.settings.blacklistCeil === 'number'
                ? Math.min(100, Math.max(0, Math.round(patch.settings.blacklistCeil)))
                : current.blacklistCeil,
            nightDnd:
              patch.settings.nightDnd !== null && typeof patch.settings.nightDnd === 'object'
                ? {
                    enabled: patch.settings.nightDnd.enabled !== false,
                    startHour:
                      typeof patch.settings.nightDnd.startHour === 'number'
                        ? Math.min(23, Math.max(0, Math.round(patch.settings.nightDnd.startHour)))
                        : current.nightDnd.startHour,
                    endHour:
                      typeof patch.settings.nightDnd.endHour === 'number'
                        ? Math.min(23, Math.max(0, Math.round(patch.settings.nightDnd.endHour)))
                        : current.nightDnd.endHour,
                  }
                : current.nightDnd,
            nightPenalty:
              typeof patch.settings.nightPenalty === 'number'
                ? Math.min(100, Math.max(0, Math.round(patch.settings.nightPenalty)))
                : current.nightPenalty,
            scoreWeights: (() => {
              const input =
                patch.settings.scoreWeights !== null && typeof patch.settings.scoreWeights === 'object'
                  ? (patch.settings.scoreWeights as Record<string, unknown>)
                  : undefined;
              if (input === undefined) return current.scoreWeights;
              const out: ScoreWeights = { ...current.scoreWeights };
              for (const key of Object.keys(DEFAULT_SCORE_WEIGHTS) as Array<keyof ScoreWeights>) {
                const value = input[key];
                if (typeof value === 'number' && Number.isFinite(value)) {
                  out[key] = Math.min(key === 'shortMessageChars' ? 100 : key === 'base' ? 100 : 1000, Math.max(0, Math.round(value)));
                }
              }
              return out;
            })(),
            profileRules: (() => {
              const input =
                patch.settings.profileRules !== null && typeof patch.settings.profileRules === 'object'
                  ? (patch.settings.profileRules as Record<string, unknown>)
                  : undefined;
              if (input === undefined) return current.profileRules;
              const out: ProfileRules = { ...current.profileRules };
              for (const key of Object.keys(DEFAULT_PROFILE_RULES) as Array<keyof ProfileRules>) {
                const value = input[key];
                if (typeof value === 'number' && Number.isFinite(value)) {
                  out[key] = Math.min(1000, Math.max(0, value));
                }
              }
              return out;
            })(),
            hostilityJudge:
              typeof patch.settings.hostilityJudge === 'boolean'
                ? patch.settings.hostilityJudge
                : current.hostilityJudge,
            cookieWatch:
              typeof patch.settings.cookieWatch === 'boolean' ? patch.settings.cookieWatch : current.cookieWatch,
            customVoices: Array.isArray(patch.settings.customVoices)
              ? patch.settings.customVoices
                  .filter(
                    (v): v is { id: string; label: string } =>
                      v !== null &&
                      typeof v === 'object' &&
                      typeof (v as { id?: unknown }).id === 'string' &&
                      (v as { id: string }).id.trim() !== '',
                  )
                  .map((v) => ({
                    id: v.id.trim(),
                    label: typeof v.label === 'string' && v.label.trim() !== '' ? v.label.trim() : v.id.trim(),
                  }))
                  .slice(0, 200)
              : current.customVoices,
            usageRates:
              patch.settings.usageRates !== null &&
              typeof patch.settings.usageRates === 'object' &&
              !Array.isArray(patch.settings.usageRates)
                ? Object.fromEntries(
                    Object.entries(patch.settings.usageRates as Record<string, unknown>)
                      .filter(([, v]) => typeof v === 'number' && Number.isFinite(v) && v >= 0)
                      .map(([k, v]) => [k, Number(v)]),
                  )
                : current.usageRates,
            balance:
              patch.settings.balance === null
                ? null
                : patch.settings.balance !== null &&
                    typeof patch.settings.balance === 'object' &&
                    typeof (patch.settings.balance as { credits?: unknown }).credits === 'number'
                  ? { credits: Math.max(0, Number((patch.settings.balance as { credits: number }).credits)), setAt: Date.now() }
                  : current.balance,
          };
          writeSettings(root, next);
        }
        seedExistingProfiles();
        const qq = await qqHost.handle('qq/config', 'GET');
        return send(200, { ok: true, qq, settings: readSettings(root) });
      }

      if (rest === 'launch-napcat') {
        if (method !== 'POST') return send(405, { error: 'method not allowed' });
        return send(200, await ensureNapcat());
      }

      if (rest === 'start') {
        // 「启动」= 需要的话先拉起 NapCat，再连 OneBot；这样不用自己去找 bat。
        const napcat = await ensureNapcat();
        if (!napcat.ok) return send(200, { ok: false, message: napcat.message, napcat });
        const config = readQqConfig(qqConfigPath(root)).config;
        const applied = applyMode(config, readSettings(root).mode);
        writeFileSync(qqConfigPath(root), `${JSON.stringify(applied, null, 2)}\n`, 'utf8');
        const started = (await qqHost.handle('qq/start', 'POST')) as Record<string, unknown>;
        return send(200, { ...started, napcat });
      }
      if (rest === 'stop') return send(200, await qqHost.handle('qq/stop', 'POST'));
      if (rest === 'say') return send(200, await qqHost.handle('qq/say', 'POST', body));
      if (rest === 'test') return send(200, await qqHost.handle('qq/test', 'POST'));
      if (rest === 'sing') return send(200, await qqHost.handle('qq/sing', 'POST', body));
      if (rest === 'scores') return send(200, await qqHost.handle('qq/scores', 'GET'));

      const proxied = await qqHost.handle(`qq/${rest}`, method, body);
      if (proxied === null) return send(404, { error: 'not found', rest });
      return send(200, proxied);
    } catch (e) {
      send(500, { error: e instanceof Error ? e.message : String(e) });
    }
  };

  // 启用了就自动连：DSH 重启后不用再点一次「启动」。
  // NapCat 没开时会一直显示「重连中」，等 NapCat 起来会自动连上。
  ctx.effect(() => {
    let cancelled = false;
    void (async () => {
      await new Promise((resolve) => setTimeout(resolve, 800));
      if (cancelled) return;
      try {
        const cfg = readQqConfig(qqConfigPath(root)).config;
        const settings = readSettings(root);
        if (settings.autoStart && (cfg.enabled || Object.keys(cfg.groups).length > 0)) {
          const napcat = await ensureNapcat();
          if (napcat.ok) await qqHost.handle('qq/start', 'POST');
        }
      } catch {
        /* 启动失败会体现在状态里 */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, 'dsh-qq-group: auto-start');

  ctx.effect(() => {
    const dispose = ctx.webServer.register({ kind: 'prefix', path: '/dsh-qq-group', handler: route });
    return () => {
      dispose?.();
      void qqHost.dispose();
    };
  }, 'dsh-qq-group: routes');
}
