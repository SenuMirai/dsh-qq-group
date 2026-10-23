# dsh-qq-group

独立的 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) QQ 群聊插件：有人设、有记忆、会判断该不该接话，支持主动/被动搭话、语音、唱歌、表情包、日记和视觉看图。

A standalone QQ group-chat plugin for [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness): persona, memory, value-based reply decisions, proactive/passive chat, voice, singing, stickers, diary and optional vision.

> 本项目从 [dsh-whale-girl](https://github.com/SenuMirai/dsh-whale-girl) 的 QQ 模块拆分而来，数据、模型、人设与桌宠完全独立。
> This project was split out of the QQ module in [dsh-whale-girl](https://github.com/SenuMirai/dsh-whale-girl); its data, model, persona and lifecycle are fully independent from the desktop pet.

---

## 中文

### 功能与特点

| 能力 | 说明 |
|---|---|
| **OneBot 11 / NapCat** | 通过 WebSocket 连接 NapCatQQ，支持自动重连、启动检查、自动拉起 |
| **人设与模型** | 使用 DSH 当前模型；可单独为群聊选择 provider/model、推理档位与备用模型 |
| **价值评分 v3** | 不是每条都回：@/叫名字/引用直接回；普通闲聊按关键词、成员、上下文、熟识度、好感度、夜间等算 0~100 分 |
| **冷场逻辑** | 任何人类消息都会重置接话去抖和主动开口倒计时；群里一直有人说话时她不插话 |
| **直接对话队列** | 她正在生成时收到的 @/引用会排队，不会丢；主动开口会给 @ 让位 |
| **群友画像** | 每群每人独立熟识度 0~100、好感度 -100~+100，按发言、被点名、被回复、连续性、敌意判定更新 |
| **日记** | 每条回复记录上下文、评分理由、内心吐槽；支持筛选、导出、删除单条/按人删除 |
| **表情包** | 自动收藏群友图片，AI 重命名/打标签，按语境挑选发送；可设数量与磁盘上限 |
| **语音 / 唱歌** | edge-tts 语音（无需显卡），语气预设、试听、按群概率；离线唱歌与内置曲库 |
| **视觉看图** | 可选把 QQ 图片真正交给视觉模型：@ / 强相关上下文 / 文字问看法可多选，控制 token |
| **夜间免打扰** | 支持跨午夜；命中扣分可调（0~100，默认 20） |
| **用量统计** | 按 DSH usage 记录 token，按模型单价折算积分；支持月历、余额估算、换模型保留历史 |
| **稳定性** | 事件/定时器/异步回复全部兜异常；模型只回 reasoning 时自动提取/重试/备用模型 |

### 部署要求

- **DeepSeek Harness** 桌面版或可加载插件的主机
- **Node.js 22.12+**、**pnpm 9+**
- **NapCatQQ** + **QQ NT**（Windows 推荐；Linux 可用 NapCat Docker，需自行确认 QQ 登录）
- 一个 QQ 小号作为机器人，已加入目标群
- 可选：视觉模型（识图）、edge-tts（语音，联网）、ffmpeg（部分音频转换）

### 部署步骤

#### 1. 安装并登录 NapCat

1. 安装 QQ NT 与 NapCatQQ；
2. 用机器人 QQ 登录；
3. 在 NapCat 中启用 **OneBot 11**，添加 **WebSocket 服务器**：
   - 地址：`ws://127.0.0.1:3001`（默认）
   - access token：自己生成一个强随机串
4. 确认 NapCat 控制台显示 OneBot WebSocket 已启动。

#### 2. 安装本插件

```bash
git clone https://github.com/SenuMirai/dsh-qq-group.git
cd dsh-qq-group
pnpm install
pnpm run build
```

把目录 link 进 DSH profile（或使用 `dsh plugin --profile desktop add <绝对路径>`）：

```jsonc
// <DSH_HOME>/profiles/desktop/package.json
{
  "dependencies": {
    "dsh-qq-group": "link:/absolute/path/to/dsh-qq-group"
  },
  "dsh": {
    "profile": {
      "bundles": [
        // ... 其它插件
        "dsh-qq-group"
      ]
    }
  }
}
```

**重启 DSH**。设置页出现「QQ 群聊」即加载成功。

#### 3. 配置连接

DSH 设置 →「QQ 群聊」→「连接」：

| 项 | 示例 | 说明 |
|---|---|---|
| WebSocket 地址 | `ws://127.0.0.1:3001` | NapCat 的 OneBot WS |
| Access Token | `<YOUR_TOKEN>` | 与 NapCat 一致，不要提交到仓库 |
| 机器人自称 | `小鲸鱼` | 群里被叫到的名字，可逗号分隔多个 |
| 主人 QQ | `<YOUR_QQ>` | 用于好感初始值与主人识别，可留空 |
| 自动连接 | 开 | DSH 启动后自动连 |
| 自动拉起 NapCat | 按需 | 需要填写启动脚本绝对路径 |

#### 4. 启动

设置页点「启动」，或在群里 @ 机器人测试。首次建议先点「体检」与「模型检查」。

### 配置参数推荐

以下是**起步值**，按群氛围调整：

| 参数 | 推荐 | 说明 |
|---|---|---|
| 搭话模式 | 主动 | 被动只回 @/叫名字；主动才会插话和冷场开口 |
| 评分阈值 | 55~65 | 越高越挑；太低会频繁接话 |
| 接话概率 | 0.15~0.35 | 分数达标后的二次掷骰 |
| 冷却 | 20~45 秒 | 两句之间的最小间隔；直接对话会跳过 |
| 普通 10 分钟上限 | 6~10 | 防刷屏；按群活跃度调 |
| 直接回复上限 | 20~40 | @/引用/接着聊单独计数 |
| 去抖 | 6 秒 | 等一波人说完；任何新消息都会重置 |
| 夜间免打扰 | 23:00–08:00，扣 20 | 想更安静就调大，0 = 不扣 |
| 看图策略 | 自定义：@ + 问看法 | 最省 token；需要“所有图”再选 all |
| 语音概率 | 0.1~0.3 | 太高会刷屏，且增加 TTS 延迟 |
| 表情包概率 | 0.15~0.3 | 配合自动收藏使用 |
| 备用模型 | 选一个同 provider 的可用模型 | 主模型空回复/限流时兜底 |

模型建议：

- 日常文字：`deepseek-v4.1-flash` 或你额度充足的模型；
- 需要识图：选支持 `text + image` 的模型（如 `deepseek-v4.1-flash`、`step-5-preview`、MiniMax 多模态型号）；
- 推理档位：群聊建议 `low`；太高会增加延迟和 token；
- 换模型后历史用量按 provider/model 分开统计，余额是全局钱包。

### 设置页结构

- **人设 / 模型**：人设、搭话模式、模型、推理档位、备用模型、用量与积分；
- **连接**：OneBot、token、自称、主人、自动拉起、Cookie 清理提示；
- **聊天频率（按群）**：阈值、关键词/成员概率、冷却、上限、连发、语音/唱歌/表情包概率、看图策略；
- **白名单 / 黑名单**：一行一个 QQ；白名单抬评分下限，黑名单压上限；
- **夜间**：时段与命中扣分；
- **语音**：音色、语速、音调、音量、语气预设、试听；
- **表情包**：自动收藏、数量/MB 上限、看图策略；
- **日记**：筛选、导出、删除。

### 数据与隐私

| 路径 | 内容 |
|---|---|
| `$DSH_HOME/dsh-qq-group/qq.json` | 连接、群策略、语音/唱歌 |
| `$DSH_HOME/dsh-qq-group/settings.json` | 人设、模型、名单、夜间、看图 |
| `$DSH_HOME/dsh-qq-group/qq-memory.json` | 每群记忆（上限 200 条/群） |
| `$DSH_HOME/dsh-qq-group/profiles.json` | 每群每人画像 |
| `$DSH_HOME/dsh-qq-group/diary.json` | 日记（上限 1000 条） |
| `$DSH_HOME/dsh-qq-group/stickers/` | 本地表情包 |

仓库**不包含**任何聊天记忆、日记、QQ 号、token、Cookie 或用户路径；这些只存在于本机运行时。`.gitignore` 已排除数据文件。

### 接话逻辑（简版）

1. @ / 叫名字 / 引用她 → **100% 直接回**；
2. 其它消息在 6 秒去抖后算 0~100 分：
   - 基础 30；关键词/指定成员概率；刚跟她聊过 +30；带“你” +15；
   - 熟识度、好感度、@ 别人、被冷落、夜间扣分、单条消息；
   - 白名单抬下限、黑名单压上限；
3. 分数 ≥ 阈值 → 按 `分数/100` 掷骰 → LLM 闸门（读最近上下文判断是不是在跟她说）；
4. 她说完后同一人接着说：高概率候选，但仍过闸门；
5. 任何人类消息都重置冷场计时与主动开口倒计时。

### 视觉看图

「表情包」→「看图策略」：

- 关闭 / 自定义（多选）/ 所有图片；
- 自定义可同时勾选：`@/叫名字/引用`、`强相关上下文`、`文字里问她看法`；
- 只有真正回复且命中条件才下载并计费；纯图片、无文字、没 @ 她的消息不触发。

### 参考项目与致谢

本项目的设计参考了这些开源项目的优点：

- [dsh-pet](https://github.com/PC2005-cloud/dsh-pet)：桌宠/插件工程结构；QQ 模块随后拆分成本项目；
- [zaofan-make/dsh-qqbot](https://github.com/zaofan-make/dsh-qqbot)：价值评分、人设、群友画像、上下文压缩等思路；
- [Jiangsubei/dsh-napcat-bridge](https://github.com/Jiangsubei/dsh-napcat-bridge)：主动搭话、夜间免打扰、别名、记忆等交互设计；
- [NapNeko/NapCatQQ](https://github.com/NapNeko/NapCatQQ)：QQ NT 的 OneBot 实现；
- [OneBot 11](https://github.com/botuniverse/onebot-11)：协议标准；
- [rany2/edge-tts](https://github.com/rany2/edge-tts)：免费、无需显卡的语音合成；
- [sdfsfsk/matsuko_cover](https://github.com/sdfsfsk/matsuko_cover) 与 [dsh-cover-pipeline](https://github.com/InariNGT-Ofiicial/dsh-cover-pipeline)：唱歌/翻唱链路的灵感来源；
- [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)：插件宿主、模型、附件与设置系统。

以上项目各自遵循其原许可证；本项目只借鉴设计思路，不复制其受限素材。

### 已知边界

- NapCat/QQ 的登录与风控由 QQ 侧决定，插件不绕过；
- 语音/唱歌依赖 edge-tts 网络与本地音频工具；
- 视觉识别受所选模型能力限制，不支持图片的模型会退回文字；
- 群聊内容会发给所选模型 provider，请自行评估隐私；
- 请遵守 QQ 与群规，不要用于骚扰、刷屏或未授权自动化。





























### v1.9.1 试听与明确语音/唱歌

- 试听按钮会应用当前 RVC 设置（包括未保存的模型/设备/音调）；失败时播放原音并提示。
- 明确要求发语音/说句话/听听声音时，按「被要求发语音概率」触发（默认 95%，100% 必发）。
- 明确要求唱歌/点歌/来一首时，按「被要求唱歌概率」触发（默认 90%，100% 必唱）。
- 修复模型自己选唱歌时 singChance 未生效的问题。

### v1.9.0 RVC 模型库与 780M

- 语音页自动扫描模型目录，列出 .pth/.onnx + index；不再手填长路径。
- 加入模型列表、打开目录、刷新和去重；可添加多个模型随时切换。
- 运行设备切换：自动 / DirectML（780M）/ CPU；ONNX 自动走 DirectML worker。
- 音调、推理超时、最长音频改为滑杆。
- 新增 ONNX worker + onnxruntime-directml，780M 实测可转换中文语音。

### v1.8.0 RVC 外部 worker 接口

- 可选 RVC：edge-tts 干音 → 外部 Python worker → 变声 WAV → QQ 语音。
- 语音和唱歌共用 RvcConverter；失败自动回退原音。
- 配置 Python、worker 脚本、模型/index、设备 auto/cpu/dml、变调、超时。
- 780M 核显优先 DirectML worker；不追求实时。
- 未配置脚本/模型时不启用，不影响现有 edge-tts。

### v1.7.1 引用图片与启动默认值

- 引用之前的图片时，通过 get_msg 读取被引用消息里的图片再交给视觉模型。
- 引用图片 + “这个是你吗/看看/评价”按直接对话处理。
- autoStart 默认改为 false：重启 DSH 不自动启动 QQ 连接，需在运行状态点“启动”。

### v1.7.0 按群心情 v1

- 每个群独立心情 0~100 + 七根情绪，基线默认 70。
- 直接对话后短模型判断一次，实际变化除以 3；12 小时半衰期。
- 可信度不足/变化不显著/每日额度满时不注入。
- 注入只作背景，不写成命令；不因被冒犯降心情。
- 接话页可看心情、情绪、最近理由并重置。

### v1.6.0 主动搭话 v2

- 概率命中线：峰/谷基础线 × 时机因子 + 没中加成。
- 刚聊过更难开口，冷太久更容易开口；安静时段不掷。
- 试运行默认开，只记账不发送；每轮只挑一个群。
- 保留旧版固定退避模式，可切换。
- 接话页新增参数面板和未中次数/试运行状态。

### v1.5.0 记忆 v3

- 新增 memory-v3 数据层：鲜活度、重要度、情绪、事实键、来源。
- 普通事件会淡忘，长期事实不衰减；同一 factKey 只保留最新。
- 按证据稀有度召回，最多 6 条 / 800 字 / 长期事实 2 条（可调）。
- 旧 qq-memory.json 保留并迁移；新增 memory-v3.json。
- 每 12 轮（可调）自动提炼 1~2 条记忆，压缩时也写入。
- 记忆页支持 v3 条目新增/编辑/删除、召回统计。

### v1.4.0 鲸鱼娘自拍照与隐式看图

- 在「表情包」页内新增 **鲸鱼娘自拍照** 库，独立于普通表情包；支持上传/删除/打开文件夹。
- “看看尾巴 / 看看你 / 爆个照”等在无附图时按自拍请求处理，按 per-group 自拍概率发送。
- 自拍概率 0~100%，100% = 有素材时必发。
- 自拍库为空时只按正常文字聊天含糊带过，不明说“我没有照片/图”。
- 有附图时“看看你/看看尾巴”优先识图，不会误发自己的自拍。
- 自拍触发词可在表情包页追加，按群生效。

### v1.3.0 发表情包与唱歌概率

- 发图概率从「接话」移到「表情包」页靠前位置：
  - 自动发图概率（模型想发时）；
  - 被要求发图概率（群友明确说“发个表情包/来张图/斗图”时）；100% = 必发；
  - 仍按仓库权重和上下文含义选图，inbox 的 0 权重不会绕过。
- 唱歌概率从「接话」移到「语音」页。
- 明确要图时按直接对话处理，不会被语音/唱歌分支抢走。

### v1.2.2 日记修复

- 每条实际生成的回复都会写日记；模型没给 `thought` 时用占位内心记录，不再整条丢失。
- 兼容半损坏 JSON：从文本里抢救 `thought` 字段。
- 提示词强化“必须输出完整 JSON 且带 thought”。
- 日记页在打开时每 5 秒自动刷新。

### v1.2.0 设置页排版

- 「用户画像」与「评分权重」改为分组卡片 + 自适应两列网格；
- 数字输入框固定 82px，右侧带单位，不再整行拉满；
- 按“关系语气 / 熟识度增长 / 好感度增长 / 敌意与衰减 / 初始好感 / 名单”分段；
- 说明卡片放在分组顶部，长文本与输入项不再挤在一起。

### v0.2.2 用户画像

- 「名单」Tab 改名「用户画像」，熟识度/好感度相关设置全部集中到这里。
- 可调项目：首次/后续发言、被点名、她回复、接话、引用、敌意扣分、长期不互动衰减、主人/白名单初始好感。
- 每项都有独立每日上限，填 0 = 不限；支持小数。
- 增加关系语气说明卡片：明确各熟识度/好感度区间的语气差异。
- 关系评分加成上限也移到「用户画像」。

### v0.2.1 新增

- **关系语气生效**：熟识度/好感度现在会生成明确的语气指令（陌生→很熟、反感→亲近），不只是数字。
- **评分全参数可调**：基础分（默认降到 15）、关键词/成员倍率、连续对话加成、@/引用/被冷落/单条/短消息扣分、关系加成上限、短消息字数。
- **明确看图请求**：带图消息里说“看看/看一下/这张图/照片/这猫可爱吗”，即使没 @、没叫名字，也按直接对话读图。
- **语音概率**：独立掷骰，不再依赖模型主动选 voice。

### v0.2 新增

- **表情包多仓库**：inbox / common / 自建仓库；每个仓库有发送权重（0 = 只手动用）、启用状态、默认入库设置；旧素材自动迁移到 common。
- **新图暂存与整理**：新图默认进 inbox（权重 0），不会自动发出；可在 UI 里移动、删除、编辑含义，再放入常用仓库。
- **入库过滤**：smart 模式跳过截图/大照片；支持全部保存；全局 SHA1 去重。
- **语音概率修复**：回复语音概率改为独立掷骰，不再依赖模型主动选 voice；支持语音字数上限，TTS 失败自动回退文字。
- **上下文长度**：在模型选择处按 provider/model 覆盖上下文窗口；按预算自动裁剪最近消息。
- **记忆 v2**：可配置原始记忆条数/token 预算/摘要长度/压缩频率；压缩时自动抽取关键记忆（事实/偏好/关系/梗），原文可归档。
- **文件阅读**：支持 txt/md/json/csv/代码、PDF 文本层、DOCX、XLSX；可配置触发条件、单文件 MB、最大字符数和每日上限。
- **合并转发**：通过 OneBot get_forward_msg 展开转发记录；限制节点/字符数，嵌套只显示占位。

### 许可

MIT，© 2026 SenuMirai。见 [LICENSE](./LICENSE)。

---

## English

### Features

| Feature | Details |
|---|---|
| **OneBot 11 / NapCat** | WebSocket connection to NapCatQQ; reconnect, startup checks, optional auto-launch |
| **Persona & model** | Uses DSH models; choose provider/model, reasoning effort and fallback per group chat |
| **Value scoring v3** | Not a reply to everything: @/name/quote always reply; ambient chat is scored 0–100 from keywords, members, context, familiarity, affinity and night penalty |
| **Cold-start logic** | Any human message resets both the reply debounce and proactive countdown; she stays quiet while the group is active |
| **Direct-message queue** | @/quote messages received while generating are queued, never dropped; proactive messages yield to direct ones |
| **Member profiles** | Per-group, per-user familiarity 0–100 and affinity -100–+100, updated by speech, mentions, replies, continuity and hostility |
| **Diary** | Every reply records context, score reasons and inner thought; filter, export, delete one/person |
| **Stickers** | Auto-collect group images, AI rename/tag, context-aware sending; count and disk caps |
| **Voice / singing** | edge-tts (no GPU), tone presets, preview, per-group probability; offline singing and built-in scores |
| **Vision** | Optionally pass real QQ images to a vision model: @ / strong context / opinion questions, multi-select to control tokens |
| **Night DND** | Cross-midnight window; configurable score penalty (0–100, default 20) |
| **Usage stats** | Real DSH usage tokens, per-model rates, calendar, balance estimate, history preserved across model switches |
| **Stability** | Guards around events/timers/async replies; extracts JSON from reasoning, retries, optional fallback model |

### Requirements

- **DeepSeek Harness** desktop or a host that can load plugins
- **Node.js 22.12+**, **pnpm 9+**
- **NapCatQQ** + **QQ NT** (Windows recommended; NapCat Docker on Linux is possible, confirm QQ login yourself)
- A spare QQ account for the bot, already in the target group
- Optional: a vision model, edge-tts (network), ffmpeg for some audio conversions

### Deployment

#### 1. Install and log in to NapCat

1. Install QQ NT and NapCatQQ.
2. Log in with the bot account.
3. Enable **OneBot 11** and add a **WebSocket server**:
   - URL: `ws://127.0.0.1:3001` (default)
   - Access token: generate a strong random string.
4. Confirm that NapCat reports the OneBot WebSocket as running.

#### 2. Install this plugin

```bash
git clone https://github.com/SenuMirai/dsh-qq-group.git
cd dsh-qq-group
pnpm install
pnpm run build
```

Link the directory into your DSH profile (or run `dsh plugin --profile desktop add <absolute-path>`):

```jsonc
// <DSH_HOME>/profiles/desktop/package.json
{
  "dependencies": {
    "dsh-qq-group": "link:/absolute/path/to/dsh-qq-group"
  },
  "dsh": {
    "profile": {
      "bundles": [
        // ... other plugins
        "dsh-qq-group"
      ]
    }
  }
}
```

**Restart DSH.** The "QQ Group" settings page appearing means the plugin loaded.

#### 3. Configure the connection

DSH Settings → "QQ Group" → "Connection":

| Field | Example | Notes |
|---|---|---|
| WebSocket URL | `ws://127.0.0.1:3001` | NapCat OneBot WS |
| Access token | `<YOUR_TOKEN>` | Must match NapCat; never commit it |
| Bot display name | `LittleWhale` | Names she answers to; comma-separated aliases allowed |
| Owner QQ | `<YOUR_QQ>` | Owner detection and initial affinity; may be empty |
| Auto-connect | on | Connect when DSH starts |
| Auto-launch NapCat | optional | Requires an absolute launcher path |

#### 4. Start

Click "Start" in settings, or @ the bot in a group. For first use, run "Health check" and "Model check".

### Recommended settings

Starting points; tune to your group:

| Setting | Recommendation | Notes |
|---|---|---|
| Chat mode | proactive | Passive only answers @/name; proactive also joins and starts cold chat |
| Score threshold | 55–65 | Higher is pickier; too low is noisy |
| Reply chance | 0.15–0.35 | Second roll after the score passes |
| Cooldown | 20–45 s | Minimum gap; direct conversations bypass it |
| Normal 10-min cap | 6–10 | Anti-spam; tune to group activity |
| Direct 10-min cap | 20–40 | Separate counter for @/quote/continuation |
| Debounce | 6 s | Wait for the group to settle; any new message resets it |
| Night DND | 23:00–08:00, penalty 20 | Increase for quieter nights; 0 disables the penalty |
| Vision policy | custom: @ + opinion questions | Cheapest useful default; choose all only if needed |
| Voice chance | 0.1–0.3 | Too high adds latency and spam |
| Sticker chance | 0.15–0.3 | Pair with auto-collect |
| Fallback model | A working model on the same provider | Covers empty replies/rate limits |

Model tips:

- Text: `deepseek-v4.1-flash` or another model with sufficient quota.
- Vision: choose a model with `text + image` input (e.g. `deepseek-v4.1-flash`, `step-5-preview`, multimodal MiniMax models).
- Reasoning: `low` is usually best for chat; higher effort adds latency and tokens.
- Usage history is kept per provider/model; the balance is a global wallet estimate.

### Settings layout

- **Persona / Model**: persona, mode, model, reasoning effort, fallback, usage/credits.
- **Connection**: OneBot URL, token, bot name, owner, auto-launch.
- **Chat frequency (per group)**: threshold, keyword/member chances, cooldown, caps, burst, voice/sing/sticker chances, vision policy.
- **Allow / block lists**: one QQ per line; allow-list raises the score floor, block-list lowers the ceiling.
- **Night**: window and penalty.
- **Voice**: voice, rate, pitch, volume, presets, preview.
- **Stickers**: auto-collect, count/MB caps, vision policy.
- **Diary**: filter, export, delete.

### Data and privacy

| Path | Contents |
|---|---|
| `$DSH_HOME/dsh-qq-group/qq.json` | Connection, group policy, voice/singing |
| `$DSH_HOME/dsh-qq-group/settings.json` | Persona, model, lists, night, vision |
| `$DSH_HOME/dsh-qq-group/qq-memory.json` | Per-group memory (200 turns/group) |
| `$DSH_HOME/dsh-qq-group/profiles.json` | Per-group member profiles |
| `$DSH_HOME/dsh-qq-group/diary.json` | Diary (1000 entries) |
| `$DSH_HOME/dsh-qq-group/stickers/` | Local stickers |

The repository contains **no** chat memory, diary, QQ numbers, tokens, cookies or user paths; those exist only in the local runtime. `.gitignore` excludes data files.

### Reply logic (short version)

1. @ / name / quote → **always reply directly**.
2. Other messages are scored 0–100 after a 6-second debounce:
   - base 30; keyword/member chances; +30 for the same person continuing; +15 for "you";
   - familiarity, affinity, @ someone else, being ignored, night penalty, single-message penalty;
   - allow-list floor, block-list ceiling.
3. Score ≥ threshold → roll `score/100` → LLM gate (recent context decides whether it is addressed to her).
4. Same person continuing after her reply: high-probability candidate, still gated.
5. Any human message resets the cold-start timer and proactive countdown.

### Vision

Stickers tab → "Vision policy":

- off / custom (multi-select) / all images.
- Custom modes can be combined: `@/name/quote`, `strong context`, `opinion question`.
- Images are downloaded and billed only when she actually replies and a condition matches; image-only messages without @ do not trigger.

### Credits

Design ideas were informed by:

- [dsh-pet](https://github.com/PC2005-cloud/dsh-pet): plugin/desktop-pet engineering; the QQ module later split into this project.
- [zaofan-make/dsh-qqbot](https://github.com/zaofan-make/dsh-qqbot): value scoring, persona, member profiles, context compression.
- [Jiangsubei/dsh-napcat-bridge](https://github.com/Jiangsubei/dsh-napcat-bridge): proactive chat, night DND, aliases, memory design.
- [NapNeko/NapCatQQ](https://github.com/NapNeko/NapCatQQ): OneBot implementation for QQ NT.
- [OneBot 11](https://github.com/botuniverse/onebot-11): protocol standard.
- [rany2/edge-tts](https://github.com/rany2/edge-tts): free, GPU-less speech synthesis.
- [sdfsfsk/matsuko_cover](https://github.com/sdfsfsk/matsuko_cover) and [dsh-cover-pipeline](https://github.com/InariNGT-Ofiicial/dsh-cover-pipeline): inspiration for the singing/cover pipeline.
- [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness): plugin host, models, attachments, settings.

Each project keeps its own license; this project borrows design ideas only and does not copy restricted assets.

### Known limits

- QQ login and risk control are decided by QQ/NapCat; this plugin does not bypass them.
- Voice/singing need edge-tts network access and local audio tools.
- Vision depends on the selected model; text-only models fall back to text.
- Group messages are sent to the selected model provider; evaluate privacy accordingly.
- Follow QQ rules and group rules; do not use for harassment, spam or unauthorized automation.





























### v1.9.1 Preview and explicit voice/singing

- The preview button now applies the current RVC settings, including unsaved model/device/pitch; on failure it plays the original voice and reports why.
- Explicit "send a voice message / say something / let me hear your voice" uses the configurable requested-voice chance (default 95%, 100% = always).
- Explicit "sing / request a song / sing a song" uses the configurable requested-singing chance (default 90%, 100% = always).
- Fixed singChance not being applied when the model chose to sing by itself.

### v1.9.0 RVC model library and 780M

- Voice tab scans the model directory and lists .pth/.onnx + index; no long paths.
- Model dropdown, open folder, refresh and dedupe; multiple models switchable.
- Device switch: auto / DirectML (780M) / CPU; ONNX automatically uses the DirectML worker.
- Pitch, timeout and max duration are sliders.
- Added ONNX worker + onnxruntime-directml; verified Chinese conversion on the 780M.

### v1.8.0 RVC external worker

- Optional RVC: edge-tts dry audio → external Python worker → converted WAV → QQ voice.
- Speech and singing share RvcConverter; failures fall back to the original audio.
- Configure Python, worker script, model/index, device auto/cpu/dml, pitch and timeout.
- 780M iGPU can use DirectML; real-time is not required.
- Disabled when no script/model is configured; existing edge-tts is unaffected.

### v1.7.1 quoted images and auto-start

- Quoted previous images are fetched via get_msg and passed to vision.
- Quoted image + “is this you / look / evaluate” goes through direct reply.
- autoStart now defaults to false: restarting DSH does not start QQ; use the Start button.

### v1.7.0 per-group mood v1

- Each group has its own mood 0–100 plus seven dimensions; baseline 70.
- A short model judgement after direct replies; actual change divided by 3; 12h half-life.
- Low confidence / insignificant / daily cap means no injection.
- Injection is background only, never a command; insults do not lower mood.
- Chat tab shows mood, dimensions, latest reason and reset.

### v1.6.0 proactive v2

- Probability hit line: peak/off-peak base × timing factor + miss bonus.
- Recent chat makes it harder; long silence makes it easier; quiet hours skip.
- Trial mode defaults on (log only); one group per tick.
- Legacy fixed-backoff mode remains selectable.
- Chat tab adds controls and shows misses/trial state.

### v1.5.0 memory v3

- New memory-v3 layer: freshness, importance, emotion, fact keys, source.
- Events decay; stable facts do not. The latest item wins per fact key.
- Evidence-based recall, max 6 items / 800 chars / 2 facts (configurable).
- Legacy qq-memory.json is kept and migrated into memory-v3.json.
- Every 12 turns (configurable) extracts 1–2 memories; compression also writes.
- Memory page supports add/edit/delete and recall stats.

### v1.4.0 selfie library and implicit visual intents

- Added a **whale-girl selfie** library inside Stickers, separate from the normal sticker repo; upload/delete/open-folder supported.
- "Show your tail / show yourself / send a selfie" without an attached image is treated as a selfie request and uses a per-group selfie chance.
- Selfie chance 0–100%; 100% always sends when an asset exists.
- With an empty library it replies as normal text and never says "I have no photo".
- When an image is attached, "look at you/tail" prefers image understanding and does not send a selfie.
- Extra selfie trigger words are configurable per group in the Stickers tab.

### v1.3.0 sticker request and singing probability

- Image probability moved to the top of the Stickers tab:
  - normal send probability when the model wants to send;
  - requested-send probability when someone explicitly asks for a sticker/image; 100% = always send;
  - still picks by repository weight and context; inbox weight 0 is still excluded.
- Singing probability moved from Chat to Voice.
- Explicit image-send requests are treated as direct, so voice/singing branches cannot consume them first.

### v1.2.2 diary fix

- Every generated reply is now written to the diary; when the model omits `thought`, a placeholder inner note is stored instead of dropping the entry.
- Tolerant extraction of `thought` from partially broken JSON.
- Prompt now explicitly requires a complete JSON object with `thought`.
- The diary tab auto-refreshes every 5 seconds while open.

### v1.2.0 settings layout

- User Profiles and Score Weights now use section cards with an adaptive two-column grid.
- Numeric fields are fixed at 82px with units, instead of stretching across the row.
- Sections: tone guide / familiarity growth / affinity growth / hostility and decay / initial affinity / lists.
- Explanation cards sit above each group; long text no longer crowds the inputs.

### v0.2.2 User profiles

- Renamed the "Lists" tab to "User Profiles"; all familiarity/affinity settings live there.
- Editable: first/subsequent messages, mentions, replies, continuations, quotes, hostility loss, inactivity decay, initial owner/whitelist affinity.
- Each item has its own daily cap; 0 = unlimited; decimals supported.
- Added a relationship-tone explanation card for each familiarity/affinity band.
- Relationship score caps moved to User Profiles.

### v0.2.1 additions

- **Relationship tone now takes effect**: familiarity/affinity produce explicit tone directives (stranger → very familiar, dislike → close), not just numbers.
- **All score parameters editable**: base (default lowered to 15), keyword/member multipliers, continuation bonuses, @/quote/ignored/single/short-message penalties, relationship caps and short-message threshold.
- **Explicit image requests**: with an image, “look at this / this photo / is this cat cute” is treated as a direct request even without @ or name.
- **Voice probability**: independent roll, no longer dependent on the model choosing voice.

### v0.2 additions

- **Multiple sticker repositories**: inbox / common / custom repos, each with a send weight (0 = manual only), enabled flag and default-save setting; legacy assets migrate to common.
- **Inbox workflow**: newly saved images go to inbox (weight 0) and are never auto-sent; move/delete/edit descriptions in the UI, then move approved ones to a common repo.
- **Save filtering**: smart mode skips screenshots/large photos; keep-all mode available; global SHA1 dedupe.
- **Voice probability fix**: reply voice is now an independent roll, no longer dependent on the model choosing voice; max character limit and text fallback on TTS failure.
- **Context length**: per provider/model override; recent messages are trimmed to the budget.
- **Memory v2**: configurable raw turn/token/summary limits and compression interval; compression extracts key memories (facts/preferences/relationships/jokes); original turns can be archived.
- **File reading**: text/markdown/JSON/CSV/code, PDF text layer, DOCX, XLSX; configurable triggers, max MB, max characters and daily limit.
- **Forwarded chat records**: expand with OneBot get_forward_msg; node/character caps; nested forwards show a placeholder.

### License

MIT, © 2026 SenuMirai. See [LICENSE](./LICENSE).
