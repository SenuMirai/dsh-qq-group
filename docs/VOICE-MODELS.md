# 语音模型安装（GPT-SoVITS）

本文说明如何把 GPT-SoVITS 角色权重接入插件。插件只依赖本地 HTTP 网关，不直接加载模型。

## 1. 环境

```text
Python 3.10
torch CPU 版
onnxruntime（v2ProPlus 的 SV 需要）
ffmpeg
```

本机参考路径：

```text
C:\DSHwork\models\tts\gpt-sovits\GPT-SoVITS
C:\DSHwork\models\tts\gpt-sovits\.venv
```

## 2. 放置权重

每个角色需要两个文件：

```text
GPT_SoVITS/GPT_weights_v2ProPlus/<角色>-e10.ckpt
GPT_SoVITS/SoVITS_weights_v2ProPlus/<角色>_e10_s<步数>.pth
```

例如：

```text
GPT_weights_v2ProPlus/藿藿-e10.ckpt
SoVITS_weights_v2ProPlus/藿藿_e10_s180.pth
```

## 3. 放置参考音与清单

参考音放在：

```text
GPT-SoVITS/ref/
```

清单文件：

```text
GPT-SoVITS/ref/voices.json
```

结构：

```json
{
  "角色名": {
    "gpt": "GPT_SoVITS/GPT_weights_v2ProPlus/角色-e10.ckpt",
    "sovits": "GPT_SoVITS/SoVITS_weights_v2ProPlus/角色_e10_s180.pth",
    "styles": {
      "开心": { "file": "ref/角色-happy.wav", "prompt": "参考音里逐字对应的台词" },
      "生气": { "file": "ref/角色-angry.wav", "prompt": "..." }
    }
  }
}
```

`prompt` 必须和参考音内容逐字一致，标点也不要改；否则音色会漂。

当前内置七个角色：

```text
三月七、银狼、藿藿、白露、虎克、青雀、克拉拉
```

## 4. 启动 API 与网关

```text
start-gsv-api.bat      启动 api_v2.py，端口 9880
start-gsv-gateway.bat  启动 gsv_gateway.py，端口 50123
start-tts-all.bat      两个一起启动
```

手动命令：

```powershell
cd C:\DSHwork\models\tts\gpt-sovits\GPT-SoVITS
.venv\Scripts\python.exe api_v2.py -a 127.0.0.1 -p 9880 -c GPT_SoVITS/configs/tts_infer.yaml
```

```powershell
.venv\Scripts\python.exe C:\DSHwork\models\tts\gsv_gateway.py
```

健康检查：

```powershell
curl http://127.0.0.1:9880/docs
curl http://127.0.0.1:50123/health
```

## 5. 插件配置

语音页：

```text
后端：GPT-SoVITS
网关：http://127.0.0.1:50123
服务启动脚本：C:\DSHwork\models\tts\start-tts-all.bat
```

点「启动」时如果网关离线，插件会自动运行服务脚本并等待最多 30 秒。

## 6. 版权

角色权重来自公开合集，训练者标注为 CC-BY-NC 4.0，角色形象与语音权利归米哈游。

- 禁止商用；
- 禁止二次配布；
- 二创需标注训练者；
- 原作者要求下架时应立即停止使用。

插件代码本身是 MIT，但**模型权重不适用 MIT**。
