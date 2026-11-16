import test from 'node:test';
import assert from 'node:assert/strict';
import { estimateVideoCost, normalizeCostSettings } from '../lib/cost-ledger.mjs';

test('estimateVideoCost: 1 cảnh FLUX + Wan 5s + TTS miễn phí = $0.29, trong ngân sách', () => {
  const r = estimateVideoCost({
    imageModel: 'fal-flux-kontext',
    videoModel: 'fal-wan-i2v',
    ttsModel: 'google-vi-natural',
    aiSceneCount: 1,
    maxUsd: 0.5
  });
  assert.equal(r.totalUsd, 0.29);
  assert.equal(r.withinBudget, true);
  assert.equal(r.maxUsd, 0.5);
});

test('estimateVideoCost: 2 cảnh Kling Turbo vượt ngân sách $0.50', () => {
  const r = estimateVideoCost({
    imageModel: 'fal-flux-kontext',
    videoModel: 'fal-kling-turbo',
    ttsModel: 'google-vi-natural',
    aiSceneCount: 2,
    maxUsd: 0.5
  });
  assert.equal(r.totalUsd, 0.78);
  assert.equal(r.withinBudget, false);
});

test('estimateVideoCost: toàn bộ công cụ $0 thì tổng $0', () => {
  const r = estimateVideoCost({
    imageModel: 'ffmpeg-real-composite',
    videoModel: 'ffmpeg-bokeh-cinema',
    ttsModel: 'windows-sapi-vi',
    aiSceneCount: 2
  });
  assert.equal(r.totalUsd, 0);
  assert.equal(r.withinBudget, true);
});

test('estimateVideoCost: số cảnh không hợp lệ bị kẹp về 0–8', () => {
  assert.equal(estimateVideoCost({ videoModel: 'fal-wan-i2v', aiSceneCount: -3 }).aiSceneCount, 0);
  assert.equal(estimateVideoCost({ videoModel: 'fal-wan-i2v', aiSceneCount: 99 }).aiSceneCount, 8);
});

test('normalizeCostSettings giữ giá trị hợp lệ và làm tròn ngân sách', () => {
  assert.deepEqual(normalizeCostSettings({ selectiveAiCount: '2', maxCostUsdPerVideo: '0.456' }, {}), {
    selectiveAiCount: 2,
    maxCostUsdPerVideo: 0.46
  });
});

test('normalizeCostSettings giữ cấu hình cũ khi ô nhập trống hoặc sai', () => {
  const current = { selectiveAiCount: 2, maxCostUsdPerVideo: 0.3 };
  assert.deepEqual(normalizeCostSettings({ selectiveAiCount: 3, maxCostUsdPerVideo: '' }, current), current);
  assert.deepEqual(normalizeCostSettings({ maxCostUsdPerVideo: -1 }, current), current);
  assert.deepEqual(normalizeCostSettings({ maxCostUsdPerVideo: 'abc' }, current), current);
});

test('normalizeCostSettings dùng mặc định 1 cảnh / $0.50 khi chưa có cấu hình', () => {
  assert.deepEqual(normalizeCostSettings({}, {}), { selectiveAiCount: 1, maxCostUsdPerVideo: 0.5 });
});
