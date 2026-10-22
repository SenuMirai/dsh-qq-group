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
