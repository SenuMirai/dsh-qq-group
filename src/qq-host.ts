/**
 * 宿主侧的 QQ 群接入：配置读写、启停、面板接口。
 *
 * ── 与云端的关系 ──
 * 同一份 `src/qq/bridge.ts` 跑在两个地方：
 * - **宿主内**（这里）：独立插件接管群聊，模型走 DSH 自己的 `ctx.llm`；
 * - **云端**（`src/qq/cli.ts`）：单独一个 node 进程，模型走自带的 OpenAI 兼容客户端。
 *
 * 两边**共用同一条编排逻辑**，只换依赖注入。这正是本项目在路由上踩过的那条教训：
 * 第二套实现对不上，迟早漂移。
 *
 * ── 路由 ──
 * | 方法 | 路径 | 作用 |
 * |---|---|---|
 * | GET  | `/dsh-whale-girl/qq`          | 当前状态（连接/群统计/后端/缓存） |
 * | GET  | `/dsh-whale-girl/qq/config`   | 读配置（密钥打码） |
 * | POST | `/dsh-whale-girl/qq/config`   | 写配置（整份归一化后落盘） |
 * | POST | `/dsh-whale-girl/qq/start`    | 启动（可选同时保存配置） |
 * | POST | `/dsh-whale-girl/qq/stop`     | 停止 |
 * | POST | `/dsh-whale-girl/qq/sing`     | 离线渲一首歌（`{song, out?, transpose?}`） |
 * | POST | `/dsh-whale-girl/qq/say`      | 去某个群说一句（`{groupId, text}`） |
 * | POST | `/dsh-whale-girl/qq/test`     | 体检（配置/模型/TTS/NapCat） |
 * | GET  | `/dsh-whale-girl/qq/scores`   | 内置曲目列表 |
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { QqBridge } from './qq/bridge';
import type { DiaryEntry, ProfileStore, StickerHub } from './qq/bridge';
import type { ScoreRules } from './qq/triggers';
import { ConfigError, defaultConfig, normalizeConfig, type QqConfig } from './qq/config';
import { createOpenAiClient, type ChatClient, type ChatImage, type LlmMessage, type ChatOptions, type LlmResult } from './qq/llm';
import { BUILTIN_SCORES } from './sound/score';
import { resolveBackend } from './sound/sing';
import { writeSongToFile } from './qq-sing';

/** 宿主侧依赖（由 index.ts 注入，避免这里 import 宿主上下文） */
export interface QqHostDeps {
  userRoot: string;
  /** 现有的人设读取（persona.json → whisperPrompt） */
  persona: () => string;
  /** 现有的时间背景 */
  timeContext: () => string;
  /** 现有的模型调用（走 ctx.llm；使用本插件设置里选的 DSH 模型） */
  generate: (
    system: string,
    history: Array<{ role: 'user' | 'assistant'; content: string }>,
    user: string,
    options?: { maxTokens?: number; timeoutMs?: number; purpose?: string; images?: ChatImage[] },
  ) => Promise<LlmResult>;
  log: (level: 'debug' | 'info' | 'warn' | 'error', message: string) => void;
  /** 表情包池（可选；不传就不发也不收藏） */
  stickers?: StickerHub;
  /** 是否允许自动收藏群友图片 */
  stickerSaveEnabled?: () => boolean;
  /** 日记落盘（可选） */
  onDiary?: (entry: DiaryEntry) => void;
  /** 群成员画像（可选） */
  profiles?: ProfileStore;
  /** 白名单/黑名单/夜间规则（可选） */
  rules?: (qq: string) => ScoreRules;
  /** 是否让模型判断「在怼她」 */
  hostilityJudge?: () => boolean;
}

/** QQ 接入的宿主侧控制器 */
export interface QqHost {
  /** 路由处理：返回 null 表示「不是我的路径」，交给后面的分支 */
  handle(rest: string, method: string, body: string | undefined): Promise<unknown | null>;
  /** 记忆面板：读/写关键记忆/立即压缩 */
  memory(
    action: 'get' | 'set' | 'compress' | 'v3add' | 'v3update' | 'v3delete',
    groupId: string,
    payload?: unknown,
  ): Promise<Record<string, unknown>>;
  /** 心情：按群读取/重置 */
  mood(groupId: string, action: 'get' | 'reset'): Promise<Record<string, unknown>>;
  /** QQ空间：发布/删除/可用性 */
  qzone(
    action: 'publish' | 'delete' | 'available',
    payload?: unknown,
  ): Promise<Record<string, unknown>>;
  /** 插件卸载时调用 */
  dispose(): Promise<void>;
  /** 当前是否在跑 */
  readonly running: boolean;
}

/** 配置路径 */
export function qqConfigPath(userRoot: string): string {
  return join(userRoot, 'qq.json');
}

/** 读配置：不存在就返回默认（**不**自动落盘，避免用户没打算用时凭空多一个文件） */
export function readQqConfig(path: string): { config: QqConfig; exists: boolean; problem?: string } {
  if (!existsSync(path)) return { config: defaultConfig(), exists: false };
  try {
    const raw = readFileSync(path, 'utf8').replace(/^\uFEFF/, '');
    return { config: normalizeConfig(JSON.parse(raw)), exists: true };
  } catch (e) {
    const problem =
      e instanceof ConfigError ? e.message : `读取/解析 qq.json 失败：${e instanceof Error ? e.message : String(e)}`;
    return { config: defaultConfig(), exists: true, problem };
  }
}

/** 把密钥打码（面板展示用；只露首尾各 4 位） */
export function maskSecret(secret: string): string {
  if (secret === '') return '';
  if (secret.length <= 8) return '********';
  return `${secret.slice(0, 4)}…${secret.slice(-4)}`;
}

/** 面板展示用的配置（不含明文密钥） */
export function redactedConfig(config: QqConfig): Record<string, unknown> {
  return {
    ...config,
    llm: { ...config.llm, apiKey: maskSecret(config.llm.apiKey) },
    adminToken: maskSecret(config.adminToken),
    token: maskSecret(config.token),
    // 密钥字段的另一种形态：告诉前端「这里有没有值」，而不是让用户看到打码串又存回去
    _hasApiKey: config.llm.apiKey !== '',
  };
}

/**
 * 把「面板提交的配置」合并进现有配置。
 *
 * 关键规则：**打码串不能被存回去**。前端拿到的是 `sk-1…abcd`，用户没改就直接提交时，
 * 如果把这一串当真存进配置，密钥就永久坏了（下次启动模型调用全 401）。
 * 所以这里识别「看起来像打码串」的值，原样保留旧值。
 */
export function mergeConfigPatch(current: QqConfig, patch: unknown): QqConfig {
  if (patch === null || typeof patch !== 'object') throw new ConfigError('(根)', 'JSON 对象', patch);
  const src = JSON.parse(JSON.stringify(patch)) as Record<string, unknown>;

  const llm = src.llm as Record<string, unknown> | undefined;
  if (llm !== undefined && llm !== null) {
    if (typeof llm.apiKey === 'string' && looksMasked(llm.apiKey)) llm.apiKey = current.llm.apiKey;
  }
  if (typeof src.adminToken === 'string' && looksMasked(src.adminToken)) src.adminToken = current.adminToken;
  if (typeof src.token === 'string' && looksMasked(src.token)) src.token = current.token;
  delete src._hasApiKey;
  // 面板经常只提交**部分字段**（比如只改一个群的频率）：必须先深合并到现有配置，
  // 否则 normalizeConfig 会把没提交的字段一律按默认值重置（语音/唱歌/其他群全丢）。
  return normalizeConfig(deepMerge(current, src) as Record<string, unknown>);
}

function deepMerge(base: unknown, over: unknown): unknown {
  if (over === null || typeof over !== 'object' || Array.isArray(over)) return over;
  const b =
    base !== null && typeof base === 'object' && !Array.isArray(base) ? (base as Record<string, unknown>) : {};
  const out: Record<string, unknown> = { ...b };
  for (const [key, value] of Object.entries(over as Record<string, unknown>)) {
    out[key] = deepMerge(b[key], value);
  }
  return out;
}

/** 看起来像打码串（含省略号，或全是星号） */
export function looksMasked(value: string): boolean {
  return /…|^\*+$/.test(value);
}

/**
 * 建一个 QQ 接入控制器。
 *
 * @param deps 宿主依赖
 */
export function createQqHost(deps: QqHostDeps): QqHost {
  const path = qqConfigPath(deps.userRoot);
  let bridge: QqBridge | undefined;
  let cachedConfig: QqConfig | undefined;

  /** 当前配置（每次都读盘：主人可能直接改文件） */
  const load = (): { config: QqConfig; exists: boolean; problem?: string } => {
    const loaded = readQqConfig(path);
    if (loaded.exists) cachedConfig = loaded.config;
    return loaded;
  };

  /** 用 DSH 的模型生成（使用本插件设置里选的 DSH 模型） */
  const generateWithHost = async (
    system: string,
    history: Array<{ role: 'user' | 'assistant'; content: string }>,
    user: string,
    options?: { maxTokens?: number; timeoutMs?: number; purpose?: string; images?: ChatImage[] },
  ): Promise<LlmResult> => {
    return deps.generate(system, history, user, options);
  };

  /** 组装一个宿主版 ChatClient（提示词由 bridge 组装好，这里只转发） */
  const hostClient = (): ChatClient => ({
    label: 'dsh:current',
    async chat(messages: LlmMessage[], options?: ChatOptions): Promise<LlmResult> {
      const system = messages.find((m) => m.role === 'system')?.content ?? '';
      const rest = messages.filter((m) => m.role !== 'system');
      const last = rest[rest.length - 1];
      if (last === undefined) return { ok: false, reason: 'bad-response', message: '没有可发送的用户消息' };
      return generateWithHost(
        system,
        rest.slice(0, -1).map((m) => ({ role: m.role === 'assistant' ? ('assistant' as const) : ('user' as const), content: m.content })),
        last.content,
        {
          ...(options?.maxTokens === undefined ? {} : { maxTokens: options.maxTokens }),
          ...(options?.timeoutMs === undefined ? {} : { timeoutMs: options.timeoutMs }),
          ...(options?.purpose === undefined ? {} : { purpose: options.purpose }),
          ...(options?.images === undefined ? {} : { images: options.images }),
        },
      );
    },
  });

  const save = (config: QqConfig): void => {
    mkdirSync(deps.userRoot, { recursive: true });
    writeFileSync(path, `${JSON.stringify(config, null, 2)}\n`, 'utf8');
    cachedConfig = config;
  };

  const snapshot = (): unknown => {
    const loaded = load();
    const status = bridge?.snapshot() ?? {
      running: false,
      muted: false,
      link: { status: 'idle' },
      selfQq: '',
      llm: '未启动',
      groups: [],
    };
    return {
      ok: true,
      ...status,
      configPath: path,
      configExists: loaded.exists,
      ...(loaded.problem === undefined ? {} : { configProblem: loaded.problem }),
      enabled: loaded.config.enabled,
      backends: Object.entries(resolveBackend(loaded.config.sing.backend)).length === 0 ? {} : {
        current: loaded.config.sing.backend,
        available: ['pitch', 'diffsinger', 'rvc'],
      },
    };
  };

  return {
    get running(): boolean {
      return bridge !== undefined;
    },

    /** 记忆面板的读/写/压缩（桥未启动时明确失败） */
    async qzone(
      action: 'publish' | 'delete' | 'available',
      payload?: unknown,
    ): Promise<Record<string, unknown>> {
      if (action === 'available') {
        return { ok: bridge !== undefined && bridge.qzoneAvailable() };
      }
      if (bridge === undefined) return { ok: false, message: 'QQ 连接尚未启动' };
      const data = (payload ?? {}) as { content?: unknown; ugcRight?: unknown; tid?: unknown };
      if (action === 'publish') {
        const content = typeof data.content === 'string' ? data.content : '';
        const ugcRight =
          typeof data.ugcRight === 'number' && Number.isFinite(data.ugcRight) ? data.ugcRight : 64;
        return bridge.qzonePublish(content, ugcRight);
      }
      const tid = typeof data.tid === 'string' ? data.tid : '';
      return bridge.qzoneDelete(tid);
    },

    async memory(
      action: 'get' | 'set' | 'compress' | 'v3add' | 'v3update' | 'v3delete',
      groupId: string,
      payload?: unknown,
    ): Promise<Record<string, unknown>> {
      if (bridge === undefined) return { ok: false, message: 'QQ 连接尚未启动' };
      if (groupId.trim() === '') return { ok: false, message: '缺少 groupId' };
      try {
        if (action === 'get') return { ok: true, ...bridge.memorySnapshot(groupId) };
        if (action === 'set') {
          const keyMemories = bridge.setKeyMemories(groupId, payload);
          return { ok: true, keyMemories };
        }
        if (action === 'v3add') return bridge.addMemoryV3(groupId, payload);
        if (action === 'v3update') {
          const patch = (payload !== null && typeof payload === 'object' ? payload : {}) as { id?: unknown };
          return bridge.updateMemoryV3(groupId, typeof patch.id === 'string' ? patch.id : '', payload);
        }
        if (action === 'v3delete') {
          const patch = (payload !== null && typeof payload === 'object' ? payload : {}) as { id?: unknown };
          return bridge.deleteMemoryV3(groupId, typeof patch.id === 'string' ? patch.id : '');
        }
        return { ok: true, ...(await bridge.compressMemoryNow(groupId)) };
      } catch (e) {
        return { ok: false, message: e instanceof Error ? e.message : String(e) };
      }
    },

    /** 心情：按群读取/重置（桥未启动时明确失败） */
    async mood(groupId: string, action: 'get' | 'reset'): Promise<Record<string, unknown>> {
      if (bridge === undefined) return { ok: false, message: 'QQ 连接尚未启动' };
      if (groupId.trim() === '') return { ok: false, message: '缺少 groupId' };
      try {
        return action === 'reset' ? bridge.resetMood(groupId) : bridge.moodSnapshot(groupId);
      } catch (e) {
        return { ok: false, message: e instanceof Error ? e.message : String(e) };
      }
    },

    async handle(rest: string, method: string, body: string | undefined): Promise<unknown | null> {
      // ── 状态 ──
      if (rest === 'qq' && method === 'GET') return snapshot();

      // ── 配置 ──
      if (rest === 'qq/config') {
        if (method === 'GET') {
          const loaded = load();
          return {
            ok: true,
            exists: loaded.exists,
            config: redactedConfig(loaded.config),
            ...(loaded.problem === undefined ? {} : { problem: loaded.problem }),
          };
        }
        if (method !== 'POST') return { ok: false, message: 'method not allowed' };
        try {
          const patch = JSON.parse(body ?? 'null') as unknown;
          const current = load().config;
          // 面板提交的是一份「完整配置」（含打码密钥）；也可以只提交部分字段
          const merged = mergeConfigPatch(current, patch);
          save(merged);
          // 运行中的桥立即换配置，否则「冷场多久/频率」要重启才生效
          if (bridge !== undefined) bridge.applyConfig(merged);
          return { ok: true, config: redactedConfig(merged) };
        } catch (e) {
          return { ok: false, message: e instanceof Error ? e.message : String(e) };
        }
      }

      // ── 启停 ──
      if (rest === 'qq/start' && method === 'POST') {
        if (bridge !== undefined) return { ok: true, alreadyRunning: true };
        let config: QqConfig;
        try {
          // body 里带了配置就先存（面板的「保存并启动」）
          if (body !== undefined && body.trim() !== '') {
            const patch = JSON.parse(body) as unknown;
            const current = load().config;
            config = mergeConfigPatch(current, patch);
            save(config);
          } else {
            config = load().config;
          }
        } catch (e) {
          return { ok: false, message: `配置不合法：${e instanceof Error ? e.message : String(e)}` };
        }
        if (!config.enabled) config = { ...config, enabled: true };

        const created = new QqBridge({
          config,
          userRoot: deps.userRoot,
          persona: deps.persona,
          timeContext: deps.timeContext,
          log: deps.log,
          llm: hostClient(),
          onError: (message) => deps.log('error', message),
          ...(deps.stickers === undefined ? {} : { stickers: deps.stickers }),
          ...(deps.stickerSaveEnabled === undefined ? {} : { stickerSaveEnabled: deps.stickerSaveEnabled }),
          ...(deps.onDiary === undefined ? {} : { onDiary: deps.onDiary }),
          ...(deps.profiles === undefined ? {} : { profiles: deps.profiles }),
          ...(deps.rules === undefined ? {} : { rules: deps.rules }),
          ...(deps.hostilityJudge === undefined ? {} : { hostilityJudge: deps.hostilityJudge }),
        });
        const started = await created.start();
        if (!started.ok) {
          await created.stop().catch(() => undefined);
          return { ok: false, reason: started.reason, message: started.message };
        }
        bridge = created;
        return { ok: true };
      }

      if (rest === 'qq/stop' && method === 'POST') {
        const running = bridge;
        bridge = undefined;
        if (running !== undefined) await running.stop();
        return { ok: true };
      }

      // ── 体检 ──
      if (rest === 'qq/test' && method === 'POST') {
        const config = load().config;
        const checks: Array<{ name: string; ok: boolean; detail: string }> = [];
        checks.push({
          name: '配置',
          ok: config.enabled,
          detail: config.enabled ? `${Object.keys(config.groups).length} 个群` : 'qq.json 里 enabled = false',
        });
        /**
         * 模型这一项要说清楚「用的是谁」。
         *
         * 宿主内（本机模式）走 `ctx.llm` —— 与本插件设置里选的 DSH 模型同源，
         * 也就是主人在 DSH 里选的那个模型（本机是 workbuddy）。
         * **不花钱**是这么来的：它借用 DSH 已有的额度，不额外开 API key。
         *
         * 但这里必须诚实标出：如果 DSH 那边的额度用尽了，群聊一样会失败。
         * 「不花钱」不等于「不会耗尽」，这两件事别混。
         */
        const hasOwnKey = config.llm.apiKey.trim() !== '';
        checks.push({
          name: '模型',
          ok: true,
          detail: hasOwnKey
            ? `独立客户端：${config.llm.model}（用自己的 key）`
            : 'DSH 模型（在 QQ 插件设置里单独选择）',
        });
        const backend = resolveBackend(config.sing.backend);
        checks.push({
          name: '唱歌后端',
          ok: backend.warning === undefined,
          detail: backend.warning ?? `${backend.backend.name}`,
        });
        const status = bridge?.snapshot();
        checks.push({
          name: '连接',
          ok: status?.link !== undefined && (status.link as { status?: string }).status === 'online',
          detail: status === undefined ? '未启动' : String((status.link as { status?: string }).status ?? '未知'),
        });
        return { ok: checks.every((c) => c.ok), checks };
      }

      // ── 内置曲目 ──
      if (rest === 'qq/scores' && method === 'GET') {
        return {
          ok: true,
          scores: Object.values(BUILTIN_SCORES).map((score) => ({
            title: score.title,
            bpm: score.bpm,
            notes: score.notes.length,
            durationSec: Math.round((score.notes.reduce((max, n) => Math.max(max, n.start + n.dur), 0) * 60) / score.bpm),
          })),
        };
      }

      // ── 离线渲一首歌 ──
      if (rest === 'qq/sing' && method === 'POST') {
        let payload: { song?: unknown; transpose?: unknown; out?: unknown };
        try {
          payload = JSON.parse(body ?? '{}') as typeof payload;
        } catch {
          return { ok: false, message: 'invalid JSON' };
        }
        const song = typeof payload.song === 'string' ? payload.song : '小星星';
        const config = load().config;
        const result = await writeSongToFile({
          config,
          userRoot: deps.userRoot,
          song,
          ...(typeof payload.transpose === 'number' ? { transpose: payload.transpose } : {}),
          ...(typeof payload.out === 'string' ? { out: payload.out } : {}),
        });
        return result;
      }

      // ── 去某个群说一句 ──
      if (rest === 'qq/say' && method === 'POST') {
        if (bridge === undefined) return { ok: false, message: 'QQ 群接入未启动' };
        let payload: { groupId?: unknown; text?: unknown };
        try {
          payload = JSON.parse(body ?? '{}') as typeof payload;
        } catch {
          return { ok: false, message: 'invalid JSON' };
        }
        const groupId = typeof payload.groupId === 'string' ? payload.groupId : '';
        const text = typeof payload.text === 'string' ? payload.text : '';
        if (!/^\d{5,12}$/.test(groupId)) return { ok: false, message: 'groupId 不合法' };
        if (text.trim() === '') return { ok: false, message: 'text 为空' };
        const reply = await bridge.handleOwnerMessage(`说 ${groupId} ${text}`);
        return { ok: true, reply };
      }

      return null;
    },

    async dispose(): Promise<void> {
      const running = bridge;
      bridge = undefined;
      if (running !== undefined) await running.stop();
      cachedConfig = undefined;
      void cachedConfig;
    },
  };
}

/** 供 index.ts 判断「这个路径是不是 QQ 的」（避免每个分支都写一遍前缀判断） */
export function isQqPath(rest: string): boolean {
  return rest === 'qq' || rest.startsWith('qq/');
}

/** 供外部读取当前配置（设置页保存逻辑用） */
export function peekConfig(userRoot: string): QqConfig | undefined {
  const loaded = readQqConfig(qqConfigPath(userRoot));
  return loaded.exists ? loaded.config : undefined;
}

/** 供测试用：默认客户端的构造（不联网，只检查参数归一化） */
export function buildClient(config: QqConfig): ChatClient {
  return createOpenAiClient(config.llm);
}
