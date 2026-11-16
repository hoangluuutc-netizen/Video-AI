import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getFreeMemoryGb,
  ensureFreeMemory,
  prepareForHeavyPhase
} from '../lib/resource-gate.mjs';

test('getFreeMemoryGb trả về số dương', () => {
  const gb = getFreeMemoryGb();
  assert.equal(typeof gb, 'number');
  assert.ok(gb > 0);
});

test('ensureFreeMemory chờ tới khi đủ RAM', async () => {
  const seq = [3, 3, 9];
  const free = await ensureFreeMemory({
    minFreeGb: 8,
    label: 'TTS',
    pollMs: 1,
    freeMemFn: () => seq.shift()
  });
  assert.equal(free, 9);
});

test('ensureFreeMemory báo lỗi tiếng Việt khi hết thời gian', async () => {
  await assert.rejects(
    ensureFreeMemory({ minFreeGb: 8, label: 'TTS', waitMs: 5, pollMs: 1, freeMemFn: () => 2 }),
    /Không đủ RAM cho TTS: cần 8 GB, còn 2/
  );
});

test('prepareForHeavyPhase chạy được khi Ollama tắt', async () => {
  const res = await prepareForHeavyPhase({
    label: 'TTS',
    minFreeGb: 0.1,
    ollamaBaseUrl: 'http://127.0.0.1:1'
  });
  assert.deepEqual(res.unloaded, []);
  assert.ok(res.freeGb > 0);
});
