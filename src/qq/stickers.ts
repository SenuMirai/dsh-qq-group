/**
 * 表情包仓库 v2：
 * - 多个仓库 + 权重 + 默认入库仓库
 * - 旧版平铺 stickers/ 自动迁移到 repos/common
 * - 只保存“像表情包”的图（可配置为全部保存）
 * - 发送时按仓库权重抽，inbox（权重 0）不会被自动发出
 */
import { createHash } from 'node:crypto';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { basename, extname, join } from 'node:path';
import type { ObSegment } from './types';
import type { StickerHub, StickerInfo, StickerSaveContext } from './bridge';

const IMAGE_EXT = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp']);
const MAX_IMAGE_BYTES = 2 * 1024 * 1024;

export type StickerFilterMode = 'smart' | 'all';
export type StickerStatus = 'inbox' | 'approved' | 'hidden';

export interface StickerRepo {
  id: string;
  name: string;
  /** 自动发送相对权重；0 = 只能手动使用 */
  weight: number;
  /** 新图默认放这个仓库 */
  saveTarget: boolean;
  enabled: boolean;
  maxItems: number;
  maxMB: number;
  /** 入库后自动让模型猜含义（默认关闭，省 token） */
  autoAnalyze: boolean;
  createdAt: number;
}

export interface StickerMeta {
  file: string;
  repoId: string;
  addedAt: number;
  tags: string[];
  description: string;
  used: number;
  lastUsedAt?: number;
  status: StickerStatus;
  sha1?: string;
  width?: number;
  height?: number;
  bytes?: number;
  mime?: string;
  sourceGroup?: string;
  sourceUser?: string;
  pinned?: boolean;
}

interface StickerState {
  version: 2;
  repos: StickerRepo[];
  items: Record<string, StickerMeta>;
}

const stickersDir = (root: string): string => join(root, 'stickers');
const statePath = (root: string): string => join(root, 'stickers.json');
const reposDir = (root: string): string => join(stickersDir(root), 'repos');
const repoDir = (root: string, repoId: string): string => join(reposDir(root), repoId);

const now = (): number => Date.now();

function defaultRepo(id: string, name: string, weight: number, saveTarget: boolean): StickerRepo {
  return {
    id,
    name,
    weight,
    saveTarget,
    enabled: true,
    maxItems: id === 'inbox' ? 500 : 1500,
    maxMB: id === 'inbox' ? 100 : 500,
    autoAnalyze: false,
    createdAt: now(),
  };
}

function defaultState(): StickerState {
  return {
    version: 2,
    repos: [defaultRepo('inbox', '新图暂存', 0, true), defaultRepo('common', '常用表情包', 100, false)],
    items: {},
  };
}

function safeRepoId(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 32);
}

function normalizeRepo(raw: unknown): StickerRepo | undefined {
  if (raw === null || typeof raw !== 'object') return undefined;
  const item = raw as Partial<StickerRepo>;
  const id = safeRepoId(typeof item.id === 'string' ? item.id : '');
  const name = typeof item.name === 'string' ? item.name.trim().slice(0, 40) : '';
  if (id === '' || name === '') return undefined;
  return {
    id,
    name,
    weight: Math.max(0, Math.min(100, Math.round(typeof item.weight === 'number' ? item.weight : 0))),
    saveTarget: item.saveTarget === true,
    enabled: item.enabled !== false,
    maxItems: Math.max(0, Math.min(5000, Math.round(typeof item.maxItems === 'number' ? item.maxItems : 500))),
    maxMB: Math.max(0, Math.min(5000, Math.round(typeof item.maxMB === 'number' ? item.maxMB : 100))),
    autoAnalyze: item.autoAnalyze === true,
    createdAt: typeof item.createdAt === 'number' ? item.createdAt : now(),
  };
}

function normalizeStatus(value: unknown): StickerStatus {
  return value === 'approved' || value === 'hidden' || value === 'inbox' ? value : 'inbox';
}

function normalizeMeta(file: string, raw: unknown, fallbackRepo: string): StickerMeta | undefined {
  if (raw === null || typeof raw !== 'object') return undefined;
  const item = raw as Partial<StickerMeta>;
  const repoId = typeof item.repoId === 'string' && item.repoId.trim() !== '' ? item.repoId : fallbackRepo;
  return {
    file,
    repoId,
    addedAt: typeof item.addedAt === 'number' ? item.addedAt : now(),
    tags: Array.isArray(item.tags) ? item.tags.filter((t): t is string => typeof t === 'string').slice(0, 8) : ['未分类'],
    description: typeof item.description === 'string' && item.description.trim() !== '' ? item.description.trim() : '未分类',
    used: typeof item.used === 'number' ? Math.max(0, Math.round(item.used)) : 0,
    ...(typeof item.lastUsedAt === 'number' ? { lastUsedAt: item.lastUsedAt } : {}),
    status: normalizeStatus(item.status),
    ...(typeof item.sha1 === 'string' ? { sha1: item.sha1 } : {}),
    ...(typeof item.width === 'number' ? { width: item.width } : {}),
    ...(typeof item.height === 'number' ? { height: item.height } : {}),
    ...(typeof item.bytes === 'number' ? { bytes: item.bytes } : {}),
    ...(typeof item.mime === 'string' ? { mime: item.mime } : {}),
    ...(typeof item.sourceGroup === 'string' ? { sourceGroup: item.sourceGroup } : {}),
    ...(typeof item.sourceUser === 'string' ? { sourceUser: item.sourceUser } : {}),
    ...(item.pinned === true ? { pinned: true } : {}),
  };
}

function ensureRepoDirs(root: string, repos: StickerRepo[]): void {
  mkdirSync(stickersDir(root), { recursive: true });
  for (const repo of repos) mkdirSync(repoDir(root, repo.id), { recursive: true });
}

function hashFile(path: string): string | undefined {
  try {
    return createHash('sha1').update(readFileSync(path)).digest('hex').slice(0, 16);
  } catch {
    return undefined;
  }
}

function moveFile(src: string, dest: string): boolean {
  if (src === dest) return true;
  try {
    mkdirSync(join(dest, '..'), { recursive: true });
    renameSync(src, dest);
    return true;
  } catch {
    try {
      mkdirSync(join(dest, '..'), { recursive: true });
      copyFileSync(src, dest);
      unlinkSync(src);
      return true;
    } catch {
      return false;
    }
  }
}

function writeState(root: string, state: StickerState): void {
  mkdirSync(root, { recursive: true });
  const path = statePath(root);
  const tmp = `${path}.tmp`;
  writeFileSync(tmp, `${JSON.stringify(state, null, 2)}\n`, 'utf8');
  renameSync(tmp, path);
}

function readJson(path: string): unknown {
  try {
    return JSON.parse(readFileSync(path, 'utf8').replace(/^\uFEFF/, '')) as unknown;
  } catch {
    return undefined;
  }
}

function backupState(root: string): void {
  const path = statePath(root);
  if (!existsSync(path)) return;
  try {
    copyFileSync(path, `${path}.bak-${Date.now()}`);
  } catch {
    /* 备份失败不阻塞迁移 */
  }
}

/** 旧版平铺文件 + stickers.json → v2 仓库 */
function migrateLegacy(root: string, raw: unknown): StickerState {
  backupState(root);
  const state = defaultState();
  const legacy = raw !== null && typeof raw === 'object' ? (raw as { items?: unknown }).items : undefined;
  const legacyItems = legacy !== null && typeof legacy === 'object' ? (legacy as Record<string, unknown>) : {};
  const dir = stickersDir(root);
  let files: string[] = [];
  try {
    files = readdirSync(dir).filter((file) => IMAGE_EXT.has(extname(file).toLowerCase()));
  } catch {
    files = [];
  }
  for (const file of files) {
    const src = join(dir, file);
    const dest = join(repoDir(root, 'common'), file);
    if (!moveFile(src, dest)) continue;
    // 旧版有个改名 bug：文件已经改名，metadata 还挂在旧文件名上。
    // 用文件名末尾的 8 位 hash 找回描述，避免迁移后全部变成「未分类」。
    const suffix = basename(file, extname(file)).slice(-8);
    const old =
      legacyItems[file] ??
      Object.entries(legacyItems).find(([key]) => basename(key, extname(key)).slice(-8) === suffix)?.[1];
    const meta = normalizeMeta(file, old, 'common');
    state.items[file] = {
      ...(meta ?? {
        file,
        repoId: 'common',
        addedAt: now(),
        tags: ['未分类'],
        description: '未分类',
        used: 0,
        status: 'approved' as const,
      }),
      repoId: 'common',
      status: 'approved',
      ...(hashFile(dest) === undefined ? {} : { sha1: hashFile(dest) }),
      bytes: (() => {
        try {
          return statSync(dest).size;
        } catch {
          return undefined;
        }
      })(),
    };
  }
  // 旧 JSON 里有、文件已不在的条目直接丢弃
  ensureRepoDirs(root, state.repos);
  writeState(root, state);
  return state;
}

/** 读取/迁移状态；所有入口都调用它，保证目录存在 */
export function loadStickerState(root: string): StickerState {
  mkdirSync(stickersDir(root), { recursive: true });
  const raw = readJson(statePath(root));
  if (raw !== null && typeof raw === 'object' && (raw as { version?: unknown }).version === 2) {
    const src = raw as { repos?: unknown; items?: unknown };
    const repos: StickerRepo[] = Array.isArray(src.repos)
      ? src.repos.map(normalizeRepo).filter((repo): repo is StickerRepo => repo !== undefined)
      : [];
    if (repos.length === 0) repos.push(...defaultState().repos);
    const unique = new Map<string, StickerRepo>();
    for (const repo of repos) if (!unique.has(repo.id)) unique.set(repo.id, repo);
    const repoList = [...unique.values()];
    if (!repoList.some((repo) => repo.saveTarget)) repoList[0]!.saveTarget = true;
    const items: Record<string, StickerMeta> = {};
    if (src.items !== null && typeof src.items === 'object') {
      for (const [file, value] of Object.entries(src.items as Record<string, unknown>)) {
        if (!IMAGE_EXT.has(extname(file).toLowerCase())) continue;
        const meta = normalizeMeta(file, value, repoList[0]!.id);
        if (meta !== undefined) items[file] = meta;
      }
    }
    ensureRepoDirs(root, repoList);
    const state: StickerState = { version: 2, repos: repoList, items };
    adoptOrphanFiles(root, state);
    return state;
  }
  const state = migrateLegacy(root, raw);
  adoptOrphanFiles(root, state);
  return state;
}

/** 接收手工放进任意仓库目录（或旧版 stickers/ 根目录）的图片 */
function adoptOrphanFiles(root: string, state: StickerState): void {
  let changed = false;
  for (const repo of state.repos) {
    const dir = repoDir(root, repo.id);
    mkdirSync(dir, { recursive: true });
    let files: string[] = [];
    try {
      files = readdirSync(dir).filter((file) => IMAGE_EXT.has(extname(file).toLowerCase()));
    } catch {
      continue;
    }
    for (const file of files) {
      if (state.items[file] !== undefined) continue;
      const path = join(dir, file);
      state.items[file] = {
        file,
        repoId: repo.id,
        addedAt: now(),
        tags: ['未分类'],
        description: '未分类',
        used: 0,
        status: repo.id === 'inbox' ? 'inbox' : 'approved',
        ...(hashFile(path) === undefined ? {} : { sha1: hashFile(path) }),
        bytes: (() => {
          try {
            return statSync(path).size;
          } catch {
            return undefined;
          }
        })(),
      };
      changed = true;
    }
  }
  // 旧版根目录里的图收进 common
  const rootDir = stickersDir(root);
  let rootFiles: string[] = [];
  try {
    rootFiles = readdirSync(rootDir).filter((file) => IMAGE_EXT.has(extname(file).toLowerCase()));
  } catch {
    rootFiles = [];
  }
  const target = state.repos.find((repo) => repo.id === 'common') ?? state.repos[0]!;
  mkdirSync(repoDir(root, target.id), { recursive: true });
  for (const file of rootFiles) {
    if (state.items[file] !== undefined) continue;
    if (!moveFile(join(rootDir, file), join(repoDir(root, target.id), file))) continue;
    state.items[file] = {
      file,
      repoId: target.id,
      addedAt: now(),
      tags: ['未分类'],
      description: '未分类',
      used: 0,
      status: 'approved',
      ...(hashFile(join(repoDir(root, target.id), file)) === undefined
        ? {}
        : { sha1: hashFile(join(repoDir(root, target.id), file)) }),
      bytes: (() => {
        try {
          return statSync(join(repoDir(root, target.id), file)).size;
        } catch {
          return undefined;
        }
      })(),
    };
    changed = true;
  }
  if (changed) writeState(root, state);
}

function pathOf(root: string, repoId: string, file: string): string {
  return join(repoDir(root, repoId), basename(file));
}

function existingPath(root: string, meta: StickerMeta): string | undefined {
  const path = pathOf(root, meta.repoId, meta.file);
  if (existsSync(path)) return path;
  const legacy = join(stickersDir(root), meta.file);
  return existsSync(legacy) ? legacy : undefined;
}

export function listStickerRepos(root: string): StickerRepo[] {
  return loadStickerState(root).repos;
}

export function listStickerInfo(root: string): StickerInfo[] {
  const state = loadStickerState(root);
  const out: StickerInfo[] = [];
  for (const [file, meta] of Object.entries(state.items)) {
    const path = existingPath(root, meta);
    if (path === undefined) continue;
    const repo = state.repos.find((item) => item.id === meta.repoId);
    if (repo === undefined) continue;
    let bytes = meta.bytes;
    try {
      bytes = statSync(path).size;
    } catch {
      /* ignore */
    }
    out.push({
      file,
      tags: meta.tags,
      description: meta.description,
      ...(meta.width === undefined ? {} : { width: meta.width }),
      ...(meta.height === undefined ? {} : { height: meta.height }),
      ...(bytes === undefined ? {} : { bytes }),
      repoId: repo.id,
      repoName: repo.name,
      repoWeight: repo.weight,
      status: meta.status,
      addedAt: meta.addedAt,
      used: meta.used,
    });
  }
  return out.sort((a, b) => (b.addedAt ?? 0) - (a.addedAt ?? 0));
}

export function stickerFolder(root: string): string {
  return stickersDir(root);
}

export function stickerFile(root: string, file: string): string | undefined {
  const state = loadStickerState(root);
  const meta = state.items[basename(file)];
  if (meta === undefined) return undefined;
  return existingPath(root, meta);
}

/** 读图片头：尺寸 + 透明通道（不依赖 native 库） */
export function imageInfo(bytes: Uint8Array): { width?: number; height?: number; hasAlpha?: boolean } {
  const b = bytes;
  const view = new DataView(b.buffer, b.byteOffset, b.byteLength);
  // PNG
  if (b.length >= 33 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) {
    return {
      width: view.getUint32(16),
      height: view.getUint32(20),
      hasAlpha: b[25] === 4 || b[25] === 6,
    };
  }
  // GIF
  if (b.length >= 10 && b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46) {
    return { width: view.getUint16(6, true), height: view.getUint16(8, true), hasAlpha: true };
  }
  // JPEG
  if (b.length >= 4 && b[0] === 0xff && b[1] === 0xd8) {
    let i = 2;
    while (i + 9 < b.length) {
      if (b[i] !== 0xff) {
        i += 1;
        continue;
      }
      const marker = b[i + 1]!;
      if (marker === 0xd8 || marker === 0xd9 || (marker >= 0xd0 && marker <= 0xd7)) {
        i += 2;
        continue;
      }
      const len = view.getUint16(i + 2);
      if (len < 2) break;
      if (
        (marker >= 0xc0 && marker <= 0xc3) ||
        (marker >= 0xc5 && marker <= 0xc7) ||
        (marker >= 0xc9 && marker <= 0xcb) ||
        (marker >= 0xcd && marker <= 0xcf)
      ) {
        return { height: view.getUint16(i + 5), width: view.getUint16(i + 7), hasAlpha: false };
      }
      i += 2 + len;
    }
    return { hasAlpha: false };
  }
  // WebP
  if (b.length >= 30 && b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46) {
    const kind = String.fromCharCode(b[12]!, b[13]!, b[14]!, b[15]!);
    if (kind === 'VP8X') {
      return {
        width: 1 + (b[24]! | (b[25]! << 8) | (b[26]! << 16)),
        height: 1 + (b[27]! | (b[28]! << 8) | (b[29]! << 16)),
        hasAlpha: (b[20]! & 0x10) !== 0,
      };
    }
    if (kind === 'VP8 ') {
      return {
        width: view.getUint16(26, true) & 0x3fff,
        height: view.getUint16(28, true) & 0x3fff,
        hasAlpha: false,
      };
    }
    if (kind === 'VP8L' && b.length >= 25) {
      const bits = b[21]! | (b[22]! << 8) | (b[23]! << 16) | (b[24]! << 24);
      return {
        width: (bits & 0x3fff) + 1,
        height: ((bits >> 14) & 0x3fff) + 1,
        hasAlpha: ((bits >> 28) & 1) === 1,
      };
    }
  }
  return {};
}

function smartAllowed(info: { width?: number; height?: number; hasAlpha?: boolean }, bytes: number, mime: string): boolean {
  if (mime === 'image/gif' || mime === 'image/webp') return true;
  const { width, height } = info;
  if (width === undefined || height === undefined) return bytes <= 1_200_000;
  if (width < 48 || height < 48 || width > 1600 || height > 1600) return false;
  const aspect = width / height;
  if (aspect < 0.35 || aspect > 2.8) return false;
  const pixels = width * height;
  if (pixels > 2_000_000) return false;
  if (info.hasAlpha !== true) {
    if (bytes > 1_200_000) return false;
    if (pixels > 1_200_000) return false;
  }
  return true;
}

function extensionOf(mime: string): string {
  if (mime.includes('gif')) return '.gif';
  if (mime.includes('webp')) return '.webp';
  if (mime.includes('png')) return '.png';
  return '.jpg';
}

function mediaTypeOf(mime: string): string {
  return mime.split(';')[0]!.trim().toLowerCase();
}

function trimRepo(root: string, state: StickerState, repo: StickerRepo, fallbackMax: number, fallbackMB: number): void {
  const items = Object.values(state.items)
    .filter((item) => item.repoId === repo.id)
    .map((item) => ({ item, path: existingPath(root, item) }))
    .filter((entry): entry is { item: StickerMeta; path: string } => entry.path !== undefined);
  const maxItems = repo.maxItems > 0 ? repo.maxItems : fallbackMax;
  const maxBytes = (repo.maxMB > 0 ? repo.maxMB : fallbackMB) * 1024 * 1024;
  let total = items.reduce((sum, entry) => sum + statSync(entry.path).size, 0);
  if (items.length <= maxItems && total <= maxBytes) return;
  const sorted = items
    .filter((entry) => entry.item.pinned !== true)
    .sort((a, b) => a.item.used - b.item.used || a.item.addedAt - b.item.addedAt);
  let count = items.length;
  for (const entry of sorted) {
    if (count <= maxItems && total <= maxBytes) break;
    let size = 0;
    try {
      size = statSync(entry.path).size;
      unlinkSync(entry.path);
    } catch {
      continue;
    }
    total -= size;
    delete state.items[entry.item.file];
    count -= 1;
  }
}

export function updateStickerRepos(root: string, raw: unknown): StickerRepo[] {
  const state = loadStickerState(root);
  const input = Array.isArray(raw) ? raw : [];
  const next: StickerRepo[] = [];
  const seen = new Set<string>();
  for (const value of input) {
    const repo = normalizeRepo(value);
    if (repo === undefined || seen.has(repo.id)) continue;
    seen.add(repo.id);
    next.push(repo);
  }
  if (next.length === 0) throw new Error('至少保留一个表情包仓库');
  if (!next.some((repo) => repo.saveTarget)) next[0]!.saveTarget = true;
  let targets = 0;
  for (const repo of next) {
    if (repo.saveTarget) targets += 1;
    if (targets > 1) repo.saveTarget = false;
  }
  const removed = state.repos.filter((old) => !next.some((repo) => repo.id === old.id));
  const fallback = next.find((repo) => !removed.some((old) => old.id === repo.id)) ?? next[0]!;
  for (const old of removed) {
    mkdirSync(repoDir(root, fallback.id), { recursive: true });
    for (const meta of Object.values(state.items)) {
      if (meta.repoId !== old.id) continue;
      const src = existingPath(root, meta);
      if (src !== undefined) moveFile(src, join(repoDir(root, fallback.id), meta.file));
      meta.repoId = fallback.id;
    }
  }
  state.repos = next;
  ensureRepoDirs(root, next);
  writeState(root, state);
  for (const repo of next) trimRepo(root, state, repo, 0, 0);
  writeState(root, state);
  return next;
}

export function moveStickers(root: string, files: string[], repoId: string): number {
  const state = loadStickerState(root);
  const repo = state.repos.find((item) => item.id === repoId);
  if (repo === undefined) throw new Error('仓库不存在');
  mkdirSync(repoDir(root, repo.id), { recursive: true });
  let moved = 0;
  for (const raw of files) {
    const file = basename(raw);
    const meta = state.items[file];
    if (meta === undefined) continue;
    const src = existingPath(root, meta);
    if (src === undefined) continue;
    const dest = join(repoDir(root, repo.id), file);
    if (!moveFile(src, dest)) continue;
    meta.repoId = repo.id;
    meta.status = repo.id === 'inbox' ? 'inbox' : 'approved';
    moved += 1;
  }
  writeState(root, state);
  return moved;
}

export function deleteStickers(root: string, files: string[]): number {
  const state = loadStickerState(root);
  let deleted = 0;
  for (const raw of files) {
    const file = basename(raw);
    const meta = state.items[file];
    if (meta === undefined) continue;
    const path = existingPath(root, meta);
    if (path !== undefined) {
      try {
        unlinkSync(path);
        deleted += 1;
      } catch {
        continue;
      }
    }
    delete state.items[file];
  }
  writeState(root, state);
  return deleted;
}

/** 手动整理：改含义/标签，含义不再是未分类就视为可用 */
export function updateStickerMeta(
  root: string,
  file: string,
  patch: { description?: string; tags?: string[] },
): StickerMeta | undefined {
  const state = loadStickerState(root);
  const key = basename(file);
  const meta = state.items[key];
  if (meta === undefined) return undefined;
  if (patch.description !== undefined) {
    const description = patch.description.trim().slice(0, 160);
    meta.description = description === '' ? '未分类' : description;
    meta.status = meta.description === '未分类' ? 'inbox' : 'approved';
  }
  if (Array.isArray(patch.tags)) {
    meta.tags = patch.tags.filter((tag) => typeof tag === 'string' && tag.trim() !== '').slice(0, 8);
  }
  writeState(root, state);
  return meta;
}

export interface StickerHubOptions {
  saveEnabled: () => boolean;
  filter: () => StickerFilterMode;
  saveRepo: () => string;
  analyzeOnSave: () => boolean;
  maxItems: () => number;
  maxMB: () => number;
  analyze: (context: StickerSaveContext) => Promise<{ tags: string[]; description: string } | undefined>;
  log: (message: string) => void;
}

export function createStickerHub(root: string, options: StickerHubOptions): StickerHub {
  let lastSelected: string | undefined;
  const selectSticker = (preferred?: string): string | undefined => {
      const state = loadStickerState(root);
      const candidates = Object.values(state.items)
        .map((item) => ({ item, repo: state.repos.find((repo) => repo.id === item.repoId) }))
        .filter(
          (entry): entry is { item: StickerMeta; repo: StickerRepo } =>
            entry.repo !== undefined &&
            entry.repo.enabled &&
            entry.repo.weight > 0 &&
            entry.item.status !== 'hidden' &&
            entry.item.description !== '未分类' &&
            existingPath(root, entry.item) !== undefined,
        );
      if (candidates.length === 0) return undefined;
      const repos = [...new Map(candidates.map((entry) => [entry.repo.id, entry.repo])).values()];
      const totalWeight = repos.reduce((sum, repo) => sum + repo.weight, 0);
      let roll = Math.random() * totalWeight;
      let chosen = repos[repos.length - 1]!;
      for (const repo of repos) {
        roll -= repo.weight;
        if (roll <= 0) {
          chosen = repo;
          break;
        }
      }
      const pool = candidates.filter((entry) => entry.repo.id === chosen.id);
      const preferredEntry = preferred === undefined ? undefined : pool.find((entry) => entry.item.file === basename(preferred));
      const pick = preferredEntry ?? pool[Math.floor(Math.random() * pool.length)]!;
      const path = existingPath(root, pick.item);
      if (path === undefined) return undefined;
      if (lastSelected !== undefined && pool.length > 1 && pick.item.file === lastSelected) {
        const other = pool.find((entry) => entry.item.file !== lastSelected);
        if (other !== undefined) {
          lastSelected = other.item.file;
          return existingPath(root, other.item);
        }
      }
      lastSelected = pick.item.file;
      return path;
  };
  return {
    list: () => listStickerInfo(root),
    select: selectSticker,
    resolve: (stickerName) => {
      const state = loadStickerState(root);
      const meta = state.items[basename(stickerName)];
      if (meta === undefined) return undefined;
      const repo = state.repos.find((item) => item.id === meta.repoId);
      if (repo === undefined || repo.weight <= 0 || meta.status === 'hidden') {
        return selectSticker(stickerName);
      }
      return existingPath(root, meta);
    },
    markUsed: (stickerName) => {
      try {
        const state = loadStickerState(root);
        const meta = state.items[basename(stickerName)];
        if (meta === undefined) return;
        meta.used += 1;
        meta.lastUsedAt = now();
        writeState(root, state);
      } catch {
        /* ignore */
      }
    },
    async save(seg: ObSegment, context?: StickerSaveContext): Promise<void> {
      if (!options.saveEnabled()) return;
      const url =
        typeof seg.data?.url === 'string' ? seg.data.url : typeof seg.data?.file === 'string' ? seg.data.file : '';
      if (!/^https?:\/\//i.test(url)) return;
      try {
        const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
        if (!res.ok) return;
        const mime = mediaTypeOf(res.headers.get('content-type') ?? '');
        if (!mime.startsWith('image/')) return;
        const bytes = new Uint8Array(await res.arrayBuffer());
        if (bytes.byteLength === 0 || bytes.byteLength > MAX_IMAGE_BYTES) return;
        const info = imageInfo(bytes);
        if (options.filter() === 'smart' && !smartAllowed(info, bytes.byteLength, mime)) return;
        const hash = createHash('sha1').update(bytes).digest('hex').slice(0, 16);
        const state = loadStickerState(root);
        if (Object.values(state.items).some((item) => item.sha1 === hash)) return;
        const repo =
          state.repos.find((item) => item.id === options.saveRepo()) ??
          state.repos.find((item) => item.saveTarget) ??
          state.repos.find((item) => item.id === 'inbox') ??
          state.repos[0]!;
        mkdirSync(repoDir(root, repo.id), { recursive: true });
        const ext = extensionOf(mime);
        const file = `${hash}${ext}`;
        if (existsSync(join(repoDir(root, repo.id), file))) return;
        writeFileSync(join(repoDir(root, repo.id), file), bytes);
        state.items[file] = {
          file,
          repoId: repo.id,
          addedAt: now(),
          tags: ['未分类'],
          description: '未分类',
          used: 0,
          status: repo.id === 'inbox' ? 'inbox' : 'approved',
          sha1: hash,
          ...(info.width === undefined ? {} : { width: info.width }),
          ...(info.height === undefined ? {} : { height: info.height }),
          bytes: bytes.byteLength,
          mime,
          ...(context?.groupId === undefined ? {} : { sourceGroup: context.groupId }),
          ...(context?.sender === undefined ? {} : { sourceUser: context.sender.slice(0, 40) }),
        };
        trimRepo(root, state, repo, options.maxItems(), options.maxMB());
        writeState(root, state);
        options.log(`收藏表情包：${repo.name}/${file}`);

        if (options.analyzeOnSave() && context !== undefined) {
          const guess = await options.analyze(context).catch(() => undefined);
          if (guess !== undefined && guess.description.trim() !== '' && guess.description !== '未分类') {
            const current = loadStickerState(root);
            const meta = current.items[file];
            if (meta !== undefined) {
              const stamp = new Date();
              const slug = guess.tags
                .map((tag) => tag.replace(/[\\/:*?"<>|\s]+/g, '').slice(0, 10))
                .filter((tag) => tag !== '')
                .slice(0, 3)
                .join('-');
              const renamed = `${stamp.getFullYear()}${String(stamp.getMonth() + 1).padStart(2, '0')}${String(stamp.getDate()).padStart(2, '0')}-${slug || 'sticker'}-${hash}${ext}`;
              const oldPath = join(repoDir(root, repo.id), file);
              const newPath = join(repoDir(root, repo.id), renamed);
              if (moveFile(oldPath, newPath)) {
                meta.file = renamed;
                meta.tags = guess.tags.slice(0, 8);
                meta.description = guess.description.trim();
                delete current.items[file];
                current.items[renamed] = meta;
                writeState(root, current);
                options.log(`表情包已识别：${renamed}`);
              }
            }
          }
        }
      } catch (e) {
        options.log(`收藏图片失败：${e instanceof Error ? e.message : String(e)}`);
      }
    },
  };
}
