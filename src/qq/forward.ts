/**
 * 合并转发读取：OneBot get_forward_msg → 紧凑文本。
 * 只展开一层；嵌套转发显示占位，避免递归和 token 爆炸。
 */
import type { OneBotClient } from './onebot';
import type { ObSegment } from './types';

export interface ForwardResult {
  text: string;
  nodes: number;
  truncated: boolean;
}

function nodeText(message: unknown): string {
  if (typeof message === 'string') return message.replace(/\[CQ:[^\]]*\]/g, '').trim();
  if (!Array.isArray(message)) return '';
  const parts: string[] = [];
  for (const seg of message as ObSegment[]) {
    if (seg === null || typeof seg !== 'object') continue;
    switch (seg.type) {
      case 'text':
        parts.push(typeof seg.data.text === 'string' ? seg.data.text : '');
        break;
      case 'at':
        parts.push(`@${typeof seg.data.qq === 'string' ? seg.data.qq : ''} `);
        break;
      case 'image':
        parts.push('[图片]');
        break;
      case 'file':
        parts.push(`[文件${typeof seg.data.name === 'string' ? `：${seg.data.name}` : ''}]`);
        break;
      case 'forward':
        parts.push('[嵌套转发]');
        break;
      case 'face':
        parts.push('[表情]');
        break;
      case 'record':
        parts.push('[语音]');
        break;
      default:
        break;
    }
  }
  return parts.join('').trim();
}

export async function readForward(
  client: OneBotClient,
  seg: ObSegment,
  maxNodes: number,
  maxChars: number,
): Promise<ForwardResult> {
  const rawId = seg.data?.id ?? seg.data?.forward_id;
  const id = typeof rawId === 'string' ? rawId : typeof rawId === 'number' ? String(rawId) : '';
  if (id === '') throw new Error('转发段没有 id');
  const response = await client.call('get_forward_msg', { id });
  if (response.status !== 'ok') throw new Error(response.message || 'get_forward_msg 失败');
  const data = response.data as
    | { messages?: unknown[]; nodes?: unknown[]; message?: unknown[] }
    | undefined;
  const rawNodes = Array.isArray(data?.messages)
    ? data!.messages
    : Array.isArray(data?.nodes)
      ? data!.nodes
      : Array.isArray(data?.message)
        ? data!.message
        : [];
  const lines: string[] = [];
  let chars = 0;
  let truncated = false;
  let count = 0;
  for (const raw of rawNodes) {
    if (count >= maxNodes) {
      truncated = true;
      break;
    }
    const node = raw as {
      sender?: { nickname?: unknown; card?: unknown; user_id?: unknown };
      time?: unknown;
      message?: unknown;
      content?: unknown;
    };
    const nameRaw = node.sender?.card ?? node.sender?.nickname ?? node.sender?.user_id ?? '群友';
    const name = typeof nameRaw === 'string' && nameRaw.trim() !== '' ? nameRaw.trim().slice(0, 30) : '群友';
    const body = nodeText(node.message ?? node.content);
    if (body === '') continue;
    const line = `${name}：${body.replace(/\s+/g, ' ').trim()}`;
    if (chars + line.length + 1 > maxChars) {
      truncated = true;
      break;
    }
    lines.push(line);
    chars += line.length + 1;
    count += 1;
  }
  if (lines.length === 0) throw new Error('转发记录为空');
  return { text: lines.join('\n'), nodes: count, truncated };
}
