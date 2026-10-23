import assert from 'node:assert/strict';
import { parseReplyPlan } from '../src/qq/llm.ts';

const truncated = `{
  "messages": ["干嘛呀，渡鸦"],
  "action": "text",`;
const plan = parseReplyPlan(truncated);
assert.deepEqual(plan.messages, ['干嘛呀，渡鸦']);
assert.equal(plan.messages.some((m) => m.includes('"messages"') || m === '{'), false);

const normal = parseReplyPlan('{"messages":["你好","在吗"],"action":"text"}');
assert.deepEqual(normal.messages, ['你好', '在吗']);

const plain = parseReplyPlan('行行行\n听着啊');
assert.deepEqual(plain.messages, ['行行行', '听着啊']);
console.log('reply-plan: all assertions passed');
