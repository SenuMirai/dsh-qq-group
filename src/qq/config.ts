/**
 * QQ 群接入的配置（`$DSH_HOME/dsh-whale-girl/qq.json`）。
 *
 * ── 为什么单独一个文件，而且**不**复用 main-config.jsonc ──
 * 与 docs/VOICE.md 里 voice.json 的理由完全一致：`main-config.jsonc` 有严格逐字段校验和
 * 「整段替换」语义，QQ 是主机侧能力（连接地址、口令、群策略），混进去会让
 * 「配置非法 → 桌宠不显示」这类问题牵连消息接入。分成两份，互不影响。
 *
 * ── 归一化的原则 ──
 * 所有字段都给默认值、都夹到合法区间，**但不猜用户意图**：
 * 写错的类型（字符串写成数字）报错说清楚是哪一项，而不是默默用默认值——
 * 否则「我明明配了 5 条，怎么只发 1 条」永远查不出来。
 */

/** 一次连发的配置 */
export interface BurstConfig {
  /** 一次连发最少几条（1 = 只发一条） */
  min: number;
  /** 一次连发最多几条 */
  max: number;
  /** 连发之间的间隔（毫秒区间） */
  gapMs: [number, number];
}

/** 冷场主动开口的节奏 */
export interface ProactiveConfig {
  /** 是否启用冷场主动开口 */
  enabled: boolean;
  /** 群里多久没人说话算「冷场」（毫秒） */
  minIdleMs: number;
  /** 冷场后第一次开口的延迟（毫秒） */
  firstDelayMs: number;
  /** 每次开口后没人理，下一次延迟 ×growth */
  growth: number;
  /** 延迟上限（毫秒） */
  maxDelayMs: number;
  /** 有人说话就重置到 firstDelayMs */
  resetOnHuman: boolean;
  /** 一天最多主动开口几次（0 = 不限） */
  maxPerDay: number;
  /** legacy = 固定退避计时；dice = 带概率/峰谷/时机的命中线 */
  mode: 'legacy' | 'dice';
  /** dice 模式两次尝试的最小间隔 */
  intervalMs: number;
  /** 峰时基础命中线（0~100） */
  peakLine: number;
  /** 谷时基础命中线（0~100） */
  offPeakLine: number;
  /** 安静时段（小时，含起不含止；start===end = 关闭） */
  quietStart: number;
  quietEnd: number;
  /** 距上次人类说话 < nearMinutes → 命中线 × nearFactor */
  nearMinutes: number;
  nearFactor: number;
  /** 距上次人类说话 > farMinutes → 命中线 × farFactor */
  farMinutes: number;
  farFactor: number;
  /** 每次没命中攒多少百分点，最多 missBonusMax */
  missBonus: number;
  missBonusMax: number;
  /** 主动开口后的独立冷却 */
  cooldownMs: number;
  /** 试运行：只记录，不实际发送 */
  trial: boolean;
}

/** 单个群的策略 */
export interface GroupPolicy {
  enabled: boolean;
  /** 群备注名（只用于日志与面板，不参与判断） */
  name: string;
  /** @ 她就回 */
  replyOnAt: boolean;
  /** 叫她的名字就回 */
  replyOnName: boolean;
  /** 有人聊天时主动插话 */
  activeChat: boolean;
  /** 插话概率（0~1）：每「一轮人说话结束」掷一次 */
  replyChance: number;
  /** 价值评分阈值（0~100）：分数达到它才进入候选（再按分数概率 + 闸门） */
  scoreThreshold: number;
  /** 连发条数与间隔 */
  burst: BurstConfig;
  /** 两次回复之间的最小间隔（毫秒） */
  cooldownMs: number;
  /** 10 分钟内最多回几条消息（防刷屏） */
  maxRepliesPer10Min: number;
  /** 10 分钟内最多回复多少条「直接对话」（@ / 叫名字 / 引用 / 接着聊） */
  maxDirectRepliesPer10Min: number;
  /** 每次带给模型的最近消息条数 */
  contextTurns: number;
  /** 上下文策略：full=总是带 contextTurns；adaptive=自包含消息少带，指代/追问再带全量 */
  contextMode: 'full' | 'adaptive';
  /** adaptive 模式下，自包含消息最少带几条 */
  adaptiveMinTurns: number;
  /** 是否在直接回复后做情绪判断（多一次模型调用） */
  moodJudge: boolean;
  /** 目标消息已被后续消息隔开时，发送时带 QQ 引用 */
  quoteWhenSeparated: boolean;
  /** 每群保留的原始消息上限 */
  memoryMaxTurns: number;
  /** 记忆 token 预算（估算） */
  memoryMaxTokens: number;
  /** 摘要最大字符数 */
  summaryMaxChars: number;
  /** 压缩方式 */
  compressMode: 'extractive' | 'llm' | 'hybrid';
  /** 每新增多少条触发一次压缩 */
  compressEveryTurns: number;
  /** 关键记忆条数上限 */
  keyMemoryMax: number;
  /** 启用记忆 v3（证据召回/淡忘）；关掉则退回旧 keyMemories 注入 */
  memoryV3Enabled: boolean;
  /** 每多少轮尝试提炼一次 v3 记忆（0 = 只在压缩时写） */
  memoryV3ExtractEveryTurns: number;
  /** v3 一次注入条数/字数/证据门槛 */
  memoryV3MaxItems: number;
  memoryV3MaxChars: number;
  memoryV3Threshold: number;
  /** 启用按群心情 v1 */
  moodEnabled: boolean;
  /** 心情基线 0~100 */
  moodBaseline: number;
  /** 心情下限 */
  moodFloor: number;
  /** 回稳半衰期（小时） */
  moodHalfLifeHours: number;
  /** 注入可信度门槛 0~100 */
  moodConfidence: number;
  /** 每天最多把心情说给它听几次 */
  moodDailyInject: number;
  /** 压缩掉的原文是否归档 */
  archiveEnabled: boolean;
  /** 文件读取总开关：off / all / custom */
  fileReadMode: 'off' | 'all' | 'custom';
  /** custom 下启用的文件读取条件（可多选） */
  fileReadModes: Array<'at' | 'context' | 'question'>;
  /** 单个文件最大 MB */
  fileMaxMB: number;
  /** 提取文本最大字符数 */
  fileMaxChars: number;
  /** 每天最多读多少个文件 */
  fileDailyLimit: number;
  /** 合并转发读取：off / all / custom */
  forwardReadMode: 'off' | 'all' | 'custom';
  /** custom 下启用的转发读取条件 */
  forwardReadModes: Array<'at' | 'context' | 'question'>;
  /** 最多展开多少条转发节点 */
  forwardMaxNodes: number;
  /** 转发文本最大字符数 */
  forwardMaxChars: number;
  /** 冷场主动开口 */
  proactive: ProactiveConfig;
  /** 回复里带语音的概率（0~1；独立掷骰，不再依赖模型选 action=voice） */
  voiceChance: number;
  /** 被明确要求发语音时的概率（0~1；100% = 必发） */
  requestedVoiceChance: number;
  /** 超过多少字不转语音（0 = 不限制） */
  voiceMaxChars: number;
  /** 主动开口时用语音的概率（0~1） */
  proactiveVoiceChance: number;
  /** 回复里唱歌的概率（0~1，仅当被要求或概率命中） */
  singChance: number;
  /** 被明确要求唱歌时的概率（0~1；100% = 必唱） */
  requestedSingChance: number;
  /** 被明确要求唱歌时是否唱 */
  singOnRequest: boolean;
  /** 是否允许在群里发图（表情包） */
  imageEnabled: boolean;
  /** 模型想发表情包时，真的发出去的概率（0~1；防刷屏） */
  imageChance: number;
  /** 允许模型在回复里自主点名发表情包 */
  stickerModelChoice: boolean;
  /** 允许每轮按 imageChance 强制自动发图 */
  stickerAutoChance: boolean;
  /** 群友明确要求发图/表情包时，真的发出去的概率（0~1；100% 必发） */
  requestedImageChance: number;
  /** 允许在“爆个照/看看你/看看尾巴”时发鲸鱼娘自拍照 */
  selfieEnabled: boolean;
  /** 明确要求自拍/尾巴时允许发 */
  selfieOnRequest: boolean;
  /** 允许按 selfieChance 随机发（未明确要求时） */
  selfieAutoChance: boolean;
  /** 自拍发送概率（0~1；100% 必发，前提是有素材） */
  selfieChance: number;
  /** 额外的自拍触发词（部位/称呼） */
  selfieKeywords: string[];
  /**
   * 什么时候把群友图片交给视觉模型：
   * off（全关）/ all（所有图）/ custom（按 imageViewModes 多选）
   */
  imageView: 'off' | 'all' | 'custom';
  /** custom 模式下启用的看图条件（可多选） */
  imageViewModes: Array<'at' | 'context' | 'question'>;
  /** 关键词 → 接话概率（0~1）：聊到这些词时，等这一波说完再接 */
  keywordChances: Record<string, number>;
  /** 群成员 QQ → 接话概率（0~1）：这些人说话时更容易接 */
  memberChances: Record<string, number>;
  /** 刚被直接对话后的「兴奋期」里，闲聊接话概率（0~1） */
  engagedChance: number;
  /** 闲聊/兴奋期命中后，是否再让模型判断一次「该不该插话」（v2 接话闸门） */
  llmGate: boolean;
  /** 兴奋期持续分钟 */
  engageMinutes: number;
}

/** 大模型接入（云端没有 DSH 宿主，必须自带 API） */
export interface LlmConfig {
  /** OpenAI 兼容的 baseUrl（DeepSeek / 各类中转都行） */
  baseUrl: string;
  apiKey: string;
  /** 从环境变量读 key（优先于 apiKey；便于用 docker secret / systemd Environment） */
  apiKeyEnv: string;
  model: string;
  temperature: number;
  maxTokens: number;
  timeoutMs: number;
}

/** TTS 配置（与 voice.json 同构，另有 pitch/volume） */
export interface QqTtsConfig {
  voice: string;
  rate: string;
  pitch: string;
  volume: string;
  /** edge = 内置 edge-tts；cosyvoice/indextts = 本地 HTTP 网关 */
  provider: 'edge' | 'cosyvoice' | 'kokoro' | 'gpt-sovits' | 'indextts';
  /** 本地 TTS 网关，如 http://127.0.0.1:50121 */
  endpoint: string;
  /** 情感/语气/风格描述（本地网关使用） */
  style: string;
  /** 显式指定 Python 解释器；空 = 自动探测 */
  pythonPath: string;
  /** 语音缓存目录（空 = 用户目录下的 cache/tts） */
  cacheDir: string;
  /** 插件启动时用来拉起本地 TTS 服务的脚本（.bat/.ps1；空 = 不自动拉起） */
  serviceScript: string;
}

/** 唱歌后端名：pitch = A 档（TTS 声线 + 重采样），diffsinger / rvc = 预留 */
export type SingBackendName = 'pitch' | 'diffsinger' | 'rvc';

/** 唱歌与混音配置 */
export interface QqSingConfig {
  /** 用哪个后端（A 档是 pitch；B/C 档接口已留，见 docs/QQ.md） */
  backend: SingBackendName;
  /** 全局移调（半音），对所有乐谱生效 */
  transpose: number;
  /** B 档音源库目录（DiffSinger / OpenUtau 音源） */
  voicebankDir: string;
  /** C 档模型路径（RVC .pth） */
  rvcModel: string;
  /** 乐谱目录（*.score.json） */
  scoreDir: string;
  /** 混音参数 */
  mix: MixConfig;
}

/** RVC 外部 worker 配置（语音/唱歌共用） */
export interface QqRvcConfig {
  enabled: boolean;
  /** 模型目录：扫描 .pth/.onnx + .index */
  modelsDir: string;
  /** Python 解释器；空 = python */
  pythonPath: string;
  /** CPU pth worker 脚本路径 */
  scriptPath: string;
  /** ONNX/DirectML worker 脚本；空 = 同目录 rvc_onnx_worker.py */
  onnxScriptPath: string;
  /** ONNX venv 的 Python；空 = 同目录 venv-onnx */
  onnxPythonPath: string;
  /** 模型路径；留空回退 sing.rvcModel */
  modelPath: string;
  indexPath: string;
  device: 'auto' | 'cpu' | 'dml' | 'cuda';
  pitch: number;
  /** 特征检索比例 0~1 */
  indexRate: number;
  /** 保护清辅音 0~0.5 */
  protect: number;
  /** 音高滤波半径 0~7 */
  filterRadius: number;
  /** 响度包络混合 0~1 */
  rmsMixRate: number;
  /** 音高提取算法 */
  f0Method: 'rmvpe' | 'pm';
  timeoutMs: number;
  maxSeconds: number;
}

/** 混音链参数（全部可调，见 src/sound/mix.ts） */
export interface MixConfig {
  /** 总增益（dB） */
  gainDb: number;
  /** 人声 EQ：低频切除（Hz，0 = 不切） */
  highpassHz: number;
  /** 人声 EQ：中频提升（dB，1000~4000 Hz） */
  presenceDb: number;
  /** 人声 EQ：高频空气感（dB，8000 Hz 以上） */
  airDb: number;
  /** 压缩：门限（dB） */
  compressThresholdDb: number;
  /** 压缩：压缩比 */
  compressRatio: number;
  /** 混响：湿声比例（0~1） */
  reverbWet: number;
  /** 混响：衰减秒数 */
  reverbDecay: number;
  /** 混响：预延迟（毫秒） */
  reverbPreDelayMs: number;
  /** 立体声宽度（0~2；1 = 原样） */
  stereoWidth: number;
  /** 和声层数（0 = 不要和声） */
  harmonyLayers: number;
  /** 和声移调（半音，正负都行；常见 -12 / +5 / +7） */
  harmonySemitones: number;
  /** 和声相对主唱的音量（0~1） */
  harmonyGain: number;
  /** 限幅器天花板（dBFS，通常 -1） */
  limiterCeilingDb: number;
}

/** 顶层配置 */
export interface QqConfig {
  /** 总开关 */
  enabled: boolean;
  /** 连接方式：NapCat 正向 WebSocket（推荐）或纯 HTTP 反查 */
  mode: 'ws' | 'http';
  /** OneBot WebSocket 地址（mode=ws 用） */
  url: string;
  /** OneBot HTTP 地址（发文件、取图片、部分接口走这里） */
  httpUrl: string;
  /** OneBot access_token（配置了就带上） */
  token: string;
  /** 机器人自称（群里叫这个名字也算找她） */
  selfName: string;
  /** 主人的 QQ 号（私聊指令、权限判断） */
  ownerQq: string;
  /** 群策略表（key = 群号） */
  groups: Record<string, GroupPolicy>;
  /** 没列出的群怎么处理 */
  defaultGroup: GroupPolicy;
  llm: LlmConfig;
  tts: QqTtsConfig;
  sing: QqSingConfig;
  rvc: QqRvcConfig;
  /** 管理接口的访问令牌（云上必须设置；空 = 只允许本机） */
  adminToken: string;
  /** 日志级别 */
  logLevel: 'debug' | 'info' | 'warn' | 'error';
}

/** 默认的群策略：新群直接用它，也是配置里缺字段时的兜底 */
export function defaultGroupPolicy(): GroupPolicy {
  return {
    enabled: false,
    name: '',
    replyOnAt: true,
    replyOnName: true,
    activeChat: true,
    replyChance: 0.08,
    scoreThreshold: 50,
    keywordChances: {
      deepseek: 0.85,
      'deepseek-v4': 0.85,
      鲸鱼: 0.9,
      小鲸鱼: 0.9,
      鲸鱼娘: 0.95,
      大肥鱼: 0.9,
      ai: 0.45,
      机器人: 0.45,
    },
    memberChances: {},
    engagedChance: 0.8,
    llmGate: true,
    engageMinutes: 10,
    burst: { min: 1, max: 3, gapMs: [1200, 4000] },
    cooldownMs: 45_000,
    maxRepliesPer10Min: 6,
    maxDirectRepliesPer10Min: 20,
    contextTurns: 24,
    contextMode: 'adaptive',
    adaptiveMinTurns: 4,
    moodJudge: true,
    quoteWhenSeparated: true,
    memoryMaxTurns: 200,
    memoryMaxTokens: 12000,
    summaryMaxChars: 2000,
    compressMode: 'hybrid',
    compressEveryTurns: 40,
    keyMemoryMax: 50,
    memoryV3Enabled: true,
    memoryV3ExtractEveryTurns: 12,
    memoryV3MaxItems: 6,
    memoryV3MaxChars: 800,
    memoryV3Threshold: 0.35,
    moodEnabled: true,
    moodBaseline: 70,
    moodFloor: 0,
    moodHalfLifeHours: 12,
    moodConfidence: 60,
    moodDailyInject: 6,
    archiveEnabled: true,
    fileReadMode: 'custom',
    fileReadModes: ['at', 'question'],
    fileMaxMB: 10,
    fileMaxChars: 30000,
    fileDailyLimit: 20,
    forwardReadMode: 'custom',
    forwardReadModes: ['at', 'question'],
    forwardMaxNodes: 50,
    forwardMaxChars: 10000,
    proactive: {
      enabled: true,
      minIdleMs: 5 * 60_000,
      firstDelayMs: 10 * 60_000,
      growth: 1.25,
      maxDelayMs: 60 * 60_000,
      resetOnHuman: true,
      maxPerDay: 8,
      mode: 'dice',
      intervalMs: 30 * 60_000,
      peakLine: 20,
      offPeakLine: 60,
      quietStart: 1,
      quietEnd: 8,
      nearMinutes: 20,
      nearFactor: 0.15,
      farMinutes: 360,
      farFactor: 1.5,
      missBonus: 10,
      missBonusMax: 40,
      cooldownMs: 20 * 60_000,
      trial: true,
    },
    voiceChance: 0.25,
    requestedVoiceChance: 1,
    voiceMaxChars: 80,
    proactiveVoiceChance: 0.1,
    singChance: 0.04,
    requestedSingChance: 1,
    singOnRequest: true,
    imageEnabled: false,
    imageChance: 0.2,
    stickerModelChoice: true,
    stickerAutoChance: true,
    requestedImageChance: 0.9,
    selfieEnabled: true,
    selfieOnRequest: true,
    selfieAutoChance: false,
    selfieChance: 0.8,
    selfieKeywords: ['尾巴', '耳朵', '鱼尾', '头发', '脸', '眼睛', '衣服', '裙子', '自拍', '长什么样', '长啥样'],
    imageView: 'custom',
    imageViewModes: ['at'],
  };
}

/**
 * 默认混音参数。
 *
 * ── 和声为什么是 +7 / 0.12（五度、很轻）而不是 -12 / 0.22 ──
 * 实测：低八度和声（-12）在 0.22 的音量下，会在成品里造出**和主音几乎一样响的低八度成分**
 * （测下来占主音的 22%）。后果有两个，都是真的：
 *   1. 听感上糊——同一个旋律低八度跟着唱，音色变浊；
 *   2. 音高检测（自相关）会锁到低八度上，导致「跑调」的假象，排查时非常误导。
 * 五度（+7）是自然的和声关系，光听也觉得"丰满"而不是"重叠"，音高感也稳。
 */
export function defaultMix(): MixConfig {
  return {
    gainDb: 0,
    highpassHz: 90,
    presenceDb: 2.5,
    airDb: 1.5,
    compressThresholdDb: -22,
    compressRatio: 3,
    reverbWet: 0.22,
    reverbDecay: 1.8,
    reverbPreDelayMs: 25,
    stereoWidth: 1.2,
    harmonyLayers: 1,
    harmonySemitones: 7,
    harmonyGain: 0.12,
    limiterCeilingDb: -1,
  };
}

/** 默认配置（写进用户的 qq.json 方便改；也用于「没配任何东西」时的行为） */
export function defaultConfig(): QqConfig {
  return {
    enabled: false,
    mode: 'ws',
    url: 'ws://127.0.0.1:3001',
    httpUrl: 'http://127.0.0.1:3000',
    token: '',
    selfName: '大肥鱼',
    ownerQq: '',
    groups: {},
    defaultGroup: defaultGroupPolicy(),
    llm: {
      baseUrl: 'https://api.deepseek.com/v1',
      apiKey: '',
      apiKeyEnv: 'DEEPSEEK_API_KEY',
      model: 'deepseek-chat',
      temperature: 1,
      maxTokens: 400,
      timeoutMs: 60_000,
    },
    tts: {
      voice: 'zh-CN-XiaoyiNeural',
      rate: '+0%',
      pitch: '+0Hz',
      volume: '+0%',
      provider: 'edge',
      endpoint: 'http://127.0.0.1:50121',
      style: '',
      pythonPath: '',
      cacheDir: '',
      serviceScript: '',
    },
    sing: {
      backend: 'pitch',
      transpose: 0,
      voicebankDir: '',
      rvcModel: '',
      scoreDir: '',
      mix: defaultMix(),
    },
    rvc: {
      enabled: false,
      modelsDir: '',
      pythonPath: 'python',
      scriptPath: '',
      onnxScriptPath: '',
      onnxPythonPath: '',
      modelPath: '',
      indexPath: '',
      device: 'auto',
      pitch: 0,
      indexRate: 0.75,
      protect: 0.33,
      filterRadius: 3,
      rmsMixRate: 0.5,
      f0Method: 'rmvpe',
      timeoutMs: 120_000,
      maxSeconds: 45,
    },
    adminToken: '',
    logLevel: 'info',
  };
}

/** 配置错误的统一形态：说清楚是哪一项、期望什么、实际是什么 */
export class ConfigError extends Error {
  readonly path: string;
  constructor(path: string, expectation: string, actual: unknown) {
    super(`配置项 ${path} 不合法：期望 ${expectation}，实际是 ${describe(actual)}`);
    this.name = 'ConfigError';
    this.path = path;
  }
}

function describe(value: unknown): string {
  if (value === undefined) return 'undefined（缺失）';
  if (value === null) return 'null';
  if (typeof value === 'string') return JSON.stringify(value);
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) return `数组(${value.length})`;
  return typeof value;
}

/** 取数字并夹到区间；类型不对就抛（不静默回落） */
function num(raw: unknown, path: string, fallback: number, min: number, max: number): number {
  if (raw === undefined || raw === null) return fallback;
  if (typeof raw !== 'number' || !Number.isFinite(raw)) throw new ConfigError(path, '有限数字', raw);
  return Math.min(max, Math.max(min, raw));
}

function bool(raw: unknown, path: string, fallback: boolean): boolean {
  if (raw === undefined || raw === null) return fallback;
  if (typeof raw !== 'boolean') throw new ConfigError(path, 'true / false', raw);
  return raw;
}

function str(raw: unknown, path: string, fallback: string): string {
  if (raw === undefined || raw === null) return fallback;
  if (typeof raw !== 'string') throw new ConfigError(path, '字符串', raw);
  return raw;
}

/** 概率表（关键词/成员 → 0~1），缺省用默认表而不是清空 */
function chanceMap(raw: unknown, path: string, fallback: Record<string, number>): Record<string, number> {
  if (raw === undefined || raw === null) return { ...fallback };
  if (typeof raw !== 'object' || Array.isArray(raw)) throw new ConfigError(path, '对象', raw);
  const out: Record<string, number> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      throw new ConfigError(`${path}.${key}`, '0~1 的数字', value);
    }
    out[key] = Math.min(1, Math.max(0, value));
  }
  return out;
}

function enumOf<T extends string>(raw: unknown, path: string, fallback: T, allowed: readonly T[]): T {
  if (raw === undefined || raw === null) return fallback;
  if (typeof raw !== 'string' || !allowed.includes(raw as T)) {
    throw new ConfigError(path, allowed.map((v) => JSON.stringify(v)).join(' / '), raw);
  }
  return raw as T;
}

/** 区间元组 */
function pair(raw: unknown, path: string, fallback: [number, number], min: number, max: number): [number, number] {
  if (raw === undefined || raw === null) return fallback;
  if (!Array.isArray(raw) || raw.length !== 2) throw new ConfigError(path, '[最小, 最大] 两个数字', raw);
  const lo = num(raw[0], `${path}[0]`, fallback[0], min, max);
  const hi = num(raw[1], `${path}[1]`, fallback[1], min, max);
  return lo <= hi ? [lo, hi] : [hi, lo];
}

/** 归一化一个群策略（缺字段用默认值，写错的字段抛错） */
export function normalizeGroupPolicy(raw: unknown, path: string, base = defaultGroupPolicy()): GroupPolicy {
  // 整段缺失 = 全部用默认值（qq.json 里只写想改的几项是常见用法）
  if (raw === undefined || raw === null) return clonePolicy(base);
  if (typeof raw !== 'object' || Array.isArray(raw)) {
    throw new ConfigError(path, '对象', raw);
  }
  const src = raw as Record<string, unknown>;
  const burst = (src.burst ?? {}) as Record<string, unknown>;
  const pro = (src.proactive ?? {}) as Record<string, unknown>;
  if (typeof burst !== 'object' || burst === null || Array.isArray(burst)) {
    throw new ConfigError(`${path}.burst`, '对象', src.burst);
  }
  if (typeof pro !== 'object' || pro === null || Array.isArray(pro)) {
    throw new ConfigError(`${path}.proactive`, '对象', src.proactive);
  }

  const min = Math.round(num(burst.min, `${path}.burst.min`, base.burst.min, 1, 10));
  const max = Math.round(num(burst.max, `${path}.burst.max`, base.burst.max, 1, 10));

  // 看图策略：新格式 imageViewModes 多选；兼容旧的单值 imageView
  const allowedImageModes = new Set(['at', 'context', 'question']);
  const legacyImageView = typeof src.imageView === 'string' ? src.imageView : undefined;
  let imageView: GroupPolicy['imageView'] = base.imageView;
  let imageViewModes: GroupPolicy['imageViewModes'] = [...base.imageViewModes];
  if (Array.isArray(src.imageViewModes)) {
    imageViewModes = [...new Set(
      src.imageViewModes.filter((m): m is 'at' | 'context' | 'question' => typeof m === 'string' && allowedImageModes.has(m)),
    )];
    imageView = legacyImageView === 'off' ? 'off' : legacyImageView === 'all' ? 'all' : 'custom';
  } else if (legacyImageView === 'off') {
    imageView = 'off';
    imageViewModes = [];
  } else if (legacyImageView === 'all') {
    imageView = 'all';
    imageViewModes = [];
  } else if (legacyImageView === 'at' || legacyImageView === 'context' || legacyImageView === 'question') {
    imageView = 'custom';
    imageViewModes = [legacyImageView];
  }

  return {
    enabled: bool(src.enabled, `${path}.enabled`, base.enabled),
    name: str(src.name, `${path}.name`, base.name),
    replyOnAt: bool(src.replyOnAt, `${path}.replyOnAt`, base.replyOnAt),
    replyOnName: bool(src.replyOnName, `${path}.replyOnName`, base.replyOnName),
    activeChat: bool(src.activeChat, `${path}.activeChat`, base.activeChat),
    replyChance: num(src.replyChance, `${path}.replyChance`, base.replyChance, 0, 1),
    scoreThreshold: num(src.scoreThreshold, `${path}.scoreThreshold`, base.scoreThreshold, 0, 100),
    burst: {
      min: Math.min(min, max),
      max: Math.max(min, max),
      gapMs: pair(burst.gapMs, `${path}.burst.gapMs`, base.burst.gapMs, 200, 60_000),
    },
    cooldownMs: num(src.cooldownMs, `${path}.cooldownMs`, base.cooldownMs, 0, 24 * 60 * 60_000),
    maxRepliesPer10Min: num(src.maxRepliesPer10Min, `${path}.maxRepliesPer10Min`, base.maxRepliesPer10Min, 0, 1000),
    maxDirectRepliesPer10Min: num(
      src.maxDirectRepliesPer10Min,
      `${path}.maxDirectRepliesPer10Min`,
      base.maxDirectRepliesPer10Min,
      0,
      1000,
    ),
    contextTurns: Math.round(num(src.contextTurns, `${path}.contextTurns`, base.contextTurns, 1, 100)),
    contextMode: enumOf(src.contextMode, `${path}.contextMode`, base.contextMode, ['full', 'adaptive'] as const),
    adaptiveMinTurns: Math.round(
      num(src.adaptiveMinTurns, `${path}.adaptiveMinTurns`, base.adaptiveMinTurns, 1, 50),
    ),
    moodJudge: src.moodJudge === undefined ? base.moodJudge : src.moodJudge === true,
    quoteWhenSeparated:
      src.quoteWhenSeparated === undefined ? base.quoteWhenSeparated : src.quoteWhenSeparated === true,
    memoryMaxTurns: Math.round(num(src.memoryMaxTurns, `${path}.memoryMaxTurns`, base.memoryMaxTurns, 20, 5000)),
    memoryMaxTokens: Math.round(num(src.memoryMaxTokens, `${path}.memoryMaxTokens`, base.memoryMaxTokens, 500, 200000)),
    summaryMaxChars: Math.round(num(src.summaryMaxChars, `${path}.summaryMaxChars`, base.summaryMaxChars, 200, 20000)),
    compressMode: enumOf<'extractive' | 'llm' | 'hybrid'>(
      src.compressMode,
      `${path}.compressMode`,
      base.compressMode,
      ['extractive', 'llm', 'hybrid'] as const,
    ),
    compressEveryTurns: Math.round(
      num(src.compressEveryTurns, `${path}.compressEveryTurns`, base.compressEveryTurns, 5, 200),
    ),
    keyMemoryMax: Math.round(num(src.keyMemoryMax, `${path}.keyMemoryMax`, base.keyMemoryMax, 0, 500)),
    memoryV3Enabled: src.memoryV3Enabled !== false,
    memoryV3ExtractEveryTurns: Math.round(
      num(src.memoryV3ExtractEveryTurns, `${path}.memoryV3ExtractEveryTurns`, base.memoryV3ExtractEveryTurns, 0, 200),
    ),
    memoryV3MaxItems: Math.round(num(src.memoryV3MaxItems, `${path}.memoryV3MaxItems`, base.memoryV3MaxItems, 1, 20)),
    memoryV3MaxChars: Math.round(num(src.memoryV3MaxChars, `${path}.memoryV3MaxChars`, base.memoryV3MaxChars, 100, 4000)),
    memoryV3Threshold: num(src.memoryV3Threshold, `${path}.memoryV3Threshold`, base.memoryV3Threshold, 0, 1),
    moodEnabled: src.moodEnabled !== false,
    moodBaseline: Math.round(num(src.moodBaseline, `${path}.moodBaseline`, base.moodBaseline, 0, 100)),
    moodFloor: Math.round(num(src.moodFloor, `${path}.moodFloor`, base.moodFloor, 0, 100)),
    moodHalfLifeHours: num(src.moodHalfLifeHours, `${path}.moodHalfLifeHours`, base.moodHalfLifeHours, 1, 168),
    moodConfidence: Math.round(num(src.moodConfidence, `${path}.moodConfidence`, base.moodConfidence, 0, 100)),
    moodDailyInject: Math.round(num(src.moodDailyInject, `${path}.moodDailyInject`, base.moodDailyInject, 0, 50)),
    archiveEnabled: src.archiveEnabled !== false,
    fileReadMode: enumOf<'off' | 'all' | 'custom'>(
      src.fileReadMode,
      `${path}.fileReadMode`,
      base.fileReadMode,
      ['off', 'all', 'custom'] as const,
    ),
    fileReadModes: Array.isArray(src.fileReadModes)
      ? [...new Set(
          src.fileReadModes.filter(
            (m): m is 'at' | 'context' | 'question' => m === 'at' || m === 'context' || m === 'question',
          ),
        )]
      : base.fileReadModes,
    fileMaxMB: Math.round(num(src.fileMaxMB, `${path}.fileMaxMB`, base.fileMaxMB, 1, 100)),
    fileMaxChars: Math.round(num(src.fileMaxChars, `${path}.fileMaxChars`, base.fileMaxChars, 1000, 200000)),
    fileDailyLimit: Math.round(num(src.fileDailyLimit, `${path}.fileDailyLimit`, base.fileDailyLimit, 0, 200)),
    forwardReadMode: enumOf<'off' | 'all' | 'custom'>(
      src.forwardReadMode,
      `${path}.forwardReadMode`,
      base.forwardReadMode,
      ['off', 'all', 'custom'] as const,
    ),
    forwardReadModes: Array.isArray(src.forwardReadModes)
      ? [...new Set(
          src.forwardReadModes.filter(
            (m): m is 'at' | 'context' | 'question' => m === 'at' || m === 'context' || m === 'question',
          ),
        )]
      : base.forwardReadModes,
    forwardMaxNodes: Math.round(
      num(src.forwardMaxNodes, `${path}.forwardMaxNodes`, base.forwardMaxNodes, 1, 200),
    ),
    forwardMaxChars: Math.round(
      num(src.forwardMaxChars, `${path}.forwardMaxChars`, base.forwardMaxChars, 500, 50000),
    ),
    proactive: {
      enabled: bool(pro.enabled, `${path}.proactive.enabled`, base.proactive.enabled),
      minIdleMs: num(pro.minIdleMs, `${path}.proactive.minIdleMs`, base.proactive.minIdleMs, 0, 7 * 24 * 3600_000),
      firstDelayMs: num(pro.firstDelayMs, `${path}.proactive.firstDelayMs`, base.proactive.firstDelayMs, 0, 7 * 24 * 3600_000),
      growth: num(pro.growth, `${path}.proactive.growth`, base.proactive.growth, 1, 10),
      maxDelayMs: num(pro.maxDelayMs, `${path}.proactive.maxDelayMs`, base.proactive.maxDelayMs, 0, 30 * 24 * 3600_000),
      resetOnHuman: bool(pro.resetOnHuman, `${path}.proactive.resetOnHuman`, base.proactive.resetOnHuman),
      maxPerDay: num(pro.maxPerDay, `${path}.proactive.maxPerDay`, base.proactive.maxPerDay, 0, 1000),
      mode: pro.mode === 'legacy' ? 'legacy' : 'dice',
      intervalMs: num(pro.intervalMs, `${path}.proactive.intervalMs`, base.proactive.intervalMs, 60_000, 24 * 3600_000),
      peakLine: num(pro.peakLine, `${path}.proactive.peakLine`, base.proactive.peakLine, 0, 100),
      offPeakLine: num(pro.offPeakLine, `${path}.proactive.offPeakLine`, base.proactive.offPeakLine, 0, 100),
      quietStart: Math.round(num(pro.quietStart, `${path}.proactive.quietStart`, base.proactive.quietStart, 0, 23)),
      quietEnd: Math.round(num(pro.quietEnd, `${path}.proactive.quietEnd`, base.proactive.quietEnd, 0, 23)),
      nearMinutes: num(pro.nearMinutes, `${path}.proactive.nearMinutes`, base.proactive.nearMinutes, 0, 100000),
      nearFactor: num(pro.nearFactor, `${path}.proactive.nearFactor`, base.proactive.nearFactor, 0, 100),
      farMinutes: num(pro.farMinutes, `${path}.proactive.farMinutes`, base.proactive.farMinutes, 0, 100000),
      farFactor: num(pro.farFactor, `${path}.proactive.farFactor`, base.proactive.farFactor, 0, 100),
      missBonus: num(pro.missBonus, `${path}.proactive.missBonus`, base.proactive.missBonus, 0, 100),
      missBonusMax: num(pro.missBonusMax, `${path}.proactive.missBonusMax`, base.proactive.missBonusMax, 0, 100),
      cooldownMs: num(pro.cooldownMs, `${path}.proactive.cooldownMs`, base.proactive.cooldownMs, 0, 24 * 3600_000),
      trial: pro.trial !== false,
    },
    voiceChance: num(src.voiceChance, `${path}.voiceChance`, base.voiceChance, 0, 1),
    requestedVoiceChance: num(src.requestedVoiceChance, `${path}.requestedVoiceChance`, base.requestedVoiceChance, 0, 1),
    voiceMaxChars: num(src.voiceMaxChars, `${path}.voiceMaxChars`, base.voiceMaxChars, 0, 500),
    proactiveVoiceChance: num(
      src.proactiveVoiceChance,
      `${path}.proactiveVoiceChance`,
      base.proactiveVoiceChance,
      0,
      1,
    ),
    singChance: num(src.singChance, `${path}.singChance`, base.singChance, 0, 1),
    requestedSingChance: num(src.requestedSingChance, `${path}.requestedSingChance`, base.requestedSingChance, 0, 1),
    singOnRequest: bool(src.singOnRequest, `${path}.singOnRequest`, base.singOnRequest),
    imageEnabled: bool(src.imageEnabled, `${path}.imageEnabled`, base.imageEnabled),
    imageChance: num(src.imageChance, `${path}.imageChance`, base.imageChance, 0, 1),
    stickerModelChoice:
      src.stickerModelChoice === undefined ? base.stickerModelChoice : src.stickerModelChoice === true,
    stickerAutoChance:
      src.stickerAutoChance === undefined ? base.stickerAutoChance : src.stickerAutoChance === true,
    selfieOnRequest: src.selfieOnRequest === undefined ? base.selfieOnRequest : src.selfieOnRequest === true,
    selfieAutoChance: src.selfieAutoChance === undefined ? base.selfieAutoChance : src.selfieAutoChance === true,
    requestedImageChance: num(
      src.requestedImageChance,
      `${path}.requestedImageChance`,
      base.requestedImageChance,
      0,
      1,
    ),
    selfieEnabled: src.selfieEnabled !== false,
    selfieChance: num(src.selfieChance, `${path}.selfieChance`, base.selfieChance, 0, 1),
    selfieKeywords: Array.isArray(src.selfieKeywords)
      ? src.selfieKeywords.filter((word): word is string => typeof word === 'string' && word.trim() !== '').map((word) => word.trim()).slice(0, 30)
      : base.selfieKeywords,
    imageView,
    imageViewModes,
    keywordChances: chanceMap(src.keywordChances, `${path}.keywordChances`, base.keywordChances),
    memberChances: chanceMap(src.memberChances, `${path}.memberChances`, base.memberChances),
    engagedChance: num(src.engagedChance, `${path}.engagedChance`, base.engagedChance, 0, 1),
    engageMinutes: num(src.engageMinutes, `${path}.engageMinutes`, base.engageMinutes, 1, 180),
    llmGate: bool(src.llmGate, `${path}.llmGate`, base.llmGate),
  };
}

/** 归一化混音参数 */
export function normalizeMix(raw: unknown, path = 'sing.mix', base = defaultMix()): MixConfig {
  const src = (raw ?? {}) as Record<string, unknown>;
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    if (raw === undefined || raw === null) return { ...base };
    throw new ConfigError(path, '对象', raw);
  }
  return {
    gainDb: num(src.gainDb, `${path}.gainDb`, base.gainDb, -60, 24),
    highpassHz: num(src.highpassHz, `${path}.highpassHz`, base.highpassHz, 0, 2000),
    presenceDb: num(src.presenceDb, `${path}.presenceDb`, base.presenceDb, -12, 12),
    airDb: num(src.airDb, `${path}.airDb`, base.airDb, -12, 12),
    compressThresholdDb: num(src.compressThresholdDb, `${path}.compressThresholdDb`, base.compressThresholdDb, -60, 0),
    compressRatio: num(src.compressRatio, `${path}.compressRatio`, base.compressRatio, 1, 20),
    reverbWet: num(src.reverbWet, `${path}.reverbWet`, base.reverbWet, 0, 1),
    reverbDecay: num(src.reverbDecay, `${path}.reverbDecay`, base.reverbDecay, 0.1, 10),
    reverbPreDelayMs: num(src.reverbPreDelayMs, `${path}.reverbPreDelayMs`, base.reverbPreDelayMs, 0, 200),
    stereoWidth: num(src.stereoWidth, `${path}.stereoWidth`, base.stereoWidth, 0, 2),
    harmonyLayers: Math.round(num(src.harmonyLayers, `${path}.harmonyLayers`, base.harmonyLayers, 0, 4)),
    harmonySemitones: num(src.harmonySemitones, `${path}.harmonySemitones`, base.harmonySemitones, -24, 24),
    harmonyGain: num(src.harmonyGain, `${path}.harmonyGain`, base.harmonyGain, 0, 1),
    limiterCeilingDb: num(src.limiterCeilingDb, `${path}.limiterCeilingDb`, base.limiterCeilingDb, -12, 0),
  };
}

/**
 * 归一化整份配置。
 * @param raw 解析后的 JSON 对象（可能缺字段）
 * @returns 填满默认值、全部夹到合法区间的配置
 * @throws ConfigError 任一字段类型/取值不合法（带路径，直接能定位）
 */
export function normalizeConfig(raw: unknown): QqConfig {
  if (raw === null || raw === undefined) return defaultConfig();
  if (typeof raw !== 'object' || Array.isArray(raw)) throw new ConfigError('(根)', 'JSON 对象', raw);
  const src = raw as Record<string, unknown>;
  const base = defaultConfig();

  const groupsRaw = src.groups;
  const groups: Record<string, GroupPolicy> = {};
  if (groupsRaw !== undefined && groupsRaw !== null) {
    if (typeof groupsRaw !== 'object' || Array.isArray(groupsRaw)) {
      throw new ConfigError('groups', '对象（key = 群号）', groupsRaw);
    }
    for (const [gid, value] of Object.entries(groupsRaw as Record<string, unknown>)) {
      if (!/^\d{5,12}$/.test(gid)) throw new ConfigError(`groups.${gid}`, '5~12 位数字群号', gid);
      groups[gid] = normalizeGroupPolicy(value, `groups.${gid}`);
    }
  }

  const llmSrc = (src.llm ?? {}) as Record<string, unknown>;
  const ttsSrc = (src.tts ?? {}) as Record<string, unknown>;
  const singSrc = (src.sing ?? {}) as Record<string, unknown>;
  const rvcSrc = (src.rvc ?? {}) as Record<string, unknown>;

  return {
    enabled: bool(src.enabled, 'enabled', base.enabled),
    mode: enumOf(src.mode, 'mode', base.mode, ['ws', 'http'] as const),
    url: str(src.url, 'url', base.url),
    httpUrl: str(src.httpUrl, 'httpUrl', base.httpUrl),
    token: str(src.token, 'token', base.token),
    selfName: str(src.selfName, 'selfName', base.selfName),
    ownerQq: str(src.ownerQq, 'ownerQq', base.ownerQq),
    groups,
    defaultGroup: normalizeGroupPolicy(src.defaultGroup, 'defaultGroup', base.defaultGroup),
    llm: {
      baseUrl: str(llmSrc.baseUrl, 'llm.baseUrl', base.llm.baseUrl),
      apiKey: str(llmSrc.apiKey, 'llm.apiKey', base.llm.apiKey),
      apiKeyEnv: str(llmSrc.apiKeyEnv, 'llm.apiKeyEnv', base.llm.apiKeyEnv),
      model: str(llmSrc.model, 'llm.model', base.llm.model),
      temperature: num(llmSrc.temperature, 'llm.temperature', base.llm.temperature, 0, 2),
      maxTokens: Math.round(num(llmSrc.maxTokens, 'llm.maxTokens', base.llm.maxTokens, 16, 8192)),
      timeoutMs: num(llmSrc.timeoutMs, 'llm.timeoutMs', base.llm.timeoutMs, 1000, 300_000),
    },
    tts: {
      voice: str(ttsSrc.voice, 'tts.voice', base.tts.voice),
      rate: str(ttsSrc.rate, 'tts.rate', base.tts.rate),
      pitch: str(ttsSrc.pitch, 'tts.pitch', base.tts.pitch),
      volume: str(ttsSrc.volume, 'tts.volume', base.tts.volume),
      provider: enumOf(ttsSrc.provider, 'tts.provider', base.tts.provider, ['edge', 'cosyvoice', 'kokoro', 'gpt-sovits', 'indextts'] as const),
      endpoint: str(ttsSrc.endpoint, 'tts.endpoint', base.tts.endpoint),
      style: str(ttsSrc.style, 'tts.style', base.tts.style),
      pythonPath: str(ttsSrc.pythonPath, 'tts.pythonPath', base.tts.pythonPath),
      cacheDir: str(ttsSrc.cacheDir, 'tts.cacheDir', base.tts.cacheDir),
    serviceScript: str(ttsSrc.serviceScript, 'tts.serviceScript', base.tts.serviceScript),
    },
    sing: {
      backend: enumOf(singSrc.backend, 'sing.backend', base.sing.backend, ['pitch', 'diffsinger', 'rvc'] as const),
      transpose: num(singSrc.transpose, 'sing.transpose', base.sing.transpose, -24, 24),
      voicebankDir: str(singSrc.voicebankDir, 'sing.voicebankDir', base.sing.voicebankDir),
      rvcModel: str(singSrc.rvcModel, 'sing.rvcModel', base.sing.rvcModel),
      scoreDir: str(singSrc.scoreDir, 'sing.scoreDir', base.sing.scoreDir),
      mix: normalizeMix(singSrc.mix),
    },
    rvc: {
      enabled: rvcSrc.enabled === true,
      modelsDir: str(rvcSrc.modelsDir, 'rvc.modelsDir', base.rvc.modelsDir),
      pythonPath: str(rvcSrc.pythonPath, 'rvc.pythonPath', base.rvc.pythonPath),
      scriptPath: str(rvcSrc.scriptPath, 'rvc.scriptPath', base.rvc.scriptPath),
      onnxScriptPath: str(rvcSrc.onnxScriptPath, 'rvc.onnxScriptPath', base.rvc.onnxScriptPath),
      onnxPythonPath: str(rvcSrc.onnxPythonPath, 'rvc.onnxPythonPath', base.rvc.onnxPythonPath),
      modelPath: str(rvcSrc.modelPath, 'rvc.modelPath', base.rvc.modelPath),
      indexPath: str(rvcSrc.indexPath, 'rvc.indexPath', base.rvc.indexPath),
      device: enumOf(rvcSrc.device, 'rvc.device', base.rvc.device, ['auto', 'cpu', 'dml', 'cuda'] as const),
      pitch: num(rvcSrc.pitch, 'rvc.pitch', base.rvc.pitch, -24, 24),
      indexRate: num(rvcSrc.indexRate, 'rvc.indexRate', base.rvc.indexRate, 0, 1),
      protect: num(rvcSrc.protect, 'rvc.protect', base.rvc.protect, 0, 0.5),
      filterRadius: num(rvcSrc.filterRadius, 'rvc.filterRadius', base.rvc.filterRadius, 0, 7),
      rmsMixRate: num(rvcSrc.rmsMixRate, 'rvc.rmsMixRate', base.rvc.rmsMixRate, 0, 1),
      f0Method: enumOf(rvcSrc.f0Method, 'rvc.f0Method', base.rvc.f0Method, ['rmvpe', 'pm'] as const),
      timeoutMs: num(rvcSrc.timeoutMs, 'rvc.timeoutMs', base.rvc.timeoutMs, 5_000, 600_000),
      maxSeconds: num(rvcSrc.maxSeconds, 'rvc.maxSeconds', base.rvc.maxSeconds, 1, 300),
    },
    adminToken: str(src.adminToken, 'adminToken', base.adminToken),
    logLevel: enumOf(src.logLevel, 'logLevel', base.logLevel, ['debug', 'info', 'warn', 'error'] as const),
  };
}

/** 深拷贝一份策略（默认值被共享时，改一个群会牵连别的群——这是必须防的） */
export function clonePolicy(policy: GroupPolicy): GroupPolicy {
  return {
    ...policy,
    burst: { ...policy.burst, gapMs: [...policy.burst.gapMs] as [number, number] },
    proactive: { ...policy.proactive },
  };
}

/** 某个群的最终策略：显式配置优先，否则用 defaultGroup（但 defaultGroup 默认是关的） */
export function policyFor(config: QqConfig, groupId: string): GroupPolicy {
  return config.groups[groupId] ?? config.defaultGroup;
}
