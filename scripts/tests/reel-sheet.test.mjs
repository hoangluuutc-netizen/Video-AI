import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeReelRow, upsertReel } from '../lib/reel-sheet.mjs';

const legacyPipelineRow = {
  code: 'REEL-04',
  campaignId: 'sample-campaign',
  type: 'Veo3.1 + Bokeh Cinema (16s)',
  hook: 'Hook A',
  durationSec: 16,
  mode: 'real-footage',
  status: 'PASS (100% Gốc + Có Tiếng)',
  videoLink: 'campaigns/sample-campaign/out/ffmpeg-9x16.mp4',
  updatedAt: '2026-11-16 17:37'
};

const legacyUiRow = {
  id: 'sample-campaign',
  mode: 'hybrid-ai',
  productName: 'Bình Giữ Nhiệt',
  hook: 'Hook B',
  durationSec: 16,
  qcStatus: 'PASS',
  outputPath: 'studio/out/tiktok-9x16.mp4'
};

test('normalizeReelRow: dòng cũ của pipeline (campaignId/status/videoLink) → đủ cột cho bảng & CSV', () => {
  const r = normalizeReelRow(legacyPipelineRow);
  assert.equal(r.id, 'sample-campaign');
  assert.equal(r.qcStatus, 'PASS (100% Gốc + Có Tiếng)');
  assert.equal(r.outputPath, 'campaigns/sample-campaign/out/ffmpeg-9x16.mp4');
  assert.equal(r.productName, '');
  assert.equal(r.code, 'REEL-04');
});

test('normalizeReelRow: dòng cũ của giao diện giữ nguyên các cột', () => {
  const r = normalizeReelRow(legacyUiRow);
  assert.equal(r.id, 'sample-campaign');
  assert.equal(r.qcStatus, 'PASS');
  assert.equal(r.productName, 'Bình Giữ Nhiệt');
});

test('upsertReel: thay MỌI dòng cùng chiến dịch (cả 2 kiểu cũ), đưa bản mới lên đầu', () => {
  const other = { id: 'kol-linh-dan', qcStatus: 'PASS' };
  const record = normalizeReelRow({ id: 'sample-campaign', qcStatus: 'CHỜ KOL DUYỆT', hook: 'Hook mới' });
  const out = upsertReel([legacyPipelineRow, other, legacyUiRow], record);
  assert.equal(out.length, 2);
  assert.equal(out[0].id, 'sample-campaign');
  assert.equal(out[0].qcStatus, 'CHỜ KOL DUYỆT');
  assert.equal(out[1].id, 'kol-linh-dan');
});
