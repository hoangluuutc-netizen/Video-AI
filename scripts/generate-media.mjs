import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { buildScenePrompt, readJson } from './lib/prompt-builder.mjs';
import { FAL_IMAGE_ENDPOINTS, FAL_VIDEO_ENDPOINTS, generateFalImage, generateFalVideo } from './lib/fal-client.mjs';
import { PRICE_TABLE_USD, estimateAiCost, assertWithinBudget, recordCost } from './lib/cost-ledger.mjs';
import { aiCacheKey, getCachedAi, putCachedAi } from './lib/ai-cache.mjs';

function hashFiles(paths) {
  return (paths || [])
    .filter((p) => p && fs.existsSync(p))
    .map((p) => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex'));
}

const ROOT = process.cwd();
const INTERACTIONS_URL = 'https://generativelanguage.googleapis.com/v1beta/interactions';

function loadEnvFile() {
  const envPath = path.join(ROOT, '.env');
  if (!fs.existsSync(envPath)) return;
  const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, '');
    if (key && !process.env[key]) {
      process.env[key] = val;
    }
  }
}

function loadAiConfig() {
  const cfgPath = path.join(ROOT, 'assets', 'brand-kit', 'ai-config.json');
  if (!fs.existsSync(cfgPath)) return {};
  try {
    return JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
  } catch {
    return {};
  }
}

function parseArgs(argv) {
  let campaignArg = 'campaigns/sample-campaign/campaign.json';
  let mode = '';
  let sceneFilter = '';
  let dryRun = false;
  let selective = false;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--mode' && argv[i + 1]) {
      mode = argv[++i];
    } else if (arg === '--scene' && argv[i + 1]) {
      sceneFilter = argv[++i];
    } else if (arg === '--dry-run') {
      dryRun = true;
    } else if (arg === '--selective') {
      selective = true;
    } else if (!arg.startsWith('--')) {
      campaignArg = arg;
    }
  }
  return { campaignArg, mode, sceneFilter, dryRun, selective };
}

function collectReferenceAbsPaths(product, character) {
  const out = [];
  const candidates = [
    ...Object.values(product.referenceImages || {}),
    ...Object.values(character.referenceImages || {})
  ];
  for (const rel of candidates) {
    if (!rel) continue;
    const abs = path.isAbsolute(rel) ? rel : path.join(ROOT, rel);
    if (fs.existsSync(abs)) out.push(abs);
  }
  return out;
}

function guessMimeType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.png') return 'image/png';
  if (ext === '.webp') return 'image/webp';
  return 'image/jpeg';
}

function toImagePart(absPath) {
  const data = fs.readFileSync(absPath).toString('base64');
  return { type: 'image', data, mime_type: guessMimeType(absPath) };
}

function collectReferenceParts(product, character) {
  const parts = [];
  const candidates = [
    ...Object.values(product.referenceImages || {}),
    ...Object.values(character.referenceImages || {})
  ];
  for (const rel of candidates) {
    if (!rel) continue;
    const abs = path.isAbsolute(rel) ? rel : path.join(ROOT, rel);
    if (fs.existsSync(abs)) {
      parts.push(toImagePart(abs));
    }
  }
  return parts;
}

async function callInteractionsApi(apiKey, model, input) {
  const res = await fetch(INTERACTIONS_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': apiKey
    },
    body: JSON.stringify({ model, input })
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`HTTP ${res.status}: ${errText}`);
  }
  return res.json();
}

function extractBase64Media(response, kind) {
  if (kind === 'image' && response.output_image?.data) {
    return response.output_image.data;
  }
  if (kind === 'video' && response.output_video?.data) {
    return response.output_video.data;
  }
  if (Array.isArray(response.outputs)) {
    const found = response.outputs.find((o) => o.type === kind && o.data);
    if (found) return found.data;
  }
  return null;
}

async function processSceneKeyframe(scene, ctx) {
  const { campaignDir, product, character, apiKey, falKey, dryRun } = ctx;
  const { keyframePrompt } = buildScenePrompt(scene, product, character);
  const refAbs = collectReferenceAbsPaths(product, character);
  const refParts = refAbs.map(toImagePart);
  const input = [...refParts, { type: 'text', text: keyframePrompt }];
  const model = process.env.GEMINI_IMAGE_MODEL || 'gemini-nano-banana-2.1';
  const relOut = path.posix.join('media', 'keyframes', `${scene.id}.png`);
  const absOut = path.join(campaignDir, relOut);

  if (dryRun) {
    console.log(`[DRY-RUN][keyframe] Cảnh "${scene.id}" | model=${model} | refs=${refParts.length} | out=${relOut}`);
    return { sceneId: scene.id, updated: false };
  }

  const cacheKey = aiCacheKey({ endpoint: `keyframe:${model}`, payload: { keyframePrompt }, imageHashes: hashFiles(refAbs) });
  const cachedFile = getCachedAi(cacheKey, 'png');
  fs.mkdirSync(path.dirname(absOut), { recursive: true });
  if (cachedFile) {
    fs.copyFileSync(cachedFile, absOut);
    recordCost(campaignDir, { step: 'keyframe', model, usd: 0, cacheHit: true, sceneId: scene.id });
    console.log(`[AI Cache][keyframe] Cảnh "${scene.id}" -> $0`);
    scene.keyframeSrc = relOut;
    scene.qcStatus = 'pending';
    return { sceneId: scene.id, updated: true, out: relOut };
  }

  if (FAL_IMAGE_ENDPOINTS[model]) {
    if (!falKey) throw new Error(`Thiếu FAL_KEY để gọi ${model}.`);
    const buf = await generateFalImage({ apiKey: falKey, modelKey: model, prompt: keyframePrompt, referenceImagePaths: refAbs });
    fs.writeFileSync(absOut, buf);
  } else {
    const response = await callInteractionsApi(apiKey, model, input);
    const b64 = extractBase64Media(response, 'image');
    if (!b64) {
      throw new Error(`Không nhận được dữ liệu ảnh từ API cho cảnh "${scene.id}"`);
    }
    fs.writeFileSync(absOut, Buffer.from(b64, 'base64'));
  }
  putCachedAi(cacheKey, absOut, 'png');
  recordCost(campaignDir, { step: 'keyframe', model, usd: PRICE_TABLE_USD[model] ?? 0, cacheHit: false, sceneId: scene.id });
  scene.keyframeSrc = relOut;
  scene.qcStatus = 'pending';
  return { sceneId: scene.id, updated: true, out: relOut };
}

async function processSceneVideo(scene, ctx) {
  const { campaignDir, product, character, apiKey, falKey, dryRun } = ctx;
  if (scene.qcStatus !== 'approved') {
    console.warn(`[BỎ QUA][video] Cảnh "${scene.id}" có qcStatus="${scene.qcStatus || 'pending'}" (chưa được duyệt "approved").`);
    return { sceneId: scene.id, updated: false, skipped: true };
  }
  const keyframeAbs = scene.keyframeSrc
    ? (path.isAbsolute(scene.keyframeSrc) ? scene.keyframeSrc : path.join(campaignDir, scene.keyframeSrc))
    : '';
  if (!keyframeAbs || !fs.existsSync(keyframeAbs)) {
    console.warn(`[BỎ QUA][video] Cảnh "${scene.id}" thiếu file keyframe hợp lệ (${scene.keyframeSrc || 'trống'}).`);
    return { sceneId: scene.id, updated: false, skipped: true };
  }

  const { videoPrompt, veo3Prompt, omniFlashR2VPrompt } = buildScenePrompt(scene, product, character);
  const model = process.env.GEMINI_VIDEO_MODEL || 'gemini-omni-1.2-flash';
  const relOut = path.posix.join('media', 'clips', `${scene.id}.mp4`);
  const absOut = path.join(campaignDir, relOut);

  if (dryRun) {
    console.log(`[DRY-RUN][video] Cảnh "${scene.id}" | model=${model} | keyframe=${scene.keyframeSrc} | out=${relOut}`);
    return { sceneId: scene.id, updated: false };
  }

  const endKeyframeAbs = scene.endKeyframeSrc
    ? (path.isAbsolute(scene.endKeyframeSrc) ? scene.endKeyframeSrc : path.join(campaignDir, scene.endKeyframeSrc))
    : '';
  const dur = Number(scene.durationSec || 5);
  const cacheKey = aiCacheKey({
    endpoint: `video:${model}`,
    payload: { prompt: veo3Prompt || videoPrompt, dur },
    imageHashes: hashFiles([keyframeAbs, endKeyframeAbs])
  });
  const cachedFile = getCachedAi(cacheKey, 'mp4');
  fs.mkdirSync(path.dirname(absOut), { recursive: true });

  if (cachedFile) {
    fs.copyFileSync(cachedFile, absOut);
    recordCost(campaignDir, { step: 'video', model, usd: 0, cacheHit: true, sceneId: scene.id });
    console.log(`[AI Cache][video] Cảnh "${scene.id}" -> $0`);
    scene.videoSrc = relOut;
    return { sceneId: scene.id, updated: true, out: relOut };
  }

  if (FAL_VIDEO_ENDPOINTS[model]) {
    if (!falKey) throw new Error(`Thiếu FAL_KEY để gọi ${model}.`);
    const buf = await generateFalVideo({
      apiKey: falKey,
      modelKey: model,
      prompt: veo3Prompt || videoPrompt,
      startImagePath: keyframeAbs,
      endImagePath: endKeyframeAbs,
      durationSec: dur
    });
    fs.writeFileSync(absOut, buf);
  } else {
    // Truyền đồng thời Keyframe Đầu + Keyframe Cuối (nếu có) + Ảnh Nhân vật + Ảnh Sản phẩm (Ingredients-to-Video / Frames-to-Video)
    const refParts = collectReferenceParts(product, character);
    const endPart = endKeyframeAbs && fs.existsSync(endKeyframeAbs) ? [toImagePart(endKeyframeAbs)] : [];
    const chosenPrompt = model.includes('omni') ? omniFlashR2VPrompt : (veo3Prompt || videoPrompt);
    const input = [toImagePart(keyframeAbs), ...endPart, ...refParts.slice(0, 2), { type: 'text', text: chosenPrompt }];
    const response = await callInteractionsApi(apiKey, model, input);
    const b64 = extractBase64Media(response, 'video');
    if (!b64) {
      throw new Error(`Không nhận được dữ liệu video từ API cho cảnh "${scene.id}"`);
    }
    fs.writeFileSync(absOut, Buffer.from(b64, 'base64'));
  }
  putCachedAi(cacheKey, absOut, 'mp4');
  recordCost(campaignDir, { step: 'video', model, usd: Math.round(dur * (PRICE_TABLE_USD[model] ?? 0) * 100) / 100, cacheHit: false, sceneId: scene.id });
  scene.videoSrc = relOut;
  return { sceneId: scene.id, updated: true, out: relOut };
}

async function main() {
  loadEnvFile();
  const aiCfg = loadAiConfig();
  if (!process.env.GEMINI_API_KEY && aiCfg.geminiApiKey) process.env.GEMINI_API_KEY = aiCfg.geminiApiKey;
  if (!process.env.FAL_KEY && aiCfg.falApiKey) process.env.FAL_KEY = aiCfg.falApiKey;
  if (!process.env.GEMINI_IMAGE_MODEL && aiCfg.imageModel) process.env.GEMINI_IMAGE_MODEL = aiCfg.imageModel;
  if (!process.env.GEMINI_VIDEO_MODEL && aiCfg.videoModel) process.env.GEMINI_VIDEO_MODEL = aiCfg.videoModel;
  const { campaignArg, mode, sceneFilter, dryRun, selective } = parseArgs(process.argv.slice(2));

  if (mode !== 'keyframe' && mode !== 'video') {
    console.error('Cách dùng: node scripts/generate-media.mjs <campaign.json> --mode <keyframe|video> [--scene <id>] [--selective] [--dry-run]');
    process.exit(1);
  }

  const campaignPath = path.isAbsolute(campaignArg) ? campaignArg : path.join(ROOT, campaignArg);
  if (!fs.existsSync(campaignPath)) {
    console.error(`Không tìm thấy chiến dịch: ${campaignPath}`);
    process.exit(1);
  }

  const activeModel = mode === 'keyframe' ? (process.env.GEMINI_IMAGE_MODEL || 'gemini-nano-banana-2.1') : (process.env.GEMINI_VIDEO_MODEL || 'gemini-omni-1.2-flash');
  const usesFal = Boolean(FAL_IMAGE_ENDPOINTS[activeModel] || FAL_VIDEO_ENDPOINTS[activeModel]);
  const apiKey = process.env.GEMINI_API_KEY || '';
  const falKey = process.env.FAL_KEY || '';
  if (!dryRun && !usesFal && !apiKey) {
    console.error('Thiếu GEMINI_API_KEY trong biến môi trường hoặc file .env (dùng --dry-run để kiểm tra thử).');
    process.exit(1);
  }
  if (!dryRun && usesFal && !falKey) {
    console.error(`Thiếu FAL_KEY để gọi ${activeModel} (thêm vào .env hoặc Cấu hình Bộ não).`);
    process.exit(1);
  }

  const campaign = readJson(campaignPath);
  if (campaign.mode === 'real-footage') {
    console.error('TỪ CHỐI: Chiến dịch ở chế độ "real-footage" (Zero-AI-Pixel) — không được dùng AI sinh ảnh/video.');
    console.error('Dùng: node scripts/export-cutlist.mjs <campaign.json> [--render-ffmpeg] hoặc Remotion (studio/).');
    process.exit(1);
  }
  const product = readJson(path.join(ROOT, 'assets', 'products', campaign.productId, 'product.json'));
  const character = readJson(path.join(ROOT, 'assets', 'characters', campaign.characterId, 'character.json'));
  const campaignDir = path.dirname(campaignPath);

  let targets = campaign.scenes.filter((s) => {
    const isAi = s.type === 'ai-lifestyle' || s.type === 'ai-experience';
    if (!isAi) return false;
    return sceneFilter ? s.id === sceneFilter : true;
  });

  const selectiveAiCount = Math.min(2, Math.max(1, Number(aiCfg.selectiveAiCount ?? 1)));
  if ((selective || aiCfg.selectiveAiOnly) && !sceneFilter && targets.length > selectiveAiCount) {
    console.log(`[Selective AI] Giới hạn chỉ sinh AI cho ${selectiveAiCount} cảnh đầu (${targets.slice(0, selectiveAiCount).map((t) => t.id).join(', ')}), các cảnh sau giữ nguyên ảnh thật.`);
    targets = targets.slice(0, selectiveAiCount);
  }

  const est = estimateAiCost({
    imageModel: process.env.GEMINI_IMAGE_MODEL || aiCfg.imageModel || 'ffmpeg-real-composite',
    videoModel: process.env.GEMINI_VIDEO_MODEL || aiCfg.videoModel || 'ffmpeg-bokeh-cinema',
    ttsModel: aiCfg.ttsModel || 'google-vi-natural',
    aiScenes: mode === 'video' ? targets : [],
    keyframes: mode === 'keyframe' ? targets.length : 0
  });
  const maxUsd = Number(aiCfg.maxCostUsdPerVideo ?? 0.5);
  console.log(`[Ước tính chi phí] Tổng=$${est.totalUsd} / ngưỡng $${maxUsd} (${est.items.map((it) => `${it.step}:${it.model}=$${it.usd}`).join(', ')})`);
  if (!dryRun) {
    assertWithinBudget(est, maxUsd);
  }

  if (targets.length === 0) {
    console.log('Không có cảnh AI nào khớp điều kiện để xử lý.');
    return;
  }

  const ctx = { campaignDir, product, character, apiKey, falKey, dryRun };
  const worker = mode === 'keyframe' ? processSceneKeyframe : processSceneVideo;
  const results = await Promise.allSettled(targets.map((s) => worker(s, ctx)));

  let hasUpdated = false;
  let hasError = false;
  for (const r of results) {
    if (r.status === 'fulfilled') {
      if (r.value.updated) {
        hasUpdated = true;
        console.log(`OK [${mode}] ${r.value.sceneId} -> ${r.value.out}`);
      }
    } else {
      hasError = true;
      console.error(`LỖI [${mode}]:`, r.reason?.message || r.reason);
    }
  }

  if (hasUpdated) {
    fs.writeFileSync(campaignPath, JSON.stringify(campaign, null, 2) + '\n', 'utf8');
    console.log(`Đã cập nhật ${path.relative(ROOT, campaignPath)}`);
  }
  if (hasError) process.exit(1);
}

main();
