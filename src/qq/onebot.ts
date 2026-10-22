/**
 * OneBot 11 客户端（NapCat / Lagrange / LLOneBot 通吃）。
 *
 * ── 为什么同时实现 WS 与 HTTP ──
 * NapCat 有两条路：
 *   - **正向 WebSocket**（推荐）：事件从服务器推过来，延迟最低，发消息可以走 WS 也可以走 HTTP；
 *   - **纯 HTTP**：以轮询/无事件的方式工作，只适合「只发不收」或者外部已经有人转发事件。
 * 云端最常用的是「NapCat 在容器里，本进程连它的 WS」。这里两种都实现，但**事件只从 WS 来**：
 * HTTP 模式必须配一个外部的「事件转发」（例如 NapCat 的 HTTP POST 上报打到本进程的
 * `/qq/onebot`），由调用方把事件喂进 `handleEvent`。
 *
 * ── 三条硬规矩 ──
 * 1. **QQ 号一律当字符串**：超过 2^53 的 QQ 号用 number 会精度丢失（NapCat 已改成字符串上报）。
 * 2. **事件风暴要有闸**：群消息一条条来，处理慢了会堆积。这里用有界队列 + 丢弃计数，
 *    丢弃**一定记日志**，不静默。
 * 3. **失败要能看见**：连不上、重连、API 报错、限流，全部进 `LinkState` 与日志，
 *    不假装成功（本项目在语音链路上踩过「静默失败」的坑）。
 */

import { EventEmitter } from 'node:events';

import type { LinkState, ObEvent, ObSegment, SendResult } from './types';

/** 客户端对外事件 */
export interface OneBotEvents {
  state: (state: LinkState) => void;
  event: (event: ObEvent) => void;
  error: (message: string) => void;
}

/** 构造参数 */
export interface OneBotOptions {
  url: string;
  httpUrl: string;
  token: string;
  /** 日志口径 */
  log: (level: 'debug' | 'info' | 'warn' | 'error', message: string) => void;
}

/** 单次 API 调用超时：NapCat 本地调用一般 <100ms，给足 15 秒余量兜卡死 */
const API_TIMEOUT_MS = 15_000;

/** 事件队列上限：超过就丢最旧的并记账（宁可丢事件，不能把内存吃光） */
const EVENT_QUEUE_LIMIT = 2000;

/** 重连退避：1s 起，翻倍到 60s 封顶，带 ±20% 抖动（防止多实例同时重连打爆对端） */
export function backoffMs(attempt: number, random = Math.random): number {
  const base = Math.min(60_000, 1000 * 2 ** Math.max(0, attempt));
  return Math.round(base * (0.8 + random() * 0.4));
}

/** OneBot 使用的字符串化 QQ 号（number → string；已是字符串则原样） */
export function asId(value: unknown): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' && Number.isFinite(value)) return value.toString();
  return '';
}

/**
 * 从 OneBot 消息段里抽纯文本。
 *
 * @param message 消息段数组或 CQ 码字符串
 * @param selfId 机器人 QQ（用于判断 at 段是不是在 @ 自己）
 * @returns 文本与被 @ 的标记
 */
export function parseMessage(
  message: string | ObSegment[],
  selfId: string,
): {
  text: string;
  atSelf: boolean;
  atAll: boolean;
  hasImage: boolean;
  hasVoice: boolean;
  images: ObSegment[];
  files: ObSegment[];
  forwards: ObSegment[];
  replyToId?: string;
  atOthers: string[];
} {
  if (typeof message === 'string') {
    // 纯字符串形态只在「CQ 码上报」时出现：手工解析，不引第三方库
    const atSelf = new RegExp(`\\[CQ:at,qq=${escapeRegExp(selfId)}(?:,[^\\]]*)?\\]`).test(message);
    const atAll = /\[CQ:at,qq=all(?:,[^\]]*)?\]/.test(message);
    const hasImage = /\[CQ:image,/.test(message);
    const hasVoice = /\[CQ:record,/.test(message);
    const replyMatch = /\[CQ:reply,id=([^,\]]+)/.exec(message);
    const atOthers: string[] = [];
    for (const match of message.matchAll(/\[CQ:at,qq=([^,\]]+)/g)) {
      const qq = match[1].trim();
      if (qq !== 'all' && qq !== selfId) atOthers.push(qq);
    }
    const text = message
      .replace(/\[CQ:[^\]]*\]/g, (match) => {
        if (/^\[CQ:at,qq=all/.test(match)) return '@全体成员 ';
        if (/^\[CQ:at,qq=/.test(match)) return '';
        if (/^\[CQ:face,/.test(match)) return '[表情]';
        if (/^\[CQ:image,/.test(match)) return '[图片]';
        if (/^\[CQ:record,/.test(match)) return '[语音]';
        if (/^\[CQ:reply,/.test(match)) return '';
        return '';
      })
      .trim();
    return {
      text,
      atSelf,
      atAll,
      hasImage,
      hasVoice,
      images: [],
      files: [],
      forwards: [],
      atOthers,
      ...(replyMatch === null ? {} : { replyToId: replyMatch[1].trim() }),
    };
  }

  const images: ObSegment[] = [];
  const files: ObSegment[] = [];
  const forwards: ObSegment[] = [];
  const atOthers: string[] = [];
  let replyToId: string | undefined;
  let atSelf = false;
  let atAll = false;
  let hasVoice = false;
  const parts: string[] = [];

  for (const seg of message) {
    switch (seg.type) {
      case 'text': {
        const text = typeof seg.data.text === 'string' ? seg.data.text : '';
        if (text !== '') parts.push(text);
        break;
      }
      case 'at': {
        const qq = asId(seg.data.qq);
        if (qq === 'all') {
          atAll = true;
          parts.push('@全体成员');
        } else if (qq === selfId && selfId !== '') {
          atSelf = true;
        } else if (qq !== '') {
          atOthers.push(qq);
        }
        break;
      }
      case 'reply':
        // 引用回复：记下引用的消息 id，供上层判断「是不是在回过她」
        if (typeof seg.data.id === 'string' || typeof seg.data.id === 'number') {
          replyToId = asId(seg.data.id) || undefined;
        }
        break;
      case 'face':
        parts.push('[表情]');
        break;
      case 'mface':
        parts.push('[商城表情]');
        break;
      case 'image':
        images.push(seg);
        parts.push('[图片]');
        break;
      case 'record':
        hasVoice = true;
        parts.push('[语音]');
        break;
      case 'video':
        parts.push('[视频]');
        break;
      case 'file': {
        files.push(seg);
        const name = typeof seg.data.name === 'string' ? seg.data.name.slice(0, 80) : '';
        parts.push(name === '' ? '[文件]' : `[文件：${name}]`);
        break;
      }
      case 'json':
      case 'xml':
        parts.push('[卡片]');
        break;
      case 'poke':
        parts.push('[戳一戳]');
        break;
      case 'dice':
        parts.push('[骰子]');
        break;
      case 'rps':
        parts.push('[猜拳]');
        break;
      case 'music':
        parts.push('[音乐分享]');
        break;
      case 'forward':
        forwards.push(seg);
        parts.push('[合并转发]');
        break;
      default:
        // 未知段不吞：给个可读占位，模型至少知道「这里有点东西」
        parts.push(`[${seg.type}]`);
        break;
    }
  }

  return {
    text: parts.join('').trim(),
    atSelf,
    atAll,
    hasImage: images.length > 0,
    hasVoice,
    images,
    files,
    forwards,
    atOthers,
    ...(replyToId === undefined ? {} : { replyToId }),
  };
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * 内置 WebSocket 的最小形状（只声明本文件用到的成员）。
 *
 * 为什么不直接写 `WebSocket`：`@types/node` 在 22.x 的某几个小版本里还没声明全局
 * WebSocket 类型，直接引用会 typecheck 失败。用结构化声明 + `globalThis` 取值，
 * 既保留类型安全，也不把运行时版本绑死在某个 d.ts 上。
 */
interface SocketLike {
  readyState: number;
  bufferedAmount: number;
  send(data: string, callback?: (error?: Error) => void): void;
  close(code?: number, reason?: string): void;
  addEventListener(type: 'open', listener: () => void): void;
  addEventListener(type: 'message', listener: (event: { data: unknown }) => void): void;
  addEventListener(type: 'error', listener: (event: { error?: unknown; message?: unknown }) => void): void;
  addEventListener(type: 'close', listener: (event: { code?: number; reason?: string }) => void): void;
}

interface SocketConstructor {
  new (url: string, options?: { headers?: Record<string, string>; protocols?: string | string[] }): SocketLike;
  readonly OPEN: number;
}

/** 取内置 WebSocket 构造器；Node < 22.4 上不存在时返回 undefined（由调用方报明确错误） */
function socketCtor(): SocketConstructor | undefined {
  const ctor = (globalThis as { WebSocket?: unknown }).WebSocket;
  return typeof ctor === 'function' ? (ctor as SocketConstructor) : undefined;
}

/**
 * OneBot 客户端。
 *
 * 用法：
 * ```ts
 * const client = new OneBotClient({ url, httpUrl, token, log });
 * client.on('event', handler);
 * client.connect();
 * await client.sendGroupMsg(groupId, [{ type: 'text', data: { text: 'hi' } }]);
 * ```
 */
export class OneBotClient extends EventEmitter {
  private readonly options: OneBotOptions;
  private socket: SocketLike | undefined;
  private state: LinkState = { status: 'idle' };
  private attempt = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | undefined;
  private closed = false;
  private selfId = '';
  /** 待处理的 API 响应：echo → resolver */
  private readonly pending = new Map<string, { resolve: (value: ApiResponse) => void; timer: ReturnType<typeof setTimeout> }>();
  private echoSeq = 0;
  /** 事件队列：单线程消费，避免同一个群的消息并发处理导致状态错乱 */
  private readonly queue: ObEvent[] = [];
  private draining = false;
  private dropped = 0;

  constructor(options: OneBotOptions) {
    super();
    this.options = options;
    /**
     * 必须有一个 error 监听者。
     *
     * EventEmitter 在「emit('error') 且没有监听者」时会**直接抛出异常**并杀掉进程——
     * 实测踩到：`node lib/qq.js --check` 里连一个不存在的 NapCat，WS 失败触发
     * `emit('error')`，而那里没订阅（只有一个等待状态的 Promise），于是整个进程
     * 以 `ERR_UNHANDLED_ERROR` 崩掉，连诊断结果都来不及打印。
     *
     * 云上更糟：容器会反复重启，日志里只有一段看不懂的堆栈。
     * 所以这里兜一个空监听——真正的处理靠 `error` 事件的订阅者，但**没人订也不能崩**。
     */
    this.on('error', () => {
      /* 兜底：见上。订阅者可以照常 listen('error') */
    });
  }

  /** 当前连接状态（只读快照） */
  get linkState(): LinkState {
    return this.state;
  }

  /** 机器人自己的 QQ 号（登录后才知道；未知时为空串） */
  get selfQq(): string {
    return this.selfId;
  }

  private setState(next: LinkState): void {
    this.state = next;
    this.emit('state', next);
  }

  private log(level: 'debug' | 'info' | 'warn' | 'error', message: string): void {
    this.options.log(level, message);
  }

  /** 建立连接（幂等；已连接时直接返回） */
  connect(): void {
    if (this.closed) throw new Error('客户端已关闭，不能重连');
    if (this.socket !== undefined) return;
    this.openSocket();
  }

  private openSocket(): void {
    const { url, token } = this.options;
    this.setState({ status: 'connecting', url });
    const Ctor = socketCtor();
    if (Ctor === undefined) {
      this.setState({
        status: 'failed',
        reason: '当前 Node 没有内置 WebSocket（需要 Node ≥ 22.4）；请升级 Node，或把 mode 改成 http',
      });
      return;
    }
    const headers: Record<string, string> = {};
    if (token !== '') headers.authorization = `Bearer ${token}`;

    let socket: SocketLike;
    try {
      socket = new Ctor(url, { headers });
    } catch (e) {
      // 构造期就失败（URL 非法）：不要无限重连，直接报失败
      this.setState({ status: 'failed', reason: e instanceof Error ? e.message : String(e) });
      return;
    }
    this.socket = socket;

    socket.addEventListener('open', () => {
      this.attempt = 0;
      this.log('info', `[onebot] 已连接 ${url}`);
      // 登录信息要主动问一次：self_id 用于判断「有没有 @ 我」
      void this.call('get_login_info').then((response) => {
        const userId = asId((response.data as { user_id?: unknown } | undefined)?.user_id);
        if (userId !== '') this.selfId = userId;
        this.setState({ status: 'online', selfId: this.selfId, since: Date.now() });
        this.log('info', `[onebot] 登录成功 self=${this.selfId || '未知'}`);
      });
    });

    socket.addEventListener('message', (event) => {
      const data = event.data;
      let parsed: unknown;
      try {
        parsed = JSON.parse(typeof data === 'string' ? data : String(data));
      } catch {
        this.log('warn', '[onebot] 收到非 JSON 帧，已丢弃');
        return;
      }
      try {
        this.dispatch(parsed);
      } catch (e) {
        // 最外层兜底：dispatch 里的任何同步异常都不能穿透 WebSocket 事件
        this.log('error', `[onebot] 分发消息抛错：${e instanceof Error ? e.message : String(e)}`);
      }
    });

    socket.addEventListener('error', (event) => {
      const detail = describeSocketError(event);
      this.log('warn', `[onebot] 连接错误：${detail}`);
      this.emit('error', detail);
    });

    socket.addEventListener('close', (event) => {
      this.socket = undefined;
      // 未完成的 API 调用不能永远挂着
      this.failPending('连接已断开');
      if (this.closed) {
        this.setState({ status: 'idle' });
        return;
      }
      const detail = event.reason !== undefined && event.reason !== '' ? `：${event.reason}` : '';
      const why = `连接关闭（code ${event.code ?? '未知'}${detail}）`;
      const delay = backoffMs(this.attempt);
      this.attempt += 1;
      this.setState({ status: 'reconnecting', attempt: this.attempt, nextAt: Date.now() + delay, reason: why });
      this.log('warn', `[onebot] ${why}，${Math.round(delay / 1000)} 秒后重连（第 ${this.attempt} 次）`);
      this.reconnectTimer = setTimeout(() => {
        this.reconnectTimer = undefined;
        if (!this.closed) this.openSocket();
      }, delay);
    });
  }

  /** 分派一帧：API 响应 → 兑现等待者；事件 → 入队 */
  private dispatch(frame: unknown): void {
    if (frame === null || typeof frame !== 'object') return;
    const obj = frame as Record<string, unknown>;
    // API 响应：有 echo 且没有 post_type
    if (obj.post_type === undefined && typeof obj.echo === 'string') {
      const waiting = this.pending.get(obj.echo);
      if (waiting === undefined) {
        this.log('debug', `[onebot] 收到无人认领的响应 echo=${obj.echo}`);
        return;
      }
      this.pending.delete(obj.echo);
      clearTimeout(waiting.timer);
      waiting.resolve(obj as ApiResponse);
      return;
    }
    if (obj.post_type === 'meta_event') {
      const meta = obj as { meta_event_type?: string; self_id?: unknown };
      if (meta.self_id !== undefined) {
        const id = asId(meta.self_id);
        if (id !== '' && this.selfId === '') this.selfId = id;
      }
      return;
    }
    // 群消息/私聊事件本身就带 self_id：**必须先从这里学**，再入队。
    //
    // 为什么不能只靠 get_login_info：那个调用是异步的，而服务器可能在响应到达**之前**
    // 就推了消息。此时 selfQq 还是空的，`parseMessage` 认不出 @ 自己 —— 表现就是
    // 「明明 @ 了她，她却像没看见」（在群里会非常尴尬，而且很难查）。
    // 事件的 self_id 是同一份信息，且先到先得，用它兜住这个时间窗。
    const eventSelfId = asId((obj as { self_id?: unknown }).self_id);
    if (eventSelfId !== '' && this.selfId === '') {
      this.selfId = eventSelfId;
      // 已经接上了：补一次状态更新，让面板立刻能看到 QQ 号
      if (this.state.status === 'connecting') {
        this.setState({ status: 'online', selfId: this.selfId, since: Date.now() });
      }
    }
    this.enqueue(obj as unknown as ObEvent);
  }

  private enqueue(event: ObEvent): void {
    if (this.queue.length >= EVENT_QUEUE_LIMIT) {
      this.queue.shift();
      this.dropped += 1;
      if (this.dropped === 1 || this.dropped % 100 === 0) {
        this.log('warn', `[onebot] 事件队列已满，丢弃最旧的事件（累计丢弃 ${this.dropped} 条）`);
      }
    }
    this.queue.push(event);
    void this.drain().catch((e) => {
      this.log('error', `[onebot] 事件消费异常：${e instanceof Error ? e.message : String(e)}`);
    });
  }

  /** 串行消费事件：同一个群的消息不会并发处理，避免「两条回复同时生成」 */
  private async drain(): Promise<void> {
    if (this.draining) return;
    this.draining = true;
    try {
      while (this.queue.length > 0) {
        const event = this.queue.shift();
        if (event === undefined) break;
        try {
          this.emit('event', event);
        } catch (e) {
          this.log('error', `[onebot] 事件处理抛错：${e instanceof Error ? e.message : String(e)}`);
        }
        // 让出事件循环：事件可能很密，不能把微任务队列堵死
        await new Promise<void>((resolve) => setImmediate(resolve));
      }
    } finally {
      this.draining = false;
    }
  }

  /** 所有等待中的 API 调用就地失败 */
  private failPending(reason: string): void {
    for (const [, waiting] of this.pending) {
      clearTimeout(waiting.timer);
      waiting.resolve({ status: 'failed', retcode: -1, message: reason });
    }
    this.pending.clear();
  }

  /**
   * 调一个 OneBot API。
   * @param action 接口名（如 `send_group_msg`）
   * @param params 参数
   * @returns 原始响应；连接不可用时返回 `{status:'failed'}`（不抛，调用方看 status）
   */
  async call(action: string, params: Record<string, unknown> = {}): Promise<ApiResponse> {
    const socket = this.socket;
    const Ctor = socketCtor();
    if (socket === undefined || Ctor === undefined || socket.readyState !== Ctor.OPEN) {
      // WS 不通时退回 HTTP：NapCat 的 HTTP 接口能独立工作
      return this.callHttp(action, params);
    }
    this.echoSeq += 1;
    const echo = `wbg-${Date.now().toString(36)}-${this.echoSeq}`;
    const payload = JSON.stringify({ action, params, echo });
    return new Promise<ApiResponse>((resolve) => {
      const timer = setTimeout(() => {
        this.pending.delete(echo);
        resolve({ status: 'failed', retcode: -2, message: `接口 ${action} 超时（${API_TIMEOUT_MS} ms）` });
      }, API_TIMEOUT_MS);
      this.pending.set(echo, { resolve, timer });
      try {
        socket.send(payload, (error?: Error) => {
          if (error === undefined) return;
          this.pending.delete(echo);
          clearTimeout(timer);
          resolve({ status: 'failed', retcode: -3, message: error.message });
        });
      } catch (e) {
        this.pending.delete(echo);
        clearTimeout(timer);
        resolve({ status: 'failed', retcode: -3, message: e instanceof Error ? e.message : String(e) });
      }
    });
  }

  /** 纯 HTTP 调用（WS 不通，或本来就用 HTTP 模式） */
  private async callHttp(action: string, params: Record<string, unknown>): Promise<ApiResponse> {
    const base = this.options.httpUrl.replace(/\/+$/, '');
    if (base === '') return { status: 'failed', retcode: -4, message: '没有配置 OneBot HTTP 地址' };
    const url = `${base}/${action}`;
    const headers: Record<string, string> = { 'content-type': 'application/json' };
    if (this.options.token !== '') headers.authorization = `Bearer ${this.options.token}`;
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(params),
        signal: AbortSignal.timeout(API_TIMEOUT_MS),
      });
      const text = await response.text();
      try {
        return JSON.parse(text) as ApiResponse;
      } catch {
        return { status: 'failed', retcode: -5, message: `HTTP ${response.status} 返回非 JSON：${text.slice(0, 200)}` };
      }
    } catch (e) {
      return { status: 'failed', retcode: -6, message: e instanceof Error ? e.message : String(e) };
    }
  }

  /** 发群消息（消息段数组） */
  async sendGroupMsg(groupId: string, message: ObSegment[] | string): Promise<SendResult> {
    const response = await this.call('send_group_msg', { group_id: groupId, message });
    return toSendResult(response);
  }

  /** 发私聊消息 */
  async sendPrivateMsg(userId: string, message: ObSegment[] | string): Promise<SendResult> {
    const response = await this.call('send_private_msg', { user_id: userId, message });
    return toSendResult(response);
  }

  /** 取群信息（群名等）；失败返回 undefined，不抛 */
  async getGroupInfo(groupId: string): Promise<{ groupName: string } | undefined> {
    const response = await this.call('get_group_info', { group_id: groupId });
    if (response.status !== 'ok') return undefined;
    const data = response.data as { group_name?: unknown } | undefined;
    const name = typeof data?.group_name === 'string' ? data.group_name : '';
    return name === '' ? undefined : { groupName: name };
  }

  /**
   * 取文件（图片/语音）。
   * NapCat 的 `get_file` 会返回 base64 或本地路径；本方法只负责拿 base64。
   * @returns data URL（可直接塞进 image/record 段），或 undefined
   */
  async getFileBase64(file: string): Promise<string | undefined> {
    const response = await this.call('get_file', { file });
    if (response.status !== 'ok') return undefined;
    const data = response.data as { base64?: unknown; file?: unknown } | undefined;
    if (typeof data?.base64 === 'string' && data.base64 !== '') return `base64://${data.base64}`;
    return undefined;
  }

  /** 主动断开（插件卸载 / 进程退出）；不再重连 */
  async close(): Promise<void> {
    this.closed = true;
    if (this.reconnectTimer !== undefined) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = undefined;
    }
    this.failPending('客户端关闭');
    const socket = this.socket;
    this.socket = undefined;
    if (socket !== undefined) {
      await new Promise<void>((resolve) => {
        const timer = setTimeout(resolve, 2000);
        try {
          socket.addEventListener('close', () => {
            clearTimeout(timer);
            resolve();
          });
          socket.close();
        } catch {
          clearTimeout(timer);
          resolve();
        }
      });
    }
    this.setState({ status: 'idle' });
  }
}

/** 浏览器风格 error 事件里没有 message，只有 error 或 Event；统一成一句人话 */
function describeSocketError(event: { error?: unknown; message?: unknown }): string {
  if (event.error instanceof Error) return event.error.message;
  if (typeof event.error === 'string') return event.error;
  if (typeof event.message === 'string') return event.message;
  return '连接错误（未提供原因）';
}

/** OneBot API 响应（宽松：data 结构随 action 变化） */
export interface ApiResponse {
  status?: string;
  retcode?: number;
  data?: unknown;
  message?: string;
  wording?: string;
  echo?: string;
}

/** 把 API 响应翻成统一结果；限流等错误归到明确 reason，不伪装成功 */
export function toSendResult(response: ApiResponse): SendResult {
  if (response.status === 'ok' || response.retcode === 0) {
    const data = response.data as { message_id?: unknown } | undefined;
    const messageId = asId(data?.message_id);
    return messageId === '' ? { ok: true } : { ok: true, messageId };
  }
  const message = response.message ?? response.wording ?? '未知错误';
  const retcode = response.retcode ?? -1;
  // OneBot 的两种限流形态都要认：
  //   1) 文案里有「频繁/过快/风控」（腾讯侧的软提示）
  //   2) retcode 是风控专用码（NapCat 用 1200 表示发送过于频繁）
  if (retcode === 1200 || /rate|limit|频率|过快|风控|过多|频繁/i.test(message)) {
    return { ok: false, reason: 'rate-limited', message: `接口限流（retcode ${retcode}）：${message}` };
  }
  if (/too long|过长|太长/i.test(message)) {
    return { ok: false, reason: 'too-long', message: `消息过长（retcode ${retcode}）：${message}` };
  }
  return { ok: false, reason: 'api-error', message: `接口失败（retcode ${retcode}）：${message}` };
}
