import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { summarizeCostLedgers, previewBatchCsv } from '../lib/batch-dashboard.mjs';
import { recordCost } from '../lib/cost-ledger.mjs';

test('summarizeCostLedgers cộng đúng tổng chi phí và sắp xếp mới nhất trước', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ledger-sum-'));
  const c1 = path.join(dir, 'sku-1');
  const c2 = path.join(dir, 'sku-2');
  recordCost(c1, { step: 'image', model: 'fal-flux', usd: 0.04, at: '2026-11-17T01:00:00Z' });
  recordCost(c2, { step: 'video', model: 'fal-wan', usd: 0.25, at: '2026-11-17T02:00:00Z' });

  const sum = summarizeCostLedgers(dir);
  assert.equal(sum.entriesCount, 2);
  assert.equal(sum.totalUsd, 0.29);
  assert.equal(sum.recent[0].campaignId, 'sku-2');
});

test('previewBatchCsv tính đúng số SKU và tổng ước tính chi phí cả lô', () => {
  const csv = 'id,name,sku,category,price,salePrice\nsp-1,Bình nước,SKU1,home,200k,150k\nsp-2,Ly giữ nhiệt,SKU2,home,300k,199k\n';
  const prev = previewBatchCsv(csv, {
    imageModel: 'fal-flux-kontext',
    videoModel: 'fal-wan-i2v',
    ttsModel: 'google-vi-natural',
    selectiveAiOnly: true,
    selectiveAiCount: 1,
    maxCostUsdPerVideo: 0.5
  });
  assert.equal(prev.count, 2);
  assert.equal(prev.perVideoUsd, 0.29);
  assert.equal(prev.totalEstimatedUsd, 0.58);
  assert.equal(prev.withinBudget, true);
});
