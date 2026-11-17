import test from 'node:test';
import assert from 'node:assert/strict';
import { computeFitTempo, planSceneFit, applySceneDuration } from '../generate-voiceover.mjs';

test('computeFitTempo', () => {
  assert.deepEqual(computeFitTempo(3, 4), { tempo: 1, overflowSec: 0 });
  assert.deepEqual(computeFitTempo(4.2, 4), { tempo: 1.05, overflowSec: 0 });
  const r = computeFitTempo(5, 4);
  assert.equal(r.tempo, 1.15);
  assert.ok(Math.abs(r.overflowSec - 0.348) < 0.01);
});

// Không bao giờ cắt lời thoại: tăng tốc tối đa 1.15x, còn tràn thì kéo dài cảnh
test('planSceneFit: vừa thời lượng thì giữ nguyên cảnh', () => {
  assert.deepEqual(planSceneFit(3, 4), { durationSec: 4, tempo: 1, extended: false });
  assert.deepEqual(planSceneFit(4.6, 4), { durationSec: 4, tempo: 1.15, extended: false });
});

test('planSceneFit: tràn sau khi tăng tốc 1.15x thì kéo dài cảnh, làm tròn lên 0.1s + 0.25s nghỉ', () => {
  const r = planSceneFit(15, 5);
  assert.equal(r.extended, true);
  assert.equal(r.tempo, 1.15);
  assert.equal(r.durationSec, 13.3); // 15 / 1.15 = 13.04 + 0.25 = 13.29 → 13.3
  // cảnh mới phải đủ chỗ cho toàn bộ lời đã tăng tốc
  assert.ok(r.durationSec >= 15 / 1.15);
});

test('applySceneDuration: cập nhật cả trimEndSec của cảnh quay thật', () => {
  const real = { id: 'a', durationSec: 4, trimStartSec: 2, trimEndSec: 6 };
  applySceneDuration(real, 7.3);
  assert.deepEqual(real, { id: 'a', durationSec: 7.3, trimStartSec: 2, trimEndSec: 9.3 });
  const ai = { id: 'b', durationSec: 4 };
  applySceneDuration(ai, 5.1);
  assert.deepEqual(ai, { id: 'b', durationSec: 5.1 });
});

test('planSceneFit: chạy lại trên cảnh đã kéo dài thì ổn định (không cộng dồn 0.3s mỗi lần)', () => {
  // số liệu thật: bản thu thô 9.096s, lần 1 kéo cảnh 4s → 8.2s; lần 2 phải giữ 8.2s
  const first = planSceneFit(9.096, 4);
  assert.equal(first.durationSec, 8.2);
  const second = planSceneFit(9.096, first.durationSec);
  assert.deepEqual(second, { durationSec: 8.2, tempo: 1.11, extended: false });
});
