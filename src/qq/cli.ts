/**
 * 云端独立进程：`node lib/qq.js` —— 只跑 QQ 群接入，不启动 DSH、不渲染桌宠。
 *
 * ── 这就是「云端部署」的入口 ──
 * 云上那台机器只需要三样东西：Node ≥ 22.4、Python 3 + edge-tts、ffmpeg。
 * 它连 NapCat 的 OneBot 端口，其余全是本进程自己的事。
 *
 * ── 为什么单独一个入口，而不是复用 standalone.js ──
 * `standalone.js` 起的是**整个插件的宿主半边**（含桌面 Helper、识屏、键鼠注入），
 * 那些东西在 Linux 云主机上要么跑不了、要么不该跑。这个入口只装 QQ 群需要的那部分，
 * 进程更小、启动更快、依赖更少。
 *
 * ── 用法 ──
 * ```bash
 * node lib/qq.js --config /etc/whale/qq.json
 * node lib/qq.js --check            # 只体检：配置、连接、TTS、ffmpeg 全查一遍
 * node lib/qq.js --sing 小星星 --out /tmp/a.wav   # 离线生成一首（验证音质用）
 * node lib/qq.js --score            # 打印一份乐谱模板
 * ```
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';

import { ConfigError, defaultConfig, normalizeConfig, type QqConfig } from '../qq/config';
import { QqBridge } from '../qq/bridge';
import { completionsUrl, createOpenAiClient } from '../qq/llm';
import { OneBotClient } from '../qq/onebot';
import { resolveBackend } from '../sound/sing';
import { BUILTIN_SCORES, findBuiltinScore } from '../sound/score';
import { Speaker, describeFailure } from '../sound/tts';

/** 命令行参数 */
interface Args {
  config?: string;
  userRoot?: string;
  check: boolean;
  sing?: string;
  out?: string;
  score: boolean;
  transpose?: number;
  help: boolean;
}

/** 解析命令行（只认长选项，够用且不会歧义） */
export function parseArgs(argv: string[]): Args {
  const args: Args = { check: false, score: false, help: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === undefined) continue;
    const next = (): string | undefined => {
      const value = argv[i + 1];
      if (value !== undefined && !value.startsWith('--')) {
        i += 1;
        return value;
      }
      return undefined;
    };
    switch (arg) {
      case '--config':
        args.config = next();
        break;
      case '--user-root':
        args.userRoot = next();
        break;
      case '--check':
        args.check = true;
        break;
      case '--sing':
        args.sing = next() ?? '';
        break;
      case '--out':
        args.out = next();
        break;
      case '--score':
        args.score = true;
        break;
      case '--transpose':
        args.transpose = Number(next() ?? '0');
        break;
      case '--help':
      case '-h':
        args.help = true;
        break;
      default:
        break;
    }
  }
  return args;
}

/** 用户目录的默认位置：优先 DSH_HOME，其次 ~/.dsh（与宿主一致） */
export function defaultUserRoot(): string {
  const dshHome = process.env.DSH_HOME;
  const base = dshHome !== undefined && dshHome !== '' ? dshHome : join(homedir(), '.dsh');
  return join(base, 'dsh-whale-girl');
}

/** 读配置：文件不存在时用默认值并**写一份带注释的模板**（让主人有地方改） */
export function loadConfig(path: string): { config: QqConfig; created: boolean } {
  if (!existsSync(path)) {
    const template = defaultConfig();
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, `${JSON.stringify(template, null, 2)}\n`, 'utf8');
    return { config: template, created: true };
  }
  const raw = readFileSync(path, 'utf8').replace(/^\uFEFF/, '');
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    throw new ConfigError('(文件)', `合法 JSON（解析失败：${e instanceof Error ? e.message : String(e)}）`, path);
  }
  return { config: normalizeConfig(parsed), created: false };
}

/** 日志器：带时间戳，云上用 journalctl 收集 */
function createLogger(level: QqConfig['logLevel']): (l: 'debug' | 'info' | 'warn' | 'error', message: string) => void {
  const order = { debug: 10, info: 20, warn: 30, error: 40 };
  return (l, message) => {
    if (order[l] < order[level]) return;
    const stamp = new Date().toISOString().replace('T', ' ').slice(0, 19);
    const line = `[${stamp}] ${l.toUpperCase().padEnd(5)} ${message}`;
    if (l === 'error' || l === 'warn') console.error(line);
    else console.log(line);
  };
}

/** 读人设：persona.json → main-config.jsonc 的 whisperPrompt → 兜底 */
export function readPersona(userRoot: string): string {
  try {
    const raw = JSON.parse(readFileSync(join(userRoot, 'persona.json'), 'utf8').replace(/^\uFEFF/, '')) as { main?: unknown };
    if (typeof raw.main === 'string' && raw.main.trim() !== '') return raw.main.trim();
  } catch {
    // 没有 persona.json 是正常的
  }
  return '你是一只住在云端的鲸鱼娘，名字叫「大肥鱼」，说话口语、有点小脾气、喜欢跟人聊天。';
}

/** 时间背景（不依赖宿主；宿主侧另有一份更详细的 time-context） */
export function timeContext(now = new Date()): string {
  const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
  const pad = (n: number): string => String(n).padStart(2, '0');
  return `现在是 ${now.getFullYear()} 年 ${now.getMonth() + 1} 月 ${now.getDate()} 日 ${weekdays[now.getDay()]} ${pad(now.getHours())}:${pad(now.getMinutes())}。`;
}

/** 体检：配置、连接、TTS、ffmpeg、模型 —— 每条都给结论，不静默 */
export async function runCheck(config: QqConfig, userRoot: string): Promise<boolean> {
  const log = createLogger('debug');
  let ok = true;
  const report = (name: string, passed: boolean, detail: string): void => {
    if (!passed) ok = false;
    console.log(`${passed ? '✅' : '❌'} ${name.padEnd(20)} ${detail}`);
  };

  report('Node 版本', Number(process.versions.node.split('.')[0]) >= 22, process.versions.node);
  report('内置 WebSocket', typeof (globalThis as { WebSocket?: unknown }).WebSocket === 'function', '用于连 NapCat');

  try {
    const url = completionsUrl(config.llm.baseUrl);
    report('模型接口', true, url);
  } catch (e) {
    report('模型接口', false, e instanceof Error ? e.message : String(e));
  }
  const key = config.llm.apiKey !== '' ? config.llm.apiKey : (process.env[config.llm.apiKeyEnv] ?? '');
  report('模型密钥', key.trim() !== '', key === '' ? `缺少（qq.json 的 llm.apiKey 或环境变量 ${config.llm.apiKeyEnv}）` : `已配置（${key.length} 字符）`);

  // 模型连通性：真发一次短请求
  if (key.trim() !== '') {
    const client = createOpenAiClient({ ...config.llm, apiKey: key });
    const result = await client.chat([{ role: 'user', content: '只回复两个字：在的' }], { maxTokens: 16, timeoutMs: 20_000 });
    report('模型可用', result.ok, result.ok ? `回复：${result.text.slice(0, 20)}` : result.message.slice(0, 120));
  }

  // TTS
  const speaker = new Speaker({ userRoot, cache: { dir: join(userRoot, 'cache', 'tts') } });
  const spoken = await speaker.speak('测试一下语音');
  report('TTS 合成', spoken.ok, spoken.ok ? `时长 ${(spoken.pcm.channels[0]?.length ?? 0) / spoken.pcm.sampleRate}s` : describeFailure(spoken));

  // 连 NapCat
  const client = new OneBotClient({
    url: config.url,
    httpUrl: config.httpUrl,
    token: config.token,
    log: (l, m) => {
      if (l === 'error') log(l, m);
    },
  });
  await new Promise<void>((done) => {
    const timer = setTimeout(done, 8000);
    client.on('state', (state: { status: string; selfId?: string }) => {
      if (state.status === 'online' || state.status === 'failed') {
        clearTimeout(timer);
        done();
      }
    });
    client.connect();
  });
  const link = client.linkState;
  report(
    'NapCat 连接',
    link.status === 'online',
    link.status === 'online' ? `已登录 ${link.selfId || '(未知)'}` : `状态 ${link.status}${'reason' in link ? `：${String(link.reason)}` : ''}`,
  );
  await client.close();

  // 群配置
  const groupIds = Object.keys(config.groups);
  report('已启用的群', groupIds.length > 0, groupIds.length === 0 ? '没有配置任何群（qq.json 的 groups）' : groupIds.join('、'));

  // 唱歌后端
  const { backend, warning } = resolveBackend(config.sing.backend);
  report('唱歌后端', warning === undefined, warning ?? `${backend.name}：${backend.description}`);

  console.log(ok ? '\n全部通过。' : '\n有检查项失败，按上面的 ❌ 逐条修。');
  return ok;
}

/** 离线渲染一首歌到文件（验证音质 / 云上试听用） */
export async function renderSongToFile(
  config: QqConfig,
  userRoot: string,
  song: string,
  outPath: string,
  transposeOverride?: number,
): Promise<boolean> {
  const score = findBuiltinScore(song);
  if (score === undefined) {
    console.error(`没有这首歌：${song}。内置的有：${Object.values(BUILTIN_SCORES).map((s) => s.title).join('、')}`);
    return false;
  }
  const { backend, warning } = resolveBackend(config.sing.backend);
  if (warning !== undefined) console.warn(warning);

  const speaker = new Speaker({ userRoot, cache: { dir: join(userRoot, 'cache', 'tts') } });
  const started = Date.now();
  const rendered = await backend.render(
    score,
    {
      label: 'edge-tts',
      speak: async (text: string) => {
        const result = await speaker.speak(text, { voice: config.tts.voice, rate: config.tts.rate });
        if (!result.ok) return { ok: false as const, reason: result.reason, message: describeFailure(result) };
        return { ok: true as const, audio: result.pcm };
      },
    },
    {
      transpose: transposeOverride ?? config.sing.transpose,
      mix: config.sing.mix,
      onProgress: (done, total) => process.stdout.write(`\r渲染 ${done}/${total}`),
    },
  );
  if (!rendered.ok) {
    console.error(`\n渲染失败（${rendered.reason}）：${rendered.message}`);
    return false;
  }
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, rendered.wav);
  console.log(
    `\n完成：${outPath}（${rendered.report.duration.toFixed(1)} 秒，${rendered.report.notes} 个音，` +
      `耗时 ${((Date.now() - started) / 1000).toFixed(1)} 秒）`,
  );
  return true;
}

/** 打印一份乐谱模板（主人可以直接改） */
export function printScoreTemplate(): void {
  console.log(
    JSON.stringify(
      {
        title: '我的一天',
        bpm: 96,
        beatsPerBar: 4,
        key: 'C',
        notes: [
          { note: 'C4', start: 0, dur: 1, lyric: '早' },
          { note: 'D4', start: 1, dur: 1, lyric: '上' },
          { note: 'E4', start: 2, dur: 2, lyric: '好' },
          { midi: 65, start: 4, dur: 1 },
          { midi: 67, start: 5, dur: 1 },
          { midi: 69, start: 6, dur: 2, lyric: '呀' },
        ],
      },
      null,
      2,
    ),
  );
  console.log('\n提示：note 可以写音名（C4/A#3），也可以写 midi 数字（60 = C4）；');
  console.log('     lyric 省略就是哼唱一个元音（最稳）；start/dur 的单位是「拍」。');
}

/** 主流程 */
export async function main(argv: string[]): Promise<number> {
  const args = parseArgs(argv);
  if (args.help) {
    console.log(
      [
        'dsh-whale-girl QQ 群接入（云端进程）',
        '',
        '  node lib/qq.js                     用默认配置启动',
        '  node lib/qq.js --config <path>     指定配置文件',
        '  node lib/qq.js --check             体检（配置/模型/TTS/NapCat/后端）',
        '  node lib/qq.js --sing 小星星 --out a.wav   离线渲一首歌',
        '  node lib/qq.js --score             打印乐谱模板',
        '',
        '配置文件默认：$DSH_HOME/dsh-whale-girl/qq.json（不存在会自动生成一份）',
      ].join('\n'),
    );
    return 0;
  }

  const userRoot = args.userRoot !== undefined ? resolve(args.userRoot) : defaultUserRoot();
  const configPath = args.config !== undefined ? resolve(args.config) : join(userRoot, 'qq.json');
  mkdirSync(userRoot, { recursive: true });

  let config: QqConfig;
  try {
    const loaded = loadConfig(configPath);
    config = loaded.config;
    if (loaded.created) console.log(`已生成默认配置：${configPath}（改完再启动）`);
  } catch (e) {
    console.error(`配置读取失败：${e instanceof Error ? e.message : String(e)}`);
    return 2;
  }

  if (args.score) {
    printScoreTemplate();
    return 0;
  }

  const log = createLogger(config.logLevel);

  /**
   * 一次性命令的收尾：把常驻的 TTS worker 杀掉。
   *
   * 不这么做的话，那条 Python 子进程的 stdin/stdout 管道是活跃句柄，
   * Node 的事件循环永远不空——`--sing` 渲染完文件后进程会一直挂着（实测踩到）。
   * 长驻模式不需要这步：它本来就要一直活着，退出时由 SIGTERM 走 bridge.stop()。
   */
  const disposeWorkers = async (): Promise<void> => {
    const { disposeVoiceWorkers } = await import('../host/voice');
    disposeVoiceWorkers();
  };

  if (args.check) {
    const passed = await runCheck(config, userRoot);
    await disposeWorkers();
    return passed ? 0 : 1;
  }

  if (args.sing !== undefined) {
    const out = args.out ?? join(userRoot, 'out', `${args.sing || 'song'}.wav`);
    const ok = await renderSongToFile(config, userRoot, args.sing, out, args.transpose);
    await disposeWorkers();
    return ok ? 0 : 1;
  }

  if (!config.enabled) {
    console.error(`QQ 群接入未启用（${configPath} 里 enabled = false）。改完再启动，或先跑 --check 体检。`);
    return 2;
  }

  // 模型密钥允许走环境变量（云上不要把密钥写进文件）
  const envKey = process.env[config.llm.apiKeyEnv];
  if (config.llm.apiKey === '' && envKey !== undefined && envKey !== '') {
    config = { ...config, llm: { ...config.llm, apiKey: envKey } };
  }
  if (config.llm.apiKey === '') {
    console.warn(`警告：没有模型密钥（qq.json 的 llm.apiKey 或环境变量 ${config.llm.apiKeyEnv}），生成会失败`);
  }

  const bridge = new QqBridge({
    config,
    userRoot,
    persona: () => readPersona(userRoot),
    log,
    timeContext: () => timeContext(),
    onError: (message) => log('error', message),
    onState: () => {
      /* CLI 不推送状态；需要时可接 HTTP/日志 */
    },
  });

  const started = await bridge.start();
  if (!started.ok) {
    console.error(`启动失败（${started.reason}）：${started.message}`);
    return 3;
  }

  log('info', `已启动。用户目录 ${userRoot}`);

  // 优雅退出：容器里 docker stop 会发 SIGTERM
  const shutdown = async (signal: string): Promise<void> => {
    log('info', `收到 ${signal}，正在停止…`);
    await bridge.stop();
    process.exit(0);
  };
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));

  // 永不返回：由信号收尾
  await new Promise<void>(() => {
    /* 长驻 */
  });
  return 0;
}

// 直接执行时（不是被 import）跑主流程
const isMain = process.argv[1] !== undefined && /qq\.(js|ts|mjs)$/.test(process.argv[1]);
if (isMain) {
  void main(process.argv.slice(2)).then((code) => {
    if (code !== 0) process.exitCode = code;
    /**
     * 一次性命令（--sing / --check / --score / --help）跑完必须主动退出。
     *
     * 实测踩到：`--sing` 把歌渲染完、文件也写好了，进程却**一直不退出**。
     * 原因是 TTS 的常驻 Python worker 还开着 stdin/stdout 管道——那些是活跃的
     * 句柄，Node 的事件循环不会自己空转结束。表现就是命令行"卡住不动"，
     * 用户以为没渲染完，实际文件早就在了（这个误判比崩溃更浪费时间）。
     *
     * 长驻模式（不带这些参数）不走这里：它靠 SIGTERM 收尾，见 main() 里的 shutdown。
     */
    const oneShot = ['--sing', '--check', '--score', '--help', '-h'];
    if (process.argv.slice(2).some((arg) => oneShot.includes(arg))) {
      // 先给 stdout 一个 flush 的机会（管道写入是异步的），再退出
      setImmediate(() => process.exit(process.exitCode ?? 0));
    }
  });
}
