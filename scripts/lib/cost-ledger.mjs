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

// Số giây Fal thực sự tính tiền cho 1 clip: Kling làm tròn 5s/10s (cùng quy tắc fal-client.mjs),
// Wan 2.2 I2V không nhận tham số thời lượng nên luôn trả 1 clip mặc định ~5s.
export function falBilledSeconds(durationSec, modelKey = 'fal-kling-turbo') {
  if (modelKey === 'fal-wan-i2v') return 5;
  return Number(durationSec) >= 8 ? 10 : 5;
}

// Ước tính chi phí 1 video cho Dashboard: N cảnh AI, mỗi cảnh 1 keyframe + clip Fal (Fal tính tròn 5s/clip).
export function estimateVideoCost({
  imageModel = 'ffmpeg-real-composite',
  videoModel = 'ffmpeg-bokeh-cinema',
  ttsModel = 'google-vi-natural',
  aiSceneCount = 1,
  sceneSec = 5,
  maxUsd = 0.5
} = {}) {
  const n = Math.min(8, Math.max(0, Math.round(Number(aiSceneCount) || 0)));
  const sec = Math.max(1, Number(sceneSec) || 5);
  const est = estimateAiCost({
    imageModel,
    videoModel,
    ttsModel,
    aiScenes: Array.from({ length: n }, () => ({ durationSec: sec })),
    keyframes: n
  });
  const limit = Number.isFinite(Number(maxUsd)) ? Number(maxUsd) : 0.5;
  return { ...est, aiSceneCount: n, maxUsd: limit, withinBudget: est.totalUsd <= limit };
}

// Chuẩn hóa 2 trường kiểm soát chi phí gửi từ Dashboard; giá trị trống/sai thì giữ cấu hình cũ.
export function normalizeCostSettings(input = {}, current = {}) {
  const count = Number(input.selectiveAiCount);
  const rawBudget = input.maxCostUsdPerVideo;
  const budget = rawBudget === '' || rawBudget === null || rawBudget === undefined ? NaN : Number(rawBudget);
  return {
    selectiveAiCount: count === 1 || count === 2 ? count : (current.selectiveAiCount ?? 1),
    maxCostUsdPerVideo:
      Number.isFinite(budget) && budget >= 0 && budget <= 5
        ? Math.round(budget * 100) / 100
        : (current.maxCostUsdPerVideo ?? 0.5)
  };
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
