import assert from 'node:assert/strict';
import {
  applyMoodJudgement,
  decayMood,
  emptyMoodStore,
  groupMood,
  markMoodInjected,
  moodInjection,
  resetMood,
} from '../src/qq/mood.ts';

const now = Date.parse('2026-10-22T12:00:00+08:00');
const store = emptyMoodStore();
const a = groupMood(store, 'g1', { baseline: 70 }, now);
const b = groupMood(store, 'g2', { baseline: 70 }, now);
assert.equal(a.mood, 70);
assert.equal(b.mood, 70);

const result = applyMoodJudgement(a, {
  moodDelta: 6,
  dims: { happy: 5, sweet: 4 },
  reason: '主人夸我，我当时尾巴都晃了',
  confidence: 85,
}, now);
assert.equal(result.changed, true);
assert.ok(a.mood > 70);
assert.equal(a.lastReason, '主人夸我，我当时尾巴都晃了');

const injection = moodInjection(a, { confidenceThreshold: 60, dailyInject: 1 }, now);
assert.equal(injection.inject, true);
markMoodInjected(a, now);
const second = moodInjection(a, { confidenceThreshold: 60, dailyInject: 1 }, now + 1);
assert.equal(second.inject, false);
assert.equal(second.reason, 'daily-cap');

const low = groupMood(store, 'g3', { baseline: 70 }, now);
applyMoodJudgement(low, { moodDelta: 5, dims: { happy: 5 }, reason: '有点开心', confidence: 30 }, now);
assert.equal(moodInjection(low, { confidenceThreshold: 60 }, now).reason, 'confidence');

// 时间衰减：12 小时后向基线靠近
const before = a.mood;
decayMood(a, now + 12 * 60 * 60_000, { halfLifeHours: 12, baseline: 70 });
assert.ok(a.mood < before);
assert.ok(a.mood >= 70);

// 重置
resetMood(a, { baseline: 70 }, now);
assert.equal(a.mood, 70);
assert.equal(a.dims.happy, 0);

// 按群隔离
assert.notEqual(store.groups.g1, store.groups.g2);
console.log('mood: all assertions passed');
