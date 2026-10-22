import assert from 'node:assert/strict';
import {
  emptyMemoryStore,
  rememberMemory,
  recallMemories,
  formatMemories,
  migrateLegacyMemories,
  memoryStats,
  updateMemory,
  deleteMemory,
} from '../src/qq/memory-v3.ts';

const day = 24 * 60 * 60 * 1000;
const now = Date.parse('2026-10-22T12:00:00+08:00');

// 1. 稳定事实/事件：事实不衰减，事件会衰减
{
  const store = emptyMemoryStore();
  rememberMemory(store, 'g', { text: '主人喜欢猫', category: 'stable_profile', importance: 0.9 }, { now });
  rememberMemory(store, 'g', { text: '今天群里聊到了猫粮', category: 'event', importance: 0.5 }, { now: now - 60 * day });
  const hit = recallMemories(store, 'g', '猫 猫粮', { now, threshold: 0.2 });
  assert.ok(hit.selected.some((item) => item.text.includes('猫粮')), '旧事件仍应能按证据召回');
  assert.ok(hit.selected.some((item) => item.text.includes('主人喜欢猫')), '稳定事实应召回');
}

// 2. 「在吗」不翻记忆
{
  const store = emptyMemoryStore();
  rememberMemory(store, 'g', { text: '主人喜欢猫', category: 'stable_profile' }, { now });
  const hit = recallMemories(store, 'g', '在吗', { now });
  assert.equal(hit.selected.length, 0);
}

// 3. factKey 取代旧条
{
  const store = emptyMemoryStore();
  const first = rememberMemory(store, 'g', { text: '主人身高 170', category: 'stable_profile', factKey: 'owner.身高' }, { now });
  const second = rememberMemory(store, 'g', { text: '主人身高 171', category: 'stable_profile', factKey: 'owner.身高' }, { now: now + day });
  assert.ok(first.item && second.item);
  const items = store.groups.g.items;
  assert.equal(items.find((item) => item.id === first.item.id).supersededBy, second.item.id);
  const hit = recallMemories(store, 'g', '身高', { now: now + day });
  assert.ok(hit.selected.every((item) => item.text.includes('171')), '只召回最新身高');
}

// 4. 每日写入配额
{
  const store = emptyMemoryStore();
  for (let i = 0; i < 3; i += 1) {
    assert.equal(rememberMemory(store, 'g', { text: `事件 ${i}` }, { now, dailyQuota: 2 }).ok, i < 2);
  }
}

// 5. 注入条数/字数上限
{
  const store = emptyMemoryStore();
  for (let i = 0; i < 10; i += 1) {
    rememberMemory(store, 'g', { text: `猫猫事件 ${i} ${'很长的记忆'.repeat(20)}`, importance: 0.9 }, { now });
  }
  const hit = recallMemories(store, 'g', '猫猫', { now, maxItems: 3, maxChars: 120 });
  assert.ok(hit.selected.length <= 3);
  assert.ok(hit.chars <= 120);
}

// 6. 旧 keyMemories 迁移
{
  const store = emptyMemoryStore();
  const added = migrateLegacyMemories(
    store,
    'g',
    [{ text: '主人喜欢猫', kind: 'preference', confidence: 0.9 }],
    '以前聊过猫粮',
    now,
  );
  assert.equal(added, 2);
  assert.equal(memoryStats(store, 'g').active, 2);
  assert.ok(formatMemories(store.groups.g.items, now).includes('长期'));
}

// 7. 编辑/删除
{
  const store = emptyMemoryStore();
  const saved = rememberMemory(store, 'g', { text: '旧记忆', category: 'stable_profile' }, { now });
  assert.ok(saved.item);
  updateMemory(store, 'g', saved.item.id, { text: '新记忆', importance: 0.9 }, now + 1);
  assert.equal(store.groups.g.items[0].text, '新记忆');
  assert.equal(deleteMemory(store, 'g', saved.item.id, now + 2), true);
  assert.equal(store.groups.g.items.length, 0);
}

console.log('memory-v3: all assertions passed');
