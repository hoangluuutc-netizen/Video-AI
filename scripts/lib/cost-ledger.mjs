import fs from 'node:fs';
import path from 'node:path';

// Đối chiếu bảng giá Dashboard & Fal.ai ngày 2026-11-16 (lấy cận trên của khoảng giá).
// Nhóm video tính theo USD/giây; nhóm ảnh tính theo USD/ảnh; nhóm TTS tính theo USD/video.
export const PRICE_TABLE_USD = {
  // LLM ($0 / video hoặc theo token)
  'local-ecommerce-director': 0,
  'ollama:qwen3.5:9b': 0,
  'gemini-3-flash-preview': 0.001,
  'gemini-3.1-pro-preview': 0.01,

  // Image (USD / ảnh)
  'ffmpeg-real-composite': 0,
  'photoroom-bg-remove': 0.02,
  'fal-flux-kontext': 0.04,
  'claid-ai-studio': 0.06,
  'gemini-nano-banana-2.1': 0.08,
  'gemini-3-pro-image': 0.15,

  // Video (USD / giây)
  'ffmpeg-bokeh-cinema': 0,
  'fal-wan-i2v': 0.05,
  'fal-kling-turbo': 0.07,
  'fal-seedance-pro': 0.15,
  'fal-kling-pro': 0.24,
  'gemini-omni-1.2-flash': 0.25,
  'veo-3.1-generate-001': 0.40,

  // TTS (USD / video)
  'windows-sapi-vi': 0,
  'google-vi-natural': 0,
  'voicestudio-voxcpm2': 0,
  'sidecar-voxcpm2': 0,
  'fpt-vi': 0.006,
  'vbee-vi': 0.01,
  'gemini-3.8-flash-tts': 0.02,
  'elevenlabs-v3': 0.05
};

function roundUsd(v) {
  return Math.round(Number(v || 0) * 100) / 100;
}

export function estimateAiCost({
  imageModel = 'ffmpeg-real-composite',
  videoModel = 'ffmpeg-bokeh-cinema',
  ttsModel = 'google-vi-natural',
  aiScenes = [],
  keyframes = 0
} = {}) {
  const items = [];

  if (keyframes > 0) {
    const unitPrice = PRICE_TABLE_USD[imageModel] ?? 0;
    items.push({
      step: 'keyframe',
      model: imageModel,
      units: keyframes,
      usd: roundUsd(keyframes * unitPrice)
    });
  }

  const totalSec = (aiScenes || []).reduce((sum, s) => sum + Math.max(0, Number(s?.durationSec || 0)), 0);
  if (totalSec > 0) {
    const unitPrice = PRICE_TABLE_USD[videoModel] ?? 0;
    items.push({
      step: 'video',
      model: videoModel,
      units: totalSec,
      usd: roundUsd(totalSec * unitPrice)
    });
  }

  if (ttsModel) {
    const unitPrice = PRICE_TABLE_USD[ttsModel] ?? 0;
    items.push({
      step: 'tts',
      model: ttsModel,
      units: 1,
      usd: roundUsd(unitPrice)
    });
  }

  const totalUsd = roundUsd(items.reduce((sum, it) => sum + it.usd, 0));
  return { items, totalUsd };
}

export function assertWithinBudget(estimate, maxUsd = 0.5) {
  const total = Number(estimate?.totalUsd || 0);
  const limit = Number(maxUsd ?? 0.5);
  if (total > limit) {
    throw new Error(`Vượt ngân sách: ước tính $${total} > $${limit} / video`);
  }
}

export function recordCost(campaignDir, item) {
  const outDir = path.join(campaignDir, 'out');
  fs.mkdirSync(outDir, { recursive: true });
  const ledgerPath = path.join(outDir, 'cost-ledger.jsonl');
  const entry = {
    ts: new Date().toISOString(),
    ...item
  };
  fs.appendFileSync(ledgerPath, JSON.stringify(entry) + '\n', 'utf8');
  return ledgerPath;
}
