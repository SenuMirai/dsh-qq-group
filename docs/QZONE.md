# QQ空间增强说明

## 已实现

### 1. 发说说配图

配图模式：

```text
off    不配图
fixed  固定张数 0~9
range  区间随机 0~9
model  模型决定 0~9
```

图片来源：

```text
表情包仓库（可多选；不选 = 全部）
```

发布时只读取本地仓库里的图片，通过 NapCat `send_qzone_msg` 的 `images` 字段上传。最多 9 张。

### 2. 文本 @

NapCat 没有真正的空间 @ 参数，只有 `content`。所以这里的 @ 是**正文里的文字**：

```text
@昵称 今天……
```

不代表对方一定会收到 QQ空间 @ 通知。

模式：

```text
off    不 @
list   从 QQ 名单随机（受概率控制）
model  把名单交给模型，让模型决定是否写 @
```

名单格式：QQ 号 + 昵称。

### 3. 本地说说记录

每次通过插件发布成功，都会写 `qzone.json`：

```text
tid / 正文 / 时间 / 可见范围 / 图片路径
```

空间页支持：

- 按日期筛选（起止）；
- 最新/最早排序；
- 滚动加载更早；
- 底部「加载更早的说说」。

### 4. 群聊读自己的空间

群友问“你空间发了什么”时，如果消息里出现「空间 / 说说 / 动态 / qzone」，提示词会注入最近 5 条本地说说记录。

只读本地记录，不访问网络，也不会编造没发过的内容。

### 5. 远程读取（Qzone cookie，默认关闭）

通过 NapCat `get_cookies` 拿 qzone cookies，再调用：

```text
emotion_cgi_msglist_v6
```

可以读取：

- 自己的说说；
- 指定 QQ 的说说（受对方权限限制）；
- 说说下的评论（需额外开启评论读取）。

风险开关：

```text
启用远程读取
接受风险
读取评论
评论风险
```

默认全部关闭。远程读取可能触发风控，只建议手动、低频使用。

## 尚未实现

### 回复评论

目前只读取评论，不写评论。  
Qzone 评论写入接口未在 NapCat 暴露，需要走 `emotion_cgi_re_feeds` 网页接口，涉及 cookie、g_tk、topicId 和风控；计划下一阶段做成：

```text
读取评论
→ 生成回复草稿
→ 主人确认
→ 调用 Qzone 评论接口
```

不会自动回复陌生人。

## 配置项

```text
qzone.imageMode
qzone.imageFixed
qzone.imageMin / qzone.imageMax
qzone.imageRepos
qzone.mentionMode
qzone.mentionList
qzone.mentionChance
qzone.remoteEnabled
qzone.remoteRiskAccepted
qzone.remoteLimit
qzone.commentEnabled
qzone.commentRiskAccepted
```

## 安全边界

- 远程读取默认关闭，必须勾选风险；
- 不自动巡检别人空间；
- 不自动回复评论；
- 不保存 Qzone cookies 到日志；
- 图片仅来自本地表情包仓库。
