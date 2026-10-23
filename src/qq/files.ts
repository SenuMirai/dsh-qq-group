/**
 * 群文件读取：下载后的字节 → 可放入上下文的文本。
 * 支持 txt/md/json/csv/代码/pdf/docx/xlsx；解析失败会抛出可读错误。
 */
import { unzipSync } from 'fflate';
import { TextDecoder } from 'node:util';
import * as XLSX from 'xlsx';

export type FileKind = 'text' | 'pdf' | 'docx' | 'xlsx';

export interface ExtractedFile {
  text: string;
  kind: FileKind;
  bytes: number;
  truncated: boolean;
}

const TEXT_EXT = new Set([
  '.txt',
  '.md',
  '.markdown',
  '.json',
  '.jsonc',
  '.csv',
  '.tsv',
  '.log',
  '.yaml',
  '.yml',
  '.xml',
  '.html',
  '.htm',
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.mjs',
  '.cjs',
  '.py',
  '.java',
  '.c',
  '.h',
  '.cpp',
  '.hpp',
  '.go',
  '.rs',
  '.sql',
  '.sh',
  '.ps1',
]);

export const MAX_FILE_EXT = [
  'txt',
  'md',
  'markdown',
  'json',
  'jsonc',
  'csv',
  'tsv',
  'log',
  'yaml',
  'yml',
  'xml',
  'html',
  'htm',
  'ts',
  'tsx',
  'js',
  'jsx',
  'mjs',
  'cjs',
  'py',
  'java',
  'c',
  'h',
  'cpp',
  'hpp',
  'go',
  'rs',
  'sql',
  'sh',
  'ps1',
  'pdf',
  'docx',
  'xlsx',
];

function extensionOf(name: string): string {
  const i = name.lastIndexOf('.');
  return i < 0 ? '' : name.slice(i).toLowerCase();
}

function decodeText(bytes: Uint8Array): string {
  // BOM 优先
  if (bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    return new TextDecoder('utf-8').decode(bytes.subarray(3)).replace(/\r\n?/g, '\n');
  }
  if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe) {
    return new TextDecoder('utf-16le').decode(bytes.subarray(2)).replace(/\r\n?/g, '\n');
  }
  if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) {
    return new TextDecoder('utf-16be').decode(bytes.subarray(2)).replace(/\r\n?/g, '\n');
  }

  // 先按严格 UTF-8；失败再按 GB18030（中文 Windows 的 txt/csv 常见）。
  let text = '';
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    try {
      text = new TextDecoder('gb18030').decode(bytes);
    } catch {
      text = new TextDecoder('utf-8').decode(bytes);
    }
  }
  // UTF-8 解码成功但出现大量替换符/控制符，通常是 GBK 被误读。
  const bad = (text.match(/\uFFFD/g) ?? []).length;
  if (bad > 0 && bad > text.length / 100) {
    try {
      text = new TextDecoder('gb18030').decode(bytes);
    } catch {
      /* 保留 UTF-8 结果 */
    }
  }
  // 含大量 NUL 的通常是二进制；不要让模型读乱码
  const nul = text.slice(0, 4096).split('\u0000').length - 1;
  if (nul > 4) throw new Error('这个文件看起来是二进制格式，暂不支持');
  return text.replace(/\r\n?/g, '\n');
}

function decodeEntities(input: string): string {
  return input
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_m, n: string) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_m, n: string) => String.fromCodePoint(Number.parseInt(n, 16)));
}

function capText(text: string, maxChars: number): { text: string; truncated: boolean } {
  const normalized = text.replace(/\u0000/g, '').trim();
  if (normalized.length <= maxChars) return { text: normalized, truncated: false };
  return { text: normalized.slice(0, maxChars), truncated: true };
}

async function readPdf(bytes: Uint8Array): Promise<string> {
  // pdfjs 的 legacy build 在 Node 里可直接做文本层提取，不渲染画布
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const doc = await pdfjs.getDocument({
    data: bytes,
    useWorkerFetch: false,
    isEvalSupported: false,
    disableFontFace: true,
    useSystemFonts: false,
  }).promise;
  const parts: string[] = [];
  const pages = Math.min(doc.numPages, 80);
  for (let pageNo = 1; pageNo <= pages; pageNo += 1) {
    const page = await doc.getPage(pageNo);
    const content = await page.getTextContent();
    const pageText = content.items
      .map((item) => ('str' in item ? item.str : ''))
      .join(' ')
      .trim();
    if (pageText !== '') parts.push(`--- 第 ${pageNo} 页 ---\n${pageText}`);
  }
  await doc.destroy();
  return parts.join('\n');
}

function readDocx(bytes: Uint8Array): string {
  const zip = unzipSync(bytes);
  const xml = zip['word/document.xml'];
  if (xml === undefined) throw new Error('DOCX 里没有 word/document.xml');
  const raw = strFromU8(xml);
  return decodeEntities(
    raw
      .replace(/<w:tab[^>]*\/>/g, '\t')
      .replace(/<\/w:p>/g, '\n')
      .replace(/<w:br[^>]*\/>/g, '\n')
      .replace(/<[^>]+>/g, ''),
  );
}

function readXlsx(bytes: Uint8Array): string {
  const workbook = XLSX.read(bytes, { type: 'array', sheetRows: 200 });
  const parts: string[] = [];
  for (const name of workbook.SheetNames) {
    const sheet = workbook.Sheets[name];
    if (sheet === undefined) continue;
    const csv = XLSX.utils.sheet_to_csv(sheet, { blankrows: false });
    parts.push(`--- 工作表：${name} ---\n${csv}`);
  }
  return parts.join('\n\n');
}

/** 按扩展名提取文本；maxChars 限制最终交给模型的字符数 */
export async function extractFileText(
  bytes: Uint8Array,
  name: string,
  maxChars: number,
): Promise<ExtractedFile> {
  const inputBytes = bytes.byteLength;
  const ext = extensionOf(name);
  const kind: FileKind | undefined =
    ext === '.pdf' ? 'pdf' : ext === '.docx' ? 'docx' : ext === '.xlsx' ? 'xlsx' : TEXT_EXT.has(ext) ? 'text' : undefined;
  if (kind === undefined) throw new Error(`暂不支持 ${ext || '无扩展名'} 文件`);
  let raw: string;
  if (kind === 'pdf') raw = await readPdf(bytes);
  else if (kind === 'docx') raw = readDocx(bytes);
  else if (kind === 'xlsx') raw = readXlsx(bytes);
  else raw = decodeText(bytes);
  const capped = capText(raw, Math.max(1000, maxChars));
  if (capped.text === '') throw new Error('文件里没有提取到可读文字');
  return { text: capped.text, kind, bytes: inputBytes, truncated: capped.truncated };
}

export function isSupportedFile(name: string): boolean {
  const ext = extensionOf(name).replace(/^\./, '');
  return MAX_FILE_EXT.includes(ext);
}
