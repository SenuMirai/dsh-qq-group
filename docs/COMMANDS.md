# 常用命令与接口

## 开发

```powershell
cd C:\DSHwork\plugins-src\dsh-qq-group
pnpm install
node node_modules\tsdown\bin\tsdown.js
npm test
```

## 版本与健康

```text
GET /dsh-qq-group/version
```

返回：

```json
{
  "ok": true,
  "version": "1.22.0",
  "diskVersion": "1.22.0",
  "stale": false,
  "pid": 12345
}
```

`stale: true` 表示运行进程落后于磁盘构建，需要重启 DSH。

本地 TTS 网关：

```text
GET /dsh-qq-group/tts-health
```

## GPT-SoVITS

```powershell
# API
cd C:\DSHwork\models\tts\gpt-sovits\GPT-SoVITS
.venv\Scripts\python.exe api_v2.py -a 127.0.0.1 -p 9880 -c GPT_SoVITS/configs/tts_infer.yaml

# 网关
.venv\Scripts\python.exe C:\DSHwork\models\tts\gsv_gateway.py
```

热切换权重：

```text
GET http://127.0.0.1:9880/set_gpt_weights?weights_path=GPT_SoVITS/GPT_weights_v2ProPlus/藿藿-e10.ckpt
GET http://127.0.0.1:9880/set_sovits_weights?weights_path=GPT_SoVITS/SoVITS_weights_v2ProPlus/藿藿_e10_s180.pth
```

## 备份与恢复

本地备份目录只保留最新一份，包含：

```text
plugin/ data/ models/gpt-sovits/ models/voices/ services/ dsf-profile/
RESTORE-WITH-MODELS.md
MODELS.md
CHECKSUMS.txt
```

恢复步骤见备份里的 `RESTORE-WITH-MODELS.md`。

## 参考文档

- [语音模型安装](./VOICE-MODELS.md)
- [项目 README](../README.md)
- [更新日志](../CHANGELOG.md)
