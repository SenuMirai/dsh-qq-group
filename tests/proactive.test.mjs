import assert from 'node:assert/strict';
import { defaultGroupPolicy } from '../src/qq/config.ts';
import {
  createGroupState,
  proactiveLine,
  proactivePeak,
  proactiveQuiet,
  proactiveRoll,
  proactiveVerdict,
} from '../src/qq/policy.ts';

const peakTime = new Date('2026-10-21T10:00:00+08:00').getTime(); // 周三峰时
const offTime = new Date('2026-10-21T20:00:00+08:00').getTime(); // 周三谷时
const weekend = new Date('2026-10-24T10:00:00+08:00').getTime(); // 周六

assert.equal(proactivePeak(peakTime), true);
assert.equal(proactivePeak(offTime), false);
assert.equal(proactivePeak(weekend), false);

const policy = defaultGroupPolicy();
policy.enabled = true;
policy.proactive.enabled = true;
policy.proactive.mode = 'dice';
policy.proactive.peakLine = 20;
policy.proactive.offPeakLine = 60;
policy.proactive.nearMinutes = 20;
policy.proactive.nearFactor = 0.15;
policy.proactive.farMinutes = 360;
policy.proactive.farFactor = 1.5;
policy.proactive.missBonus = 10;
policy.proactive.missBonusMax = 40;
policy.proactive.quietStart = 1;
policy.proactive.quietEnd = 8;
policy.proactive.intervalMs = 30 * 60_000;
policy.proactive.minIdleMs = 5 * 60_000;

const state = createGroupState('g');
state.lastHumanAt = offTime - 10 * 60_000; // 刚聊过 → ×0.15
const near = proactiveLine(state, policy, offTime);
assert.equal(near.peak, false);
assert.equal(near.base, 60);
assert.equal(near.factor, 0.15);
assert.ok(Math.abs(near.line - 9) < 0.001);

state.lastHumanAt = offTime - 7 * 60 * 60_000; // 冷太久 → ×1.5
const far = proactiveLine(state, policy, offTime);
assert.equal(far.factor, 1.5);
assert.ok(Math.abs(far.line - 90) < 0.001);

state.proactiveMisses = 2;
const bonus = proactiveLine(state, policy, offTime);
assert.equal(bonus.bonus, 20);
assert.ok(Math.abs(bonus.line - 100) < 0.001); // 90 + 20 封顶 100

state.lastHumanAt = offTime - 7 * 60 * 60_000;
const quietAt = new Date('2026-10-21T03:00:00+08:00').getTime();
assert.equal(proactiveQuiet(policy.proactive, quietAt), true);
const quietLine = proactiveLine(state, policy, quietAt);
assert.equal(quietLine.line, 0);
assert.equal(quietLine.quiet, true);

// 骰子：0.5 → 掷 50；命中线 90 → 中
state.lastHumanAt = offTime - 7 * 60 * 60_000;
state.proactiveMisses = 0;
const hit = proactiveRoll(state, policy, offTime, () => 0.5);
assert.equal(hit.fire, true);
// 0.95 → 掷 95；命中线 90 → 不中
const miss = proactiveRoll(state, policy, offTime, () => 0.95);
assert.equal(miss.fire, false);

// 到点判定：刚尝试过，未到 interval
state.lastHumanAt = offTime - 4 * 60 * 60_000;
state.lastProactiveTryAt = offTime - 20 * 60_000;
const verdict = proactiveVerdict(state, policy, offTime);
assert.equal(verdict.fire, false);
assert.equal(verdict.reason, 'not-scheduled');

// 安静时段不触发
state.lastHumanAt = quietAt - 10 * 60 * 60_000;
state.lastProactiveTryAt = undefined;
const quietVerdict = proactiveVerdict(state, policy, quietAt);
assert.equal(quietVerdict.fire, false);
assert.equal(quietVerdict.reason, 'quiet');

console.log('proactive: all assertions passed');
