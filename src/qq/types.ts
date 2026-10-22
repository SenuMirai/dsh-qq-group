/**
 * QQ 群接入的类型定义（OneBot 11 事件 / 消息段 / 本模块自己的会话与配置）。
 *
 * ── 为什么单独一个 types 文件 ──
 * 宿主半侧（DSH 内进程）与独立 CLI（云端 `node lib/qq.js`）共用同一份口径；
 * 类型散落在各实现里时，两端一改就容易对不上——这正是本项目在路由上踩过的坑
 * （见 docs/ROADMAP.md「第二套实现对不上」）。这里把线上格式与内部格式分开写清楚：
 *
 *   1. **线上格式**（OneBotEvent / ObSegment）：照抄 NapCat 文档，一个字段都不增不减。
 *   2. **内部格式**（GroupMessage / Reply）：只保留编排需要的东西，不透传原始事件。
 */

/** OneBot 11 上报消息段（接收方向；`data` 的字段随 type 变化，故用宽松结构） */
export interface ObSegment {
  type: string;
  data: Record<string, unknown>;
}

/** OneBot 11 群消息事件（group_message / group 的 message 事件） */
export interface ObGroupMessageEvent {
  post_type: 'message';
  message_type: 'group';
  sub_type?: string;
  time: number;
  self_id: number | string;
  group_id: number | string;
  user_id: number | string;
  message_id: number | string;
  /** 事件原始文本（含 CQ 码的可能性已排除：array 上报格式下这里是纯文本） */
  raw_message?: string;
  message: string | ObSegment[];
  sender?: {
    user_id?: number | string;
    nickname?: string;
    card?: string;
    role?: 'owner' | 'admin' | 'member' | string;
  };
}

/** OneBot 11 私聊消息事件（只用于「主人私聊下指令」，不做群聊处理） */
export interface ObPrivateMessageEvent {
  post_type: 'message';
  message_type: 'private';
  time: number;
  self_id: number | string;
  user_id: number | string;
  message_id: number | string;
  raw_message?: string;
  message: string | ObSegment[];
  sender?: { nickname?: string; card?: string };
}

/** 生命周期/心跳等非消息事件（只关心 bot 是否在线） */
export interface ObMetaEvent {
  post_type: 'meta_event' | 'notice' | 'request' | string;
  meta_event_type?: string;
  self_id?: number | string;
  status?: unknown;
}

export type ObEvent = ObGroupMessageEvent | ObPrivateMessageEvent | ObMetaEvent;

/** 一条被解析过的群消息（内部格式） */
export interface GroupMessage {
  /** 群号（字符串：QQ 号超出 32 位安全整数时数字会精度丢失，一律当字符串传） */
  groupId: string;
  userId: string;
  /** 显示名：优先群名片，其次昵称，最后 QQ 号 */
  name: string;
  /** 群身份（owner/admin/member），用于「主人在某群相当于管理员」的口径 */
  role: string;
  /** 纯文本（@、图片、表情等段已被替换成可读标记） */
  text: string;
  /** 是否 @ 了机器人 */
  atSelf: boolean;
  /** 消息里是否出现了机器人名字（叫名字也算搭话） */
  callSelf: boolean;
  /** 是否有人 @ 全体 */
  atAll: boolean;
  /** 收到的时间（毫秒） */
  at: number;
  /** 原始消息 id（回复引用要用） */
  messageId: string;
  /** 这条消息引用回复的是哪条消息 id（没有引用则为空） */
  replyToId?: string;
  /** 这条消息 @ 了哪些**别人**（不含机器人自己） */
  atOthers?: string[];
  /** 是否包含图片（图要单独取，不进 text） */
  hasImage: boolean;
  /** 图片段（最多保留 2 个；语音/唱歌时按需下载） */
  images: ObSegment[];
  /** 文件段（群文件/文档） */
  files?: ObSegment[];
  /** 合并转发段 */
  forwards?: ObSegment[];
  /** 是否包含语音段（QQ 语音消息 → silk，需要 NapCat 转码） */
  hasVoice: boolean;
}

/** 一次要发出的动作（编排层产出，发送层执行） */
export type QqAction =
  | { kind: 'text'; text: string }
  | { kind: 'voice'; text: string; /** 合成文本（可与气泡文本不同，例如更口语化） */ speak?: string }
  | { kind: 'record'; file: string; /** 已就绪的音频文件（唱歌） */ }
  | { kind: 'image'; file: string }
  | { kind: 'face'; id: string }
  | { kind: 'at'; qq: string };

/** 发送结果 */
export type SendResult =
  | { ok: true; messageId?: string }
  | { ok: false; reason: 'not-connected' | 'api-error' | 'rate-limited' | 'too-long' | 'error'; message: string };

/** 群会话里的一条记录（进模型上下文，也用于去重与「有没有人理她」的判断） */
export interface Turn {
  role: 'user' | 'assistant';
  /** 说话人显示名（assistant 恒为机器人自己的名字） */
  name: string;
  text: string;
  ts: number;
  /** 是否是主动开口（冷场时自己起的话头） */
  proactive?: boolean;
}

/** 连接状态（诊断页/日志用；不静默失败） */
export type LinkState =
  | { status: 'idle' }
  | { status: 'connecting'; url: string }
  | { status: 'online'; selfId: string; since: number }
  | { status: 'reconnecting'; attempt: number; nextAt: number; reason: string }
  | { status: 'failed'; reason: string };

/** 一个群的运行时统计（面板展示；不含隐私内容） */
export interface GroupStats {
  groupId: string;
  /** 群名（首次收到消息时从 get_group_info 取；取不到就空着） */
  name?: string;
  received: number;
  replied: number;
  lastMessageAt?: number;
  lastReplyAt?: number;
  /** 下一次主动开口的时间（enabled 且有人聊过之后才有值） */
  nextProactiveAt?: number;
}
