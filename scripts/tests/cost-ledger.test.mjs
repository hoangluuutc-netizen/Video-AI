import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  PRICE_TABLE_USD,
  estimateAiCost,
  assertWithinBudget,
  recordCost
} from '../lib/cost-ledger.mjs';
import {
  aiCacheKey,
  getCachedAi,
  putCachedAi
} from '../lib/ai-cache.mjs';

test('PRICE_TABLE_USD có đủ model trên Dashboard', () => {
  assert.equal(PRICE_TABLE_USD['ffmpeg-real-composite'], 0);
  assert.equal(PRICE_TABLE_USD['fal-flux-kontext'], 0.04);
  assert.equal(PRICE_TABLE_USD['fal-wan-i2v'], 0.05);
});

test('1 cảnh Wan 5s + 1 keyframe = $0.29', () => {
  const est = estimateAiCost({
    imageModel: 'fal-flux-kontext',
    videoModel: 'fal-wan-i2v',
    ttsModel: 'google-vi-natural',
    aiScenes: [{ durationSec: 5 }],
    keyframes: 1
  });
  assert.equal(est.totalUsd, 0.29);
});

test('chặn 2 cảnh Kling 5s', () => {
  const est = estimateAiCost({
    imageModel: 'fal-flux-kontext',
    videoModel: 'fal-kling-turbo',
    ttsModel: 'google-vi-natural',
    aiScenes: [{ durationSec: 5 }, { durationSec: 5 }],
    keyframes: 2
  });
  assert.throws(() => assertWithinBudget(est, 0.5), /Vượt ngân sách/);
});

test('recordCost ghi vào out/cost-ledger.jsonl', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ledger-'));
  try {
    recordCost(tmp, { step: 'video', model: 'fal-wan-i2v', usd: 0.25 });
    const lines = fs.readFileSync(path.join(tmp, 'out', 'cost-ledger.jsonl'), 'utf8').trim().split('\n');
    assert.equal(lines.length, 1);
    assert.equal(JSON.parse(lines[0]).usd, 0.25);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('aiCacheKey đổi khi ảnh đổi và putCachedAi/getCachedAi hoạt động', () => {
  const p = { endpoint: 'fal/wan', payload: { prompt: 'x' } };
  assert.notEqual(
    aiCacheKey({ ...p, imageHashes: ['a'] }),
    aiCacheKey({ ...p, imageHashes: ['b'] })
  );

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'aicache-'));
  try {
    const src = path.join(tmp, 'src.mp4');
    fs.writeFileSync(src, 'video-bytes');
    const k = aiCacheKey({ ...p, imageHashes: ['a'] });
    const cached = putCachedAi(k, src, 'mp4', { cacheDir: tmp });
    assert.equal(getCachedAi(k, 'mp4', { cacheDir: tmp }), cached);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});
