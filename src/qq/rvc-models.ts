/** 扫描本地 RVC 模型目录：每个子目录里找 .pth/.onnx 和 .index。 */
import { existsSync, readdirSync, statSync } from 'node:fs';
import { basename, extname, join } from 'node:path';

export interface RvcModelEntry {
  id: string;
  label: string;
  dir: string;
  pth?: string;
  onnx?: string;
  index?: string;
  format: 'pth' | 'onnx' | 'both';
  bytes: number;
}

const SKIP = new Set(['__MACOSX', 'node_modules', '.git', 'venv', 'venv-onnx', 'hf-cache', 'python', 'bin', 'uv-cache', 'samples']);

function walk(root: string, depth: number, out: RvcModelEntry[], seen: Set<string>): void {
  if (depth > 3) return;
  let entries: ReturnType<typeof readdirSync>;
  try {
    entries = readdirSync(root, { withFileTypes: true });
  } catch {
    return;
  }
  const files = entries.filter((entry) => entry.isFile()).map((entry) => entry.name);
  const pths = files.filter((file) => extname(file).toLowerCase() === '.pth');
  const onnx = files.filter((file) => extname(file).toLowerCase() === '.onnx');
  const indexes = files.filter((file) => extname(file).toLowerCase() === '.index');
  if (pths.length > 0 || onnx.length > 0) {
    const preferredPth = pths.find((file) => /^model\./i.test(file)) ?? pths[0];
    const preferredOnnx = onnx.find((file) => /^model\./i.test(file)) ?? onnx[0];
    const preferredIndex = indexes.find((file) => /^model\./i.test(file)) ?? indexes[0];
    const label = basename(root);
    const id = root.replace(/\\/g, '/');
    if (!seen.has(id)) {
      seen.add(id);
      out.push({
        id,
        label,
        dir: root,
        ...(preferredPth === undefined ? {} : { pth: join(root, preferredPth) }),
        ...(preferredOnnx === undefined ? {} : { onnx: join(root, preferredOnnx) }),
        ...(preferredIndex === undefined ? {} : { index: join(root, preferredIndex) }),
        format: preferredOnnx !== undefined && preferredPth !== undefined ? 'both' : preferredOnnx !== undefined ? 'onnx' : 'pth',
        bytes:
          (preferredPth === undefined ? 0 : statSync(join(root, preferredPth), { throwIfNoEntry: false })?.size ?? 0) +
          (preferredOnnx === undefined ? 0 : statSync(join(root, preferredOnnx), { throwIfNoEntry: false })?.size ?? 0),
      });
    }
  }
  for (const entry of entries) {
    if (!entry.isDirectory() || SKIP.has(entry.name)) continue;
    walk(join(root, entry.name), depth + 1, out, seen);
  }
}

export function scanRvcModels(root: string): RvcModelEntry[] {
  const out: RvcModelEntry[] = [];
  const seen = new Set<string>();
  if (existsSync(root)) walk(root, 0, out, seen);
  // 同一模型常同时存在“原始解压目录”和整理后的 model.* 目录；
  // 用 pth/onnx + index 的大小做轻量去重，优先保留带 ONNX 的那份。
  const dedup = new Map<string, RvcModelEntry>();
  for (const entry of out) {
    const pthSize = entry.pth === undefined ? 0 : statSync(entry.pth, { throwIfNoEntry: false })?.size ?? 0;
    const onnxSize = entry.onnx === undefined ? 0 : statSync(entry.onnx, { throwIfNoEntry: false })?.size ?? 0;
    const indexSize = entry.index === undefined ? 0 : statSync(entry.index, { throwIfNoEntry: false })?.size ?? 0;
    const key =
      pthSize > 0
        ? `${pthSize}:${indexSize}`
        : `onnx:${onnxSize}:${indexSize}`;
    const existing = dedup.get(key);
    if (existing === undefined || (entry.onnx !== undefined && existing.onnx === undefined)) {
      dedup.set(key, entry);
    }
  }
  return [...dedup.values()].sort((a, b) => a.label.localeCompare(b.label, 'zh-CN'));
}
