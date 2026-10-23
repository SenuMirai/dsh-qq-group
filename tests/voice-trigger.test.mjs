import assert from 'node:assert/strict';
import { asksForVoice, asksForSong, songTitleFrom } from '../src/qq/policy.ts';

assert.equal(asksForVoice('发个语音听听'), true);
assert.equal(asksForVoice('说句话呗'), true);
assert.equal(asksForVoice('用语音回复我'), true);
assert.equal(asksForVoice('说语音给我听听，这是测试'), true);
assert.equal(asksForVoice('今天天气不错'), false);
assert.equal(asksForVoice('语音概率怎么调'), false);

assert.equal(asksForSong('唱首歌'), true);
assert.equal(asksForSong('你唱首歌来听听'), true);
assert.equal(asksForSong('唱首小星星'), true);
assert.equal(asksForSong('点歌'), true);
assert.equal(asksForSong('来一首小星星'), true);
assert.equal(asksForSong('今天吃什么'), false);
assert.equal(songTitleFrom('你唱首歌来听听'), undefined);
assert.equal(songTitleFrom('唱首小星星'), '小星星');
assert.equal(songTitleFrom('来一首晴天'), '晴天');
console.log('voice-trigger: all assertions passed');
