/**
 * 云端用的 LLM 客户端（OpenAI 兼容 /chat/completions）。
 *
 * ── 为什么不直接用 DSH 的 `ctx.llm` ──
 * 云端那台机器上没有 DSH 宿主，只有 `node lib/qq.js`。DSH 的 `ctx.llm` 背后是
 * 宿主的凭证与适配器体系，独立进程拿不到。所以云端这条链路自带一个 OpenAI 兼容客户端：
 * DeepSeek 官方、各种中转、本地 vLLM / Ollama（`/v1` 兼容层）都能直接接。
 *
 * 在 DSH 里跑的时候**仍然可以**用这个客户端（配一份 qq.json 即可），也可以由宿主
 * 传一个 `chat` 函数进来复用 `ctx.llm`（见 bridge.ts 的 `llm` 参数）——两条路同一接口。
 *
 * ── 错误口径 ──
 * 一律返回结构化失败（`{ok:false, reason, message}`），不抛、不返回空串当成功。
 * 限流（429）自动退避重试两次，仍然失败就如实报出来——群里「她突然不说话」
 * 最常见的原因就是这里静默吞了错误。
 */

/** 一条对话消息（OpenAI 兼容格式） */
export interface LlmMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/** 生成失败原因 */
export type LlmFailure = {
  ok: false;
  reason: 'no-key' | 'http-error' | 'timeout' | 'bad-response' | 'rate-limited';
  message: string;
};

export type LlmResult = { ok: true; text: string } | LlmFailure;

/** 一张要交给视觉模型的图片 */
export interface ChatImage {
  data: Uint8Array;
  mediaType: string;
  name?: string;
}

/** 生成参数 */
export interface ChatOptions {
  temperature?: number;
  maxTokens?: number;
  timeoutMs?: number;
  /** 要求返回 JSON（支持的模型才给；不支持的会自动退回普通模式重试一次） */
  json?: boolean;
  /** 用途标签（用量统计：reply/gate/hostility/sticker/mood/memory/model-check/gen-test） */
  purpose?: string;
  /** 产生这次调用的群（按群统计） */
  groupId?: string;
  /** 附带图片（视觉模型会真正看到图；不支持图片的模型由适配器降级） */
  images?: ChatImage[];
}

/** 客户端接口（宿主注入与自带实现都满足它） */
export interface ChatClient {
  chat(messages: LlmMessage[], options?: ChatOptions): Promise<LlmResult>;
  /** 展示用名字（日志/面板） */
  readonly label: string;
}

/** 构造参数 */
export interface OpenAiOptions {
  baseUrl: string;
  apiKey: string;
  model: string;
  temperature?: number;
  maxTokens?: number;
  timeoutMs?: number;
  label?: string;
}

/** 把 baseUrl 归一成 `.../chat/completions`（容忍带不带 `/v1`、带不带尾斜杠） */
export function completionsUrl(baseUrl: string): string {
  const trimmed = baseUrl.trim().replace(/\/+$/, '');
  if (trimmed === '') throw new Error('llm.baseUrl 为空');
  if (/\/chat\/completions$/.test(trimmed)) return trimmed;
  if (/\/v\d+$/.test(trimmed)) return `${trimmed}/chat/completions`;
  // 官方接口都在 /v1 下；用户写了域名根也补上（本地 vLLM 默认也是 /v1）
  return `${trimmed}/v1/chat/completions`;
}

/** 从 OpenAI 风格的响应里取正文 */
export function extractText(payload: unknown): string | undefined {
  if (payload === null || typeof payload !== 'object') return undefined;
  const choices = (payload as { choices?: unknown }).choices;
  if (!Array.isArray(choices) || choices.length === 0) return undefined;
  const first = choices[0] as { message?: { content?: unknown }; text?: unknown };
  const content = first.message?.content ?? first.text;
  if (typeof content === 'string') return content;
  // 少数兼容层返回 content 数组（多段）
  if (Array.isArray(content)) {
    const joined = content
      .map((part) => (typeof part === 'string' ? part : typeof (part as { text?: unknown }).text === 'string' ? (part as { text: string }).text : ''))
      .join('');
    return joined === '' ? undefined : joined;
  }
  return undefined;
}

/** 限流/网络类错误值得重试；4xx（除 429）不值得 */
function retryable(status: number | undefined, message: string): boolean {
  if (status === 429 || status === 408 || (status !== undefined && status >= 500)) return true;
  return /timeout|ECONNRESET|ETIMEDOUT|EAI_AGAIN|fetch failed/i.test(message);
}

/** 自带实现（云端链路） */
export function createOpenAiClient(options: OpenAiOptions): ChatClient {
  const url = completionsUrl(options.baseUrl);
  const temperature = options.temperature ?? 1;
  const maxTokens = options.maxTokens ?? 400;
  const timeoutMs = options.timeoutMs ?? 60_000;

  async function once(messages: LlmMessage[], chatOptions: ChatOptions): Promise<LlmResult> {
    const body: Record<string, unknown> = {
      model: options.model,
      messages,
      temperature: chatOptions.temperature ?? temperature,
      max_tokens: chatOptions.maxTokens ?? maxTokens,
      stream: false,
    };
    if (chatOptions.json === true) body.response_format = { type: 'json_object' };

    let response: Response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${options.apiKey}`,
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(chatOptions.timeoutMs ?? timeoutMs),
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      const timedOut = /abort|timeout/i.test(message);
      return { ok: false, reason: timedOut ? 'timeout' : 'http-error', message };
    }

    const raw = await response.text();
    if (!response.ok) {
      const reason = response.status === 429 ? 'rate-limited' : 'http-error';
      return { ok: false, reason, message: `HTTP ${response.status}：${raw.slice(0, 400)}` };
    }
    let payload: unknown;
    try {
      payload = JSON.parse(raw);
    } catch {
      return { ok: false, reason: 'bad-response', message: `返回不是 JSON：${raw.slice(0, 200)}` };
    }
    const text = extractText(payload);
    if (text === undefined || text.trim() === '') {
      return { ok: false, reason: 'bad-response', message: `响应里没有正文：${raw.slice(0, 200)}` };
    }
    return { ok: true, text: text.trim() };
  }

  return {
    label: `openai:${options.model}`,
    async chat(messages, chatOptions = {}) {
      if (options.apiKey.trim() === '') {
        return { ok: false, reason: 'no-key', message: '没有配置 llm.apiKey / 环境变量里的 key' };
      }
      let last: LlmResult = { ok: false, reason: 'http-error', message: '未发起请求' };
      for (let attempt = 0; attempt < 3; attempt += 1) {
        const result = await once(messages, chatOptions);
        if (result.ok) return result;
        last = result;
        const canRetry = retryable(undefined, result.message) && attempt < 2;
        // json 模式被拒（4xx 里明确说 response_format 不支持）→ 去掉该参数重试一次
        if (!result.ok && chatOptions.json === true && /response_format|json_object|unsupported/i.test(result.message)) {
          return once(messages, { ...chatOptions, json: false });
        }
        if (!canRetry) return result;
        // 退避：1s、3s（带抖动）；限流时更久一点
        const wait = (attempt === 0 ? 1000 : 3000) * (result.reason === 'rate-limited' ? 2 : 1);
        await new Promise<void>((resolve) => setTimeout(resolve, wait));
      }
      return last;
    },
  };
}

/**
 * 把模型输出解析成结构化回复。
 *
 * 模型不一定听话（尤其小模型/中转），所以解析策略是**尽力而为**：
 * 1. 先剥 markdown 代码围栏，再找最外层 `{…}`；
 * 2. 解析成功且 `messages` 是非空字符串数组 → 用它；
 * 3. 否则把整段文本按行切（去掉空行与列表符号），每行一条；
 * 4. 一条都没有 → 返回空数组（调用方据此判失败，不硬发空消息）。
 */
export interface ReplyPlan {
  messages: string[];
  action: 'text' | 'voice' | 'sing';
  song?: string;
  /** 想附带的表情包文件名（可选；由 bridge 按概率与白名单决定发不发） */
  sticker?: string;
  /** 不发送的内心吐槽（写进「鲸鱼娘的日记」） */
  thought?: string;
  /** 这条回复的情绪（用于 GPT-SoVITS 选参考音） */
  emotion?: string;
}

export function parseReplyPlan(raw: string): ReplyPlan {
  const text = raw.trim();
  const cleaned = stripFence(text);
  const object = findObject(cleaned);
  if (object !== undefined) {
    try {
      const parsed = JSON.parse(object) as {
        messages?: unknown;
        action?: unknown;
        song?: unknown;
        sticker?: unknown;
        thought?: unknown;
        emotion?: unknown;
      };
      const messages = Array.isArray(parsed.messages)
        ? parsed.messages.filter((m): m is string => typeof m === 'string').map((m) => m.trim()).filter((m) => m !== '')
        : [];
      if (messages.length > 0) {
        const action = parsed.action === 'voice' || parsed.action === 'sing' ? parsed.action : 'text';
        const song = typeof parsed.song === 'string' && parsed.song.trim() !== '' ? parsed.song.trim() : undefined;
        const sticker =
          typeof parsed.sticker === 'string' && parsed.sticker.trim() !== '' ? parsed.sticker.trim() : undefined;
        const thought =
          typeof parsed.thought === 'string' && parsed.thought.trim() !== '' ? parsed.thought.trim() : undefined;
        const emotion =
          typeof parsed.emotion === 'string' && /^(开心|生气|吃惊|中立|难过|厌恶|恐惧)$/.test(parsed.emotion.trim())
            ? parsed.emotion.trim()
            : undefined;
        return {
          messages,
          action,
          ...(song === undefined ? {} : { song }),
          ...(sticker === undefined ? {} : { sticker }),
          ...(thought === undefined ? {} : { thought }),
          ...(emotion === undefined ? {} : { emotion }),
        };
      }
    } catch {
      // 落到下面的按行切分
    }
  }
  const pseudo = parsePseudoPlan(cleaned);
  if (pseudo !== undefined) return pseudo;
  const salvaged = salvagePlan(cleaned);
  if (salvaged !== undefined) return salvaged;
  const lines = cleaned
    .split(/\r?\n+/)
    .map((line) => line.replace(/^\s*(?:[-*•]|\d+[.、)])\s*/, '').trim())
    .filter((line) => {
      if (line === '' || /^```/.test(line)) return false;
      // 模型输出被截断时会退化成 JSON 片段；不要把片段当正文发出去。
      if (/^[{}[\],\s]*$/.test(line)) return false;
      if (/^"(?:messages|action|song|sticker|thought|emotion)"\s*:/.test(line)) return false;
      if (/^\s*(?:thought|messages)\s*[:：]/i.test(line)) return false;
      if (/"messages"\s*:/.test(line) || /"action"\s*:/.test(line)) return false;
      return true;
    })
    .map((line) => line.replace(/^[`"'\s]+|[`"'\s]+$/g, '').trim())
    .filter((line) => line !== '' && !/^[{}[\],]+$/.test(line));
  const thought = extractJsonString(cleaned, 'thought');
  const emotion = parseEmotion(extractJsonString(cleaned, 'emotion'));
  return {
    messages: lines,
    action: 'text',
    ...(thought === undefined ? {} : { thought }),
    ...(emotion === undefined ? {} : { emotion }),
  };
}

/** 兼容模型退化成 `thought: ... / messages: [...]` 的伪格式；绝不把 thought 当正文发出去。 */
function parsePseudoPlan(text: string): ReplyPlan | undefined {
  const messageMatch = /(?:^|\n)\s*messages\s*[:：]\s*([\s\S]*)$/i.exec(text);
  if (messageMatch === null) return undefined;
  const payload = messageMatch[1].trim();
  const messages: string[] = [];
  const start = payload.indexOf('[');
  if (start >= 0) {
    let depth = 0;
    let quote = false;
    let escape = false;
    for (let i = start; i < payload.length; i += 1) {
      const ch = payload[i];
      if (quote) {
        if (escape) escape = false;
        else if (ch === '\\') escape = true;
        else if (ch === '"') quote = false;
        continue;
      }
      if (ch === '"') quote = true;
      else if (ch === '[') depth += 1;
      else if (ch === ']') {
        depth -= 1;
        if (depth === 0) {
          try {
            const parsed = JSON.parse(payload.slice(start, i + 1)) as unknown;
            if (Array.isArray(parsed)) {
              for (const value of parsed) {
                if (typeof value === 'string' && value.trim() !== '') messages.push(value.trim());
              }
            }
          } catch {
            // 落到下面的引号/按行提取
          }
          break;
        }
      }
    }
  }
  if (messages.length === 0) {
    const quoted = /"((?:\\.|[^"\\])*)"/g;
    let match: RegExpExecArray | null;
    while ((match = quoted.exec(payload)) !== null) {
      try {
        const value = JSON.parse(`"${match[1]}"`) as string;
        if (value.trim() !== '') messages.push(value.trim());
      } catch {
        // 忽略损坏的引号片段
      }
    }
  }
  if (messages.length === 0) {
    for (const line of payload.split(/\r?\n+/)) {
      const value = line.replace(/^\s*(?:[-*•]|\d+[.、)])\s*/, '').trim();
      if (value !== '' && !/^[{}[\],]+$/.test(value)) messages.push(value);
    }
  }
  if (messages.length === 0) return undefined;
  const thoughtMatch = /(?:^|\n)\s*thought\s*[:：]\s*([\s\S]*?)(?=\n\s*messages\s*[:：]|$)/i.exec(text);
  const thought = thoughtMatch?.[1]?.trim();
  return {
    messages,
    action: 'text',
    ...(thought === undefined || thought === '' ? {} : { thought }),
  };
}

/** 从被截断/半损坏的 JSON 里抢救 messages 数组和 action。 */
function salvagePlan(text: string): ReplyPlan | undefined {
  const key = text.indexOf('"messages"');
  if (key < 0) return undefined;
  const start = text.indexOf('[', key);
  if (start < 0) return undefined;
  const tail = text.slice(start + 1);
  const end = tail.search(/"action"\s*:|"song"\s*:|"sticker"\s*:|"thought"\s*:/);
  const region = end >= 0 ? tail.slice(0, end) : tail;
  const messages: string[] = [];
  const re = /"((?:\\.|[^"\\])*)"/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(region)) !== null) {
    try {
      const value = JSON.parse(`"${match[1]}"`) as string;
      if (value.trim() !== '') messages.push(value.trim());
    } catch {
      // 跳过坏转义
    }
  }
  if (messages.length === 0) return undefined;
  const actionMatch = /"action"\s*:\s*"(text|voice|sing)"/.exec(text);
  const action = actionMatch?.[1] === 'voice' || actionMatch?.[1] === 'sing' ? actionMatch[1] : 'text';
  const songMatch = /"song"\s*:\s*"((?:\\.|[^"\\])*)"/.exec(text);
  const thought = extractJsonString(text, 'thought');
  const emotion = parseEmotion(extractJsonString(text, 'emotion'));
  return {
    messages,
    action,
    ...(songMatch === null ? {} : { song: songMatch[1] }),
    ...(thought === undefined ? {} : { thought }),
    ...(emotion === undefined ? {} : { emotion }),
  };
}

function parseEmotion(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;
  const text = value.trim();
  return /^(开心|生气|吃惊|中立|难过|厌恶|恐惧)$/.test(text) ? text : undefined;
}

/** 从半损坏的 JSON 文本里抢救一个字符串字段（避免日记因 thought 丢失） */
function extractJsonString(text: string, key: string): string | undefined {
  const match = new RegExp(`"${key}"\\s*:\\s*"((?:\\\\.|[^"\\\\])*)"`).exec(text);
  if (match === null) return undefined;
  try {
    return JSON.parse(`"${match[1]}"`) as string;
  } catch {
    return match[1];
  }
}

/** 去掉围栏 ```json ... ``` */
export function stripFence(text: string): string {
  const match = /```(?:json|JSON)?\s*([\s\S]*?)```/.exec(text);
  return (match?.[1] ?? text).trim();
}

/** 找第一层完整的 {...}（不依赖正则贪婪匹配） */
export function findObject(text: string): string | undefined {
  const start = text.indexOf('{');
  if (start < 0) return undefined;
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < text.length; i += 1) {
    const ch = text[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') {
      inString = true;
      continue;
    }
    if (ch === '{') depth += 1;
    else if (ch === '}') {
      depth -= 1;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  return undefined;
}
