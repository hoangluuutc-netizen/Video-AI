import fs from 'node:fs';
import path from 'node:path';
import { buildScenePrompt, readJson } from './lib/prompt-builder.mjs';

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

function parseArgs(argv) {
  let campaignArg = 'campaigns/sample-campaign/campaign.json';
  let mode = '';
  let sceneFilter = '';
  let dryRun = false;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--mode' && argv[i + 1]) {
      mode = argv[++i];
    } else if (arg === '--scene' && argv[i + 1]) {
      sceneFilter = argv[++i];
    } else if (arg === '--dry-run') {
      dryRun = true;
    } else if (!arg.startsWith('--')) {
      campaignArg = arg;
    }
  }
  return { campaignArg, mode, sceneFilter, dryRun };
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
  const { campaignDir, product, character, apiKey, dryRun } = ctx;
  const { keyframePrompt } = buildScenePrompt(scene, product, character);
  const refParts = collectReferenceParts(product, character);
  const input = [...refParts, { type: 'text', text: keyframePrompt }];
  const model = process.env.GEMINI_IMAGE_MODEL || 'gemini-nano-banana-2.1';
  const relOut = path.posix.join('media', 'keyframes', `${scene.id}.png`);
  const absOut = path.join(campaignDir, relOut);

  if (dryRun) {
    console.log(`[DRY-RUN][keyframe] Cảnh "${scene.id}" | model=${model} | refs=${refParts.length} | out=${relOut}`);
    return { sceneId: scene.id, updated: false };
  }

  const response = await callInteractionsApi(apiKey, model, input);
  const b64 = extractBase64Media(response, 'image');
  if (!b64) {
    throw new Error(`Không nhận được dữ liệu ảnh từ API cho cảnh "${scene.id}"`);
  }
  fs.mkdirSync(path.dirname(absOut), { recursive: true });
  fs.writeFileSync(absOut, Buffer.from(b64, 'base64'));
  scene.keyframeSrc = relOut;
  scene.qcStatus = 'pending';
  return { sceneId: scene.id, updated: true, out: relOut };
}

async function processSceneVideo(scene, ctx) {
  const { campaignDir, product, character, apiKey, dryRun } = ctx;
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

  // Truyền đồng thời Keyframe + Ảnh Nhân vật + Ảnh Sản phẩm (Ingredients-to-Video / R2V)
  const refParts = collectReferenceParts(product, character);
  const chosenPrompt = model.includes('omni') ? omniFlashR2VPrompt : (veo3Prompt || videoPrompt);
  const input = [toImagePart(keyframeAbs), ...refParts.slice(0, 2), { type: 'text', text: chosenPrompt }];
  const response = await callInteractionsApi(apiKey, model, input);
  const b64 = extractBase64Media(response, 'video');
  if (!b64) {
    throw new Error(`Không nhận được dữ liệu video từ API cho cảnh "${scene.id}"`);
  }
  fs.mkdirSync(path.dirname(absOut), { recursive: true });
  fs.writeFileSync(absOut, Buffer.from(b64, 'base64'));
  scene.videoSrc = relOut;
  return { sceneId: scene.id, updated: true, out: relOut };
}

async function main() {
  loadEnvFile();
  const { campaignArg, mode, sceneFilter, dryRun } = parseArgs(process.argv.slice(2));

  if (mode !== 'keyframe' && mode !== 'video') {
    console.error('Cách dùng: node scripts/generate-media.mjs <campaign.json> --mode <keyframe|video> [--scene <id>] [--dry-run]');
    process.exit(1);
  }

  const campaignPath = path.isAbsolute(campaignArg) ? campaignArg : path.join(ROOT, campaignArg);
  if (!fs.existsSync(campaignPath)) {
    console.error(`Không tìm thấy chiến dịch: ${campaignPath}`);
    process.exit(1);
  }

  const apiKey = process.env.GEMINI_API_KEY || '';
  if (!dryRun && !apiKey) {
    console.error('Thiếu GEMINI_API_KEY trong biến môi trường hoặc file .env (dùng --dry-run để kiểm tra thử).');
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

  const targets = campaign.scenes.filter((s) => {
    const isAi = s.type === 'ai-lifestyle' || s.type === 'ai-experience';
    if (!isAi) return false;
    return sceneFilter ? s.id === sceneFilter : true;
  });

  if (targets.length === 0) {
    console.log('Không có cảnh AI nào khớp điều kiện để xử lý.');
    return;
  }

  const ctx = { campaignDir, product, character, apiKey, dryRun };
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
