/**
 * 鲸鱼娘自拍照库：独立于普通表情包仓库。
 * 素材由主人自行放进 selfies/ 或通过设置页上传；绝不使用真实个人照片。
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, statSync, unlinkSync, writeFileSync } from 'node:fs';
import { basename, extname, join } from 'node:path';

const IMAGE_EXT = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp']);
const MAX_BYTES = 6 * 1024 * 1024;

export interface SelfieInfo {
  file: string;
  tags: string[];
  description: string;
  addedAt: number;
  bytes?: number;
  used?: number;
}

interface SelfieMeta extends SelfieInfo {
  sha1?: string;
}

interface SelfieState {
  version: 1;
  items: Record<string, SelfieMeta>;
}

const selfieDir = (root: string): string => join(root, 'selfies');
const statePath = (root: string): string => join(root, 'selfies.json');

function readState(root: string): SelfieState {
  try {
    const parsed = JSON.parse(readFileSync(statePath(root), 'utf8').replace(/^\uFEFF/, '')) as Partial<SelfieState>;
    const items: Record<string, SelfieMeta> = {};
    if (parsed.items !== null && typeof parsed.items === 'object') {
      for (const [file, raw] of Object.entries(parsed.items as Record<string, unknown>)) {
        if (!IMAGE_EXT.has(extname(file).toLowerCase())) continue;
        const item = raw as Partial<SelfieMeta>;
        items[file] = {
          file,
          tags: Array.isArray(item.tags) ? item.tags.filter((t): t is string => typeof t === 'string').slice(0, 12) : [],
          description: typeof item.description === 'string' ? item.description : '',
          addedAt: typeof item.addedAt === 'number' ? item.addedAt : Date.now(),
          ...(typeof item.bytes === 'number' ? { bytes: item.bytes } : {}),
          ...(typeof item.used === 'number' ? { used: item.used } : {}),
          ...(typeof item.sha1 === 'string' ? { sha1: item.sha1 } : {}),
        };
      }
    }
    return { version: 1, items };
  } catch {
    return { version: 1, items: {} };
  }
}

function writeState(root: string, state: SelfieState): void {
  mkdirSync(root, { recursive: true });
  const tmp = `${statePath(root)}.tmp`;
  writeFileSync(tmp, `${JSON.stringify(state, null, 2)}\n`, 'utf8');
  renameSync(tmp, statePath(root));
}

function tagsFromName(name: string): string[] {
  const base = basename(name, extname(name));
  const words = base.split(/[-_\s]+/).filter((w) => w.length > 0).slice(0, 8);
  const tags = [...words];
  if (/尾|tail/i.test(base) && !tags.includes('尾巴')) tags.push('尾巴');
  if (/耳|ear/i.test(base) && !tags.includes('耳朵')) tags.push('耳朵');
  if (/自拍|selfie/i.test(base) && !tags.includes('自拍')) tags.push('自拍');
  return [...new Set(tags)].slice(0, 12);
}

function adoptOrphans(root: string, state: SelfieState): void {
  const dir = selfieDir(root);
  mkdirSync(dir, { recursive: true });
  let changed = false;
  let files: string[] = [];
  try {
    files = readdirSync(dir).filter((file) => IMAGE_EXT.has(extname(file).toLowerCase()));
  } catch {
    return;
  }
  for (const file of files) {
    if (state.items[file] !== undefined) continue;
    const path = join(dir, file);
    state.items[file] = {
      file,
      tags: tagsFromName(file),
      description: '',
      addedAt: Date.now(),
      ...(statSync(path, { throwIfNoEntry: false })?.size === undefined
        ? {}
        : { bytes: statSync(path, { throwIfNoEntry: false })!.size }),
      used: 0,
    };
    changed = true;
  }
  if (changed) writeState(root, state);
}

/** 新增一张自拍照（来自 UI 上传） */
export function saveSelfie(root: string, name: string, bytes: Uint8Array): SelfieInfo | undefined {
  if (bytes.byteLength === 0 || bytes.byteLength > MAX_BYTES) return undefined;
  const ext = extname(name).toLowerCase();
  if (!IMAGE_EXT.has(ext)) return undefined;
  const state = readState(root);
  adoptOrphans(root, state);
  const sha1 = createHash('sha1').update(bytes).digest('hex').slice(0, 16);
  if (Object.values(state.items).some((item) => item.sha1 === sha1)) return undefined;
  mkdirSync(selfieDir(root), { recursive: true });
  const safe = basename(name, ext).replace(/[\\/:*?"<>|\s]+/g, '-').slice(0, 40) || 'selfie';
  const file = `${Date.now()}-${safe}-${sha1}${ext}`;
  const path = join(selfieDir(root), file);
  writeFileSync(path, bytes);
  const item: SelfieMeta = {
    file,
    tags: tagsFromName(file),
    description: '',
    addedAt: Date.now(),
    bytes: bytes.byteLength,
    used: 0,
    sha1,
  };
  state.items[file] = item;
  writeState(root, state);
  return item;
}

export function listSelfies(root: string): SelfieInfo[] {
  const state = readState(root);
  adoptOrphans(root, state);
  const dir = selfieDir(root);
  let changed = false;
  for (const file of Object.keys(state.items)) {
    if (!existsSync(join(dir, file))) {
      delete state.items[file];
      changed = true;
    }
  }
  if (changed) writeState(root, state);
  return Object.values(state.items)
    .filter((item) => existsSync(join(dir, item.file)))
    .map(({ file, tags, description, addedAt, bytes, used }) => ({ file, tags, description, addedAt, ...(bytes === undefined ? {} : { bytes }), ...(used === undefined ? {} : { used }) }))
    .sort((a, b) => b.addedAt - a.addedAt);
}

export function selfieFile(root: string, name: string): string | undefined {
  const file = basename(name);
  if (!IMAGE_EXT.has(extname(file).toLowerCase())) return undefined;
  const path = join(selfieDir(root), file);
  return existsSync(path) ? path : undefined;
}

export function deleteSelfie(root: string, name: string): boolean {
  const file = basename(name);
  const state = readState(root);
  const path = join(selfieDir(root), file);
  try {
    if (existsSync(path)) unlinkSync(path);
  } catch {
    return false;
  }
  delete state.items[file];
  writeState(root, state);
  return true;
}

export interface SelfieHub {
  list(): SelfieInfo[];
  resolve(name: string): string | undefined;
  pick(text: string): SelfieInfo | undefined;
  markUsed?(name: string): void;
}

export function createSelfieHub(root: string): SelfieHub {
  let last: string | undefined;
  return {
    list: () => listSelfies(root),
    resolve: (name) => selfieFile(root, name),
    pick: (text) => {
      const items = listSelfies(root);
      if (items.length === 0) return undefined;
      const words = text.toLowerCase();
      const scored = items.map((item) => {
        const hay = `${item.file} ${item.tags.join(' ')} ${item.description}`.toLowerCase();
        let score = 0;
        for (const tag of item.tags) {
          if (tag !== '' && words.includes(tag.toLowerCase())) score += 4;
        }
        if (/尾巴|鱼尾|尾鳍|tail/i.test(text) && /尾巴|鱼尾|尾鳍|tail/i.test(hay)) score += 8;
        if (/耳朵|耳|ear/i.test(text) && /耳朵|耳|ear/i.test(hay)) score += 8;
        if (/自拍|照片|看看你|长什么样|长啥样|selfie/i.test(text) && /自拍|selfie|全身|正面/i.test(hay)) score += 5;
        if (/脸|眼睛|头发|衣服|裙子/i.test(text) && /脸|眼睛|头发|衣服|裙子/i.test(hay)) score += 5;
        score -= (item.used ?? 0) * 0.1;
        return { item, score };
      });
      const best = Math.max(...scored.map((entry) => entry.score));
      const pool = scored.filter((entry) => entry.score === best);
      const pick = pool[Math.floor(Math.random() * pool.length)]!;
      if (items.length > 1 && pick.item.file === last) {
        const other = items.find((item) => item.file !== last);
        if (other !== undefined) {
          last = other.file;
          return other;
        }
      }
      last = pick.item.file;
      return pick.item;
    },
    markUsed: (name) => {
      try {
        const state = readState(root);
        const item = state.items[basename(name)];
        if (item === undefined) return;
        item.used = (item.used ?? 0) + 1;
        writeState(root, state);
      } catch {
        /* ignore */
      }
    },
  };
}

export { selfieDir };
