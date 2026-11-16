import test from 'node:test';
import assert from 'node:assert/strict';
import { runPhasedPipeline } from '../lib/phased-batch.mjs';

function fakeDeps(log, { failVoiceFor = '' } = {}) {
  const step = (name) => async (c) => {
    if (name === 'voice' && c === failVoiceFor) throw new Error('TTS lỗi');
    log.push(`${name}:${c}`);
  };
  return {
    prompts: step('prompts'),
    beforeVoice: async () => log.push('beforeVoice'),
    withTts: async (fn) => {
      log.push('tts:on');
      try {
        return await fn();
      } finally {
        log.push('tts:off');
      }
    },
    voice: step('voice'),
    render: step('render'),
    verify: step('verify'),
    record: step('record')
  };
}

test('chạy theo pha: xong pha này cho mọi SKU mới sang pha sau, TTS bật/tắt đúng 1 lần', async () => {
  const log = [];
  const r = await runPhasedPipeline(['a', 'b'], fakeDeps(log));
  assert.deepEqual(log, [
    'prompts:a', 'prompts:b',
    'beforeVoice', 'tts:on', 'voice:a', 'voice:b', 'tts:off',
    'render:a', 'render:b',
    'verify:a', 'verify:b',
    'record:a', 'record:b'
  ]);
  assert.deepEqual(r.ok, ['a', 'b']);
  assert.deepEqual(r.failed, []);
});

test('SKU lỗi ở pha giọng thì không dựng/kiểm tiếp, SKU khác vẫn chạy', async () => {
  const log = [];
  const r = await runPhasedPipeline(['a', 'b', 'c'], fakeDeps(log, { failVoiceFor: 'b' }));
  assert.ok(!log.includes('render:b'));
  assert.ok(log.includes('render:c'));
  assert.deepEqual(r.ok, ['a', 'c']);
  assert.equal(r.failed[0].id, 'b');
  assert.equal(r.failed[0].phase, 'voice');
});
