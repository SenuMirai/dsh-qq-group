/**
 * RVC 外部 worker 适配器。
 *
 * 这里不内置 PyTorch/ONNX 推理，只约定一个可替换的 worker：
 *   python rvc_worker.py --input in.wav --output out.wav --model model.pth \
 *     --index index --device auto --pitch 0
 *
 * 这样 780M 核显可以走 ONNX/DirectML worker，CPU 也能用 PyTorch worker；
 * 上层语音链路只依赖 RvcConverter，不关心实现。
 */
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export interface RvcWorkerConfig {
  pythonPath: string;
  scriptPath: string;
  modelPath: string;
  indexPath: string;
  device: 'auto' | 'cpu' | 'dml' | 'cuda';
  pitch: number;
  timeoutMs: number;
  maxSeconds: number;
}

export type RvcResult =
  | { ok: true; wav: Uint8Array }
  | { ok: false; reason: 'disabled' | 'not-configured' | 'timeout' | 'failed'; message: string };

export interface RvcConverter {
  convert(wav: Uint8Array, options?: { signal?: AbortSignal }): Promise<RvcResult>;
}

export function createCommandRvcConverter(config: RvcWorkerConfig): RvcConverter {
  return {
    async convert(wav, options = {}) {
      if (config.scriptPath.trim() === '' || config.modelPath.trim() === '') {
        return { ok: false, reason: 'not-configured', message: 'RVC worker 或模型路径没有配置' };
      }
      if (wav.byteLength === 0) return { ok: false, reason: 'failed', message: 'RVC 输入音频为空' };
      const dir = mkdtempSync(join(tmpdir(), 'qq-rvc-'));
      const input = join(dir, 'input.wav');
      const output = join(dir, 'output.wav');
      try {
        writeFileSync(input, wav);
        const args = [
          config.scriptPath,
          '--input', input,
          '--output', output,
          '--model', config.modelPath,
          '--index', config.indexPath,
          '--device', config.device,
          '--pitch', String(Math.round(config.pitch)),
        ];
        const result = await runWorker(config.pythonPath || 'python', args, config.timeoutMs, options.signal);
        if (!result.ok) return result;
        if (!existsSync(output)) return { ok: false, reason: 'failed', message: 'RVC worker 没有生成输出文件' };
        const bytes = readFileSync(output);
        if (bytes.byteLength < 44 || bytes.toString('ascii', 0, 4) !== 'RIFF') {
          return { ok: false, reason: 'failed', message: 'RVC worker 输出不是 WAV' };
        }
        return { ok: true, wav: new Uint8Array(bytes) };
      } catch (e) {
        return { ok: false, reason: 'failed', message: e instanceof Error ? e.message : String(e) };
      } finally {
        try {
          rmSync(dir, { recursive: true, force: true });
        } catch {
          /* ignore */
        }
      }
    },
  };
}

function runWorker(
  python: string,
  args: string[],
  timeoutMs: number,
  signal?: AbortSignal,
): Promise<{ ok: true } | { ok: false; reason: 'timeout' | 'failed'; message: string }> {
  return new Promise((resolve) => {
    const child = spawn(python, args, { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    let stderr = '';
    let settled = false;
    const finish = (result: { ok: true } | { ok: false; reason: 'timeout' | 'failed'; message: string }): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(result);
    };
    const timer = setTimeout(() => {
      try {
        child.kill();
      } catch {
        /* ignore */
      }
      finish({ ok: false, reason: 'timeout', message: `RVC worker 超时（${Math.round(timeoutMs / 1000)} 秒）` });
    }, Math.max(1000, timeoutMs));
    child.stderr?.on('data', (chunk: Buffer) => {
      stderr += chunk.toString('utf8');
      if (stderr.length > 4000) stderr = stderr.slice(-4000);
    });
    child.on('error', (e) => finish({ ok: false, reason: 'failed', message: `RVC worker 启动失败：${e.message}` }));
    child.on('close', (code) => {
      if (code === 0) finish({ ok: true });
      else finish({ ok: false, reason: 'failed', message: `RVC worker 退出码 ${code}${stderr === '' ? '' : `：${stderr.slice(-500)}`}` });
    });
    const abort = (): void => {
      try {
        child.kill();
      } catch {
        /* ignore */
      }
      finish({ ok: false, reason: 'failed', message: 'RVC 已取消' });
    };
    if (signal?.aborted === true) abort();
    else signal?.addEventListener('abort', abort, { once: true });
  });
}
