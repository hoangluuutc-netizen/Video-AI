import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSystemReadiness } from '../lib/system-readiness.mjs';

test('buildSystemReadiness tính 100% lõi khi FFmpeg, Python, Remotion và Assets sẵn sàng', () => {
  const res = buildSystemReadiness({
    toolsStatus: { libass: true, qsv: true, speechPython: true },
    aiConfig: { envStatus: { GEMINI_API_KEY: false, VBEE_API_KEY: false } },
    counts: { products: 1, characters: 2, campaigns: 2 },
    studioInstalled: true,
    musicCount: 0
  });
  assert.equal(res.corePercent, 100);
  assert.equal(res.readyCount, 4);
  assert.equal(res.totalCount, 7);
});

test('buildSystemReadiness đánh dấu đã cấu hình khi có key trong envStatus và nhạc nền', () => {
  const res = buildSystemReadiness({
    toolsStatus: { libass: true, qsv: true, speechPython: true },
    aiConfig: { envStatus: { GEMINI_API_KEY: true, VBEE_API_KEY: true } },
    counts: { products: 2, characters: 2, campaigns: 3 },
    studioInstalled: true,
    musicCount: 2
  });
  assert.equal(res.readyCount, 7);
  assert.equal(res.corePercent, 100);
});
