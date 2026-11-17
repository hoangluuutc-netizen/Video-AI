import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { execFile, execFileSync, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import { analyzeSampleVideo } from './analyze-sample-video.mjs';
import { generateCharacterSheet } from './generate-character-sheet.mjs';
import { uploadVideo, DEFAULT_MODEL } from './lib/gemini-client.mjs';
import { aiBreakdown } from './lib/video-forensics.mjs';
import { aiRemake, ollamaRemake, templateRemake } from './lib/video-remake.mjs';
import {
  listInstalledSkills,
  saveKolCharacter,
  generateKolPersona,
  generateKolScript,
  renderKolTalkingVideo
} from './lib/kol-studio.mjs';
import { maskEnvStatus, upsertEnvFile } from './lib/env-keys.mjs';
import { summarizeCostLedgers, previewBatchCsv } from './lib/batch-dashboard.mjs';
import { buildSystemReadiness } from './lib/system-readiness.mjs';
import { saveProductRecord } from './lib/product-store.mjs';
import { estimateVideoCost, normalizeCostSettings } from './lib/cost-ledger.mjs';
import { approveCampaignFile } from './kol-approve.mjs';
import {
  checkApiRequest,
  isLoopbackHost,
  isServableAssetPath,
  publicAiConfig,
  safeSlug,
  remotionCompositionId
} from './lib/dashboard-security.mjs';
import { normalizeToolChoices } from './lib/tool-choices.mjs';
import { getLocalToolsStatus } from './lib/local-tools-status.mjs';
import { analyzeSpeechTrack } from './lib/video-analyzer.mjs';
import { prepareForHeavyPhase } from './lib/resource-gate.mjs';
import { normalizeReelRow } from './lib/reel-sheet.mjs';
import { createJobQueue } from './lib/job-queue.mjs';
import { recordReelSheet } from './run-optimal-pipeline.mjs';

const execFileAsync = promisify(execFile);
const ROOT = process.cwd();
const PORT = Number(process.env.PORT || 4173);
// Chỉ nghe trên máy này. Muốn cho máy khác trong LAN dùng thì tự đặt DASHBOARD_HOST=0.0.0.0 (chấp nhận rủi ro).
const HOST = process.env.DASHBOARD_HOST || '127.0.0.1';
const LAN_MODE = !['127.0.0.1', 'localhost', '::1'].includes(HOST);
const MAX_BODY_BYTES = 400 * 1024 * 1024; // đủ cho video mẫu base64
const DASHBOARD_DIR = path.join(ROOT, 'dashboard');
const ASSETS_DIR = path.join(ROOT, 'assets');
const CAMPAIGNS_DIR = path.join(ROOT, 'campaigns');
const SHEET_PATH = path.join(ROOT, 'campaigns', 'reel-sheet.json');
const AI_CONFIG_PATH = path.join(ROOT, 'assets', 'brand-kit', 'ai-config.json');

const DEFAULT_AI_CONFIG = {
  llmModel: 'local-ecommerce-director',
  imageModel: 'ffmpeg-real-composite',
  videoModel: 'ffmpeg-bokeh-cinema',
  ttsModel: 'windows-sapi-vi',
  ttsVoice: 'Kore',
  renderEngine: 'ffmpeg-anchored-real',
  hasGeminiKey: false,
  selectiveAiCount: 1,
  maxCostUsdPerVideo: 0.5,
  subtitleAlignModel: 'heuristic-silence',
  subtitleStyle: 'box',
  xrayAudioModel: 'none'
};

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.csv': 'text/csv; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.mp4': 'video/mp4',
  '.mov': 'video/quicktime',
  '.m4v': 'video/mp4',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav'
};

function readJsonSafe(filePath, fallback) {
  try {
    if (!fs.existsSync(filePath)) return fallback;
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return fallback;
  }
}

function listSubdirs(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);
}

function loadAiConfig() {
  const saved = readJsonSafe(AI_CONFIG_PATH, {});
  const envPath = path.join(ROOT, '.env');
  let envRaw = '';
  if (fs.existsSync(envPath)) {
    envRaw = fs.readFileSync(envPath, 'utf8');
  }
  const hasEnv = (k) => Boolean(process.env[k]) || new RegExp(`${k}=\\S+`).test(envRaw);
  const envStatus = maskEnvStatus(envRaw, process.env);
  return {
    ...DEFAULT_AI_CONFIG,
    ...saved,
    envStatus,
    hasGeminiKey: Boolean(saved.geminiApiKey || envStatus.GEMINI_API_KEY),
    hasFalKey: Boolean(saved.falApiKey || envStatus.FAL_KEY),
    hasVbeeKey: Boolean(saved.vbeeApiKey || envStatus.VBEE_API_KEY),
    hasFptKey: Boolean(saved.fptApiKey || envStatus.FPT_API_KEY)
  };
}

function loadWorkspaceState() {
  const brand = readJsonSafe(path.join(ROOT, 'assets', 'brand-kit', 'brand.json'), {});
  const aiConfig = loadAiConfig();
  const products = listSubdirs(path.join(ROOT, 'assets', 'products'))
    .map((d) => readJsonSafe(path.join(ROOT, 'assets', 'products', d, 'product.json'), null))
    .filter(Boolean);
  const characters = listSubdirs(path.join(ROOT, 'assets', 'characters'))
    .map((d) => readJsonSafe(path.join(ROOT, 'assets', 'characters', d, 'character.json'), null))
    .filter(Boolean);
  const catalog = readJsonSafe(path.join(ROOT, 'assets', 'footage', 'catalog.json'), { clips: [] });
  const campaigns = listSubdirs(path.join(ROOT, 'campaigns'))
    .map((d) => readJsonSafe(path.join(ROOT, 'campaigns', d, 'campaign.json'), null))
    .filter(Boolean);
  const rawSheet = readJsonSafe(SHEET_PATH, { reels: [] });
  const sheet = { reels: (Array.isArray(rawSheet) ? rawSheet : rawSheet.reels || []).map(normalizeReelRow) };

  let sampleAnalysis = null;
  const firstClipId = catalog.clips?.[0]?.id;
  if (firstClipId) {
    const anaPath = path.join(ROOT, 'assets', 'footage', 'analysis', firstClipId, 'analysis.json');
    if (fs.existsSync(anaPath)) {
      sampleAnalysis = readJsonSafe(anaPath, null);
    } else {
      try {
        sampleAnalysis = analyzeSampleVideo({
          videoArg: firstClipId,
          productId: products[0]?.id || 'sample-product',
          characterId: characters[0]?.id || 'sample-kol'
        });
      } catch {
        sampleAnalysis = null;
      }
    }
  }

  const veo3PackPath = path.join(ROOT, 'campaigns', 'sample-campaign', 'veo3-prompts.json');
  const veo3PromptsPack = fs.existsSync(veo3PackPath) ? readJsonSafe(veo3PackPath, null) : null;

  const musePackPath = path.join(ROOT, 'campaigns', 'sample-campaign', 'muse-ai-pack.json');
  const museAiPack = fs.existsSync(musePackPath) ? readJsonSafe(musePackPath, null) : null;

  // Không gửi API key về trình duyệt — giao diện chỉ cần cờ has*/envStatus
  return { brand, aiConfig: publicAiConfig(aiConfig), products, characters, catalog, campaigns, sheet, sampleAnalysis, veo3PromptsPack, museAiPack };
}

function sendJson(res, status, payload) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(payload));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(new Error(`Dữ liệu gửi lên quá lớn (> ${Math.round(MAX_BODY_BYTES / 1048576)} MB).`));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      try {
        const raw = Buffer.concat(chunks).toString('utf8');
        resolve(raw ? JSON.parse(raw) : {});
      } catch (e) {
        reject(e);
      }
    });
    req.on('error', reject);
  });
}

function sanitizeFileName(name) {
  return path.basename(String(name || 'upload.bin')).replace(/[^a-zA-Z0-9._-]/g, '-');
}

// Mọi script nặng đi qua 1 hàng đợi tuần tự, chạy bất đồng bộ: trước đây execFileSync treo cả server
// (Auto-Pilot/dựng 3 tỷ lệ mất vài phút → KOL Studio, trạng thái lô... đều đứng chờ).
const heavyJobs = createJobQueue();

function runScript(scriptRel, args = []) {
  return heavyJobs.run(async () => {
    const startMs = Date.now();
    const elapsedSec = () => ((Date.now() - startMs) / 1000).toFixed(1);
    try {
      const { stdout, stderr } = await execFileAsync(process.execPath, [path.join(ROOT, scriptRel), ...args], {
        cwd: ROOT,
        encoding: 'utf8',
        windowsHide: true,
        maxBuffer: 64 * 1024 * 1024
      });
      // Cảnh báo (console.warn → stderr) trước đây bị nuốt khi script chạy thành công
      return { ok: true, elapsedSec: elapsedSec(), output: [stdout.trim(), stderr.trim()].filter(Boolean).join('\n') };
    } catch (e) {
      const msg = [e.stdout, e.stderr, e.message].filter(Boolean).join('\n').trim();
      return { ok: false, elapsedSec: elapsedSec(), output: msg };
    }
  });
}

function buildLocalKeyframesFromRealImages(campaignRel) {
  const campAbs = path.join(ROOT, campaignRel);
  const campaign = readJsonSafe(campAbs, null);
  if (!campaign) return { ok: false, output: 'Không tìm thấy campaign.json' };
  const campDir = path.dirname(campAbs);
  const product = readJsonSafe(path.join(ROOT, 'assets', 'products', campaign.productId, 'product.json'), {});
  const character = readJsonSafe(path.join(ROOT, 'assets', 'characters', campaign.characterId, 'character.json'), {});

  const findExisting = (obj) => {
    for (const rel of Object.values(obj || {})) {
      if (!rel) continue;
      const abs = path.isAbsolute(rel) ? rel : path.join(ROOT, rel);
      if (fs.existsSync(abs)) return abs;
    }
    return '';
  };

  const prodImg = findExisting(product.referenceImages);
  const charImg = findExisting(character.referenceImages);
  const kfDir = path.join(campDir, 'media', 'keyframes');
  fs.mkdirSync(kfDir, { recursive: true });

  const logs = [];
  for (const scene of campaign.scenes) {
    const outPng = path.join(kfDir, `${scene.id}.png`);
    if (charImg && prodImg && charImg !== prodImg) {
      execFileSync('ffmpeg', [
        '-y', '-v', 'error',
        '-f', 'lavfi', '-i', 'color=c=0x0F172A:s=1080x1920:d=1',
        '-i', charImg,
        '-i', prodImg,
        '-filter_complex',
        '[1:v]scale=920:820:force_original_aspect_ratio=decrease[c];[2:v]scale=760:680:force_original_aspect_ratio=decrease[p];[0:v][c]overlay=(W-w)/2:140[bg];[bg][p]overlay=(W-w)/2:1020',
        '-frames:v', '1', outPng
      ]);
      logs.push(`Đã ghép Keyframe từ Ảnh Người thật + Ảnh SP thật: ${scene.id}.png`);
    } else if (prodImg || charImg) {
      const src = prodImg || charImg;
      execFileSync('ffmpeg', [
        '-y', '-v', 'error',
        '-f', 'lavfi', '-i', 'color=c=0x0F172A:s=1080x1920:d=1',
        '-i', src,
        '-filter_complex',
        '[1:v]scale=980:1480:force_original_aspect_ratio=decrease[fg];[0:v][fg]overlay=(W-w)/2:(H-h)/2',
        '-frames:v', '1', outPng
      ]);
      logs.push(`Đã tạo Keyframe chuẩn từ ảnh gốc: ${scene.id}.png`);
    } else {
      execFileSync('ffmpeg', [
        '-y', '-v', 'error',
        '-f', 'lavfi', '-i', 'color=c=0x0F172A:s=1080x1920:d=1',
        '-frames:v', '1', outPng
      ]);
      logs.push(`Đã tạo khung nền studio cho ${scene.id}.png (hãy kéo thả ảnh Người thật & SP thật để ghép ảnh thật)`);
    }
    scene.keyframeSrc = path.posix.join('media', 'keyframes', `${scene.id}.png`);
    scene.qcStatus = 'approved';
  }
  fs.writeFileSync(campAbs, JSON.stringify(campaign, null, 2) + '\n', 'utf8');
  return { ok: true, output: logs.join('\n') };
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://localhost:${PORT}`);

  // Chặn máy lạ / trang web lạ / DNS rebinding trước mọi xử lý (scripts/lib/dashboard-security.mjs)
  if (url.pathname.startsWith('/api/')) {
    const guard = checkApiRequest({ method: req.method, headers: req.headers, port: PORT, allowAnyHost: LAN_MODE });
    if (!guard.ok) return sendJson(res, guard.status, { ok: false, output: guard.reason });
  } else if (!LAN_MODE && !isLoopbackHost(req.headers.host, PORT)) {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    return res.end('Từ chối: chỉ truy cập qua localhost.');
  }

  if (req.method === 'GET' && url.pathname === '/api/state') {
    return sendJson(res, 200, loadWorkspaceState());
  }

  if (req.method === 'POST' && url.pathname === '/api/save-ai-config') {
    try {
      const body = await readBody(req);
      const current = readJsonSafe(AI_CONFIG_PATH, DEFAULT_AI_CONFIG);
      const updated = {
        ...current,
        llmModel: body.llmModel || current.llmModel,
        imageModel: body.imageModel || current.imageModel,
        videoModel: body.videoModel || current.videoModel,
        ttsModel: body.ttsModel || current.ttsModel,
        ttsVoice: body.ttsVoice || current.ttsVoice,
        renderEngine: body.renderEngine || current.renderEngine,
        selectiveAiOnly: body.selectiveAiOnly !== undefined ? Boolean(body.selectiveAiOnly) : current.selectiveAiOnly,
        ...normalizeCostSettings(body, current),
        ...normalizeToolChoices(body, current)
      };
      if (body.geminiApiKey !== undefined && body.geminiApiKey.trim() !== '') {
        updated.geminiApiKey = body.geminiApiKey.trim();
        process.env.GEMINI_API_KEY = updated.geminiApiKey;
      }
      if (body.falApiKey !== undefined && body.falApiKey.trim() !== '') {
        updated.falApiKey = body.falApiKey.trim();
        process.env.FAL_KEY = updated.falApiKey;
      }
      if (body.vbeeApiKey !== undefined && body.vbeeApiKey.trim() !== '') {
        updated.vbeeApiKey = body.vbeeApiKey.trim();
        process.env.VBEE_API_KEY = updated.vbeeApiKey;
      }
      if (body.fptApiKey !== undefined && body.fptApiKey.trim() !== '') {
        updated.fptApiKey = body.fptApiKey.trim();
        process.env.FPT_API_KEY = updated.fptApiKey;
      }
      upsertEnvFile(
        path.join(ROOT, '.env'),
        {
          GEMINI_API_KEY: body.geminiApiKey,
          FAL_KEY: body.falApiKey,
          VBEE_API_KEY: body.vbeeApiKey,
          VBEE_APP_ID: body.vbeeAppId,
          FPT_API_KEY: body.fptApiKey,
          ELEVENLABS_API_KEY: body.elevenlabsApiKey,
          PHOTOROOM_API_KEY: body.photoroomApiKey
        },
        { examplePath: path.join(ROOT, '.env.example') }
      );
      fs.mkdirSync(path.dirname(AI_CONFIG_PATH), { recursive: true });
      fs.writeFileSync(AI_CONFIG_PATH, JSON.stringify(updated, null, 2) + '\n', 'utf8');
      return sendJson(res, 200, {
        ok: true,
        output: `Đã lưu cấu hình Bộ não AI & Công cụ (${updated.llmModel} | ${updated.imageModel} | ${updated.videoModel} | ${updated.ttsModel}).`,
        state: loadWorkspaceState()
      });
    } catch (e) {
      return sendJson(res, 500, { ok: false, output: e.message });
    }
  }

  if (req.method === 'POST' && url.pathname === '/api/save-env-keys') {
    try {
      const body = await readBody(req);
      const resEnv = upsertEnvFile(path.join(ROOT, '.env'), body, { examplePath: path.join(ROOT, '.env.example') });
      for (const k of resEnv.applied) {
        if (body[k]) process.env[k] = String(body[k]).trim();
      }
      return sendJson(res, 200, {
        ok: true,
        applied: resEnv.applied,
        output: resEnv.applied.length
          ? `Đã lưu ${resEnv.applied.length} API Key vào .env (${resEnv.applied.join(', ')}).`
          : 'Không có API Key mới nào được nhập — giữ nguyên các key hiện có trong .env.',
        state: loadWorkspaceState()
      });
    } catch (e) {
      return sendJson(res, 500, { ok: false, output: e.message });
    }
  }

  if (req.method === 'GET' && url.pathname === '/api/local-tools/status') {
    try {
      return sendJson(res, 200, { ok: true, ...(await getLocalToolsStatus(loadAiConfig(), { root: ROOT })) });
    } catch (e) {
      return sendJson(res, 500, { ok: false, output: e.message });
    }
  }

  if (req.method === 'GET' && url.pathname === '/api/system-readiness') {
    try {
      const aiConfig = loadAiConfig();
      const toolsStatus = await getLocalToolsStatus(aiConfig, { root: ROOT });
      const musicDir = path.join(ASSETS_DIR, 'music');
      const musicCount = fs.existsSync(musicDir)
        ? fs.readdirSync(musicDir).filter((f) => /\.(mp3|wav|m4a|ogg)$/i.test(f)).length
        : 0;
      const readiness = buildSystemReadiness({
        toolsStatus,
        aiConfig,
        counts: {
          products: listSubdirs(path.join(ASSETS_DIR, 'products')).length,
          characters: listSubdirs(path.join(ASSETS_DIR, 'characters')).length,
          campaigns: listSubdirs(CAMPAIGNS_DIR).length
        },
        studioInstalled: fs.existsSync(path.join(ROOT, 'studio', 'node_modules')),
        musicCount
      });
      return sendJson(res, 200, { ok: true, ...readiness });
    } catch (e) {
      return sendJson(res, 500, { ok: false, output: e.message });
    }
  }

  if (req.method === 'POST' && url.pathname === '/api/studio/render') {
    try {
      const body = await readBody(req);
      const cid = String(body.campaignId || 'sample-campaign').replace(/[^a-z0-9-]/gi, '');
      const ratio = ['9x16', '1x1', '16x9'].includes(body.ratio) ? body.ratio : '9x16';
      const campRel = path.posix.join('campaigns', cid, 'campaign.json');
      if (!fs.existsSync(path.join(ROOT, campRel))) {
        return sendJson(res, 404, { ok: false, output: `Không tìm thấy chiến dịch ${cid}.` });
      }
      // runScript không ném lỗi → phải tự kiểm ok (trước đây gọi runNodeScript không tồn tại → endpoint luôn hỏng)
      const synced = await runScript('scripts/sync-studio.mjs', [campRel]);
      if (!synced.ok) return sendJson(res, 500, { ok: false, output: `Đồng bộ Remotion lỗi: ${synced.output}` });
      // Id phải khớp <Composition> trong studio/src/Root.tsx (TikTok-9x16 / Facebook-1x1 / Web-16x9)
      const compId = remotionCompositionId(ratio);
      const outDir = path.join(CAMPAIGNS_DIR, cid, 'out');
      fs.mkdirSync(outDir, { recursive: true });
      const outMp4 = path.join(outDir, `remotion-${ratio}.mp4`);
      // Chạy thẳng CLI bằng node: từ Node 18.20/20.12 (CVE-2024-27980) execFile('npx.cmd') trên Windows báo EINVAL
      const remotionCli = path.join(ROOT, 'studio', 'node_modules', '@remotion', 'cli', 'remotion-cli.js');
      if (!fs.existsSync(remotionCli)) {
        return sendJson(res, 400, { ok: false, output: 'Chưa cài Remotion — chạy "npm install" trong thư mục studio/.' });
      }
      // Bất đồng bộ: render có thể mất vài phút, execFileSync sẽ treo cả Dashboard trong lúc đó
      await heavyJobs.run(() => execFileAsync(process.execPath, [remotionCli, 'render', 'src/index.ts', compId, outMp4], {
        cwd: path.join(ROOT, 'studio'),
        timeout: 1000 * 60 * 10,
        maxBuffer: 32 * 1024 * 1024,
        windowsHide: true
      }));
      return sendJson(res, 200, {
        ok: true,
        mediaUrl: `/campaigns/${cid}/out/remotion-${ratio}.mp4?t=${Date.now()}`,
        output: `Đã render xong Remotion ${compId}: campaigns/${cid}/out/remotion-${ratio}.mp4`
      });
    } catch (e) {
      return sendJson(res, 500, { ok: false, output: `Lỗi render Remotion: ${e.message}` });
    }
  }

  if (req.method === 'POST' && url.pathname === '/api/xray-speech') {
    try {
      const body = await readBody(req);
      const aiCfg = loadAiConfig();
      const model = body.model || aiCfg.xrayAudioModel || 'none';
      if (model === 'none') throw new Error('Chọn công cụ "Tách nhạc & bóc băng" trong Bộ não & chi phí trước (đang là "Không tách").');
      const clipId = String(body.clipId || '').replace(/[^a-zA-Z0-9_-]/g, '');
      const anaPath = path.join(ASSETS_DIR, 'footage', 'analysis', clipId, 'analysis.json');
      if (!clipId || !fs.existsSync(anaPath)) throw new Error('Chưa có analysis.json — phân tích video mẫu trước.');
      const analysis = readJsonSafe(anaPath, null);
      const videoAbs = path.join(ROOT, analysis.sampleVideo?.filePath || '');
      if (!fs.existsSync(videoAbs)) throw new Error(`Không thấy video mẫu ${analysis.sampleVideo?.filePath}.`);
      await prepareForHeavyPhase({ label: 'X-Ray lời thoại', minFreeGb: 6 });
      const speech = await analyzeSpeechTrack(videoAbs, {
        durationSec: analysis.sampleVideo?.durationSec,
        shots: analysis.xray?.shots || [],
        model,
        root: ROOT,
        workDir: path.join(ASSETS_DIR, 'footage', 'analysis', clipId, 'speech')
      });
      if (!speech) throw new Error('Không bóc băng được lời thoại (xem log máy chủ: thiếu công cụ hoặc VoiceStudio chưa chạy).');
      analysis.xray = { ...(analysis.xray || {}), speech };
      fs.writeFileSync(anaPath, JSON.stringify(analysis, null, 2) + '\n', 'utf8');
      return sendJson(res, 200, { ok: true, output: `Đã bóc băng lời thoại (${speech.tool}): ${speech.wordsPerSec} từ/giây.`, speech, state: loadWorkspaceState() });
    } catch (e) {
      return sendJson(res, 400, { ok: false, output: e.message });
    }
  }

  if (req.method === 'POST' && url.pathname === '/api/cost-estimate') {
    try {
      const body = await readBody(req);
      return sendJson(res, 200, {
        ok: true,
        ...estimateVideoCost({
          imageModel: body.imageModel,
          videoModel: body.videoModel,
          ttsModel: body.ttsModel,
          aiSceneCount: body.aiSceneCount,
          maxUsd: body.maxCostUsdPerVideo
        })
      });
    } catch (e) {
      return sendJson(res, 500, { ok: false, output: e.message });
    }
  }

  if (req.method === 'POST' && url.pathname === '/api/open-file') {
    try {
      const { filePath, openDirect } = await readBody(req);
      const rel = String(filePath || '').replace(/^\/+/, '');
      const abs = path.normalize(path.join(ROOT, rel));
      if (!abs.startsWith(ROOT)) {
        return sendJson(res, 400, { ok: false, output: 'Đường dẫn nằm ngoài thư mục dự án.' });
      }
      const targetToOpen = fs.existsSync(abs) ? abs : path.dirname(abs);
      if (process.platform === 'win32') {
        if (openDirect && fs.existsSync(abs) && !fs.statSync(abs).isDirectory()) {
          spawn('cmd.exe', ['/c', 'start', '', abs], { detached: true, stdio: 'ignore' }).unref();
        } else if (fs.existsSync(abs) && !fs.statSync(abs).isDirectory()) {
          spawn('explorer.exe', [`/select,${abs}`], { detached: true, stdio: 'ignore' }).unref();
        } else if (fs.existsSync(targetToOpen)) {
          spawn('explorer.exe', [targetToOpen], { detached: true, stdio: 'ignore' }).unref();
        }
      }
      let previewText = '';
      if (fs.existsSync(abs) && !fs.statSync(abs).isDirectory()) {
        const ext = path.extname(abs).toLowerCase();
        if (['.json', '.md', '.csv', '.txt', '.example'].includes(ext)) {
          previewText = fs.readFileSync(abs, 'utf8').slice(0, 4000);
        }
      }
      return sendJson(res, 200, {
        ok: true,
        exists: fs.existsSync(abs),
        absPath: abs,
        previewText,
        output: fs.existsSync(abs)
          ? `Đã mở vị trí file: ${rel}`
          : `File "${rel}" chưa được tạo (đã mở thư mục chứa: ${path.relative(ROOT, targetToOpen)}).`
      });
    } catch (e) {
      return sendJson(res, 500, { ok: false, output: e.message });
    }
  }

  if (req.method === 'POST' && url.pathname === '/api/upload-asset') {
    try {
      const { kind, targetId, slot, fileName, dataBase64 } = await readBody(req);
      if (!dataBase64) {
        return sendJson(res, 400, { ok: false, output: 'Thiếu dữ liệu file tải lên.' });
      }
      const cleanName = sanitizeFileName(fileName);
      const base64Payload = dataBase64.includes(',') ? dataBase64.split(',')[1] : dataBase64;
      const buffer = Buffer.from(base64Payload, 'base64');

      // targetId thành tên thư mục → chỉ nhận slug an toàn (chặn ../ ghi ra ngoài assets/)
      if (targetId !== undefined && targetId !== null && targetId !== '' && !safeSlug(targetId)) {
        return sendJson(res, 400, { ok: false, output: `Mã đích không hợp lệ: "${targetId}" (chỉ chữ thường, số, "-", "_").` });
      }
      if (kind === 'product') {
        const pid = safeSlug(targetId) || 'sample-product';
        const prodDir = path.join(ROOT, 'assets', 'products', pid);
        fs.mkdirSync(prodDir, { recursive: true });
        const destAbs = path.join(prodDir, cleanName);
        fs.writeFileSync(destAbs, buffer);
        const relPath = path.posix.join('assets', 'products', pid, cleanName);

        const pJsonPath = path.join(prodDir, 'product.json');
        if (fs.existsSync(pJsonPath)) {
          const pData = readJsonSafe(pJsonPath, {});
          pData.referenceImages = pData.referenceImages || {};
          pData.referenceImages[slot || 'front'] = relPath;
          fs.writeFileSync(pJsonPath, JSON.stringify(pData, null, 2) + '\n', 'utf8');
        }
        return sendJson(res, 200, {
          ok: true,
          relPath,
          output: `Đã lưu ảnh sản phẩm thật tại ${relPath}`,
          state: loadWorkspaceState()
        });
      }

      if (kind === 'character') {
        const cid = safeSlug(targetId) || 'sample-kol';
        const charDir = path.join(ROOT, 'assets', 'characters', cid);
        fs.mkdirSync(charDir, { recursive: true });
        const destAbs = path.join(charDir, cleanName);
        fs.writeFileSync(destAbs, buffer);
        const relPath = path.posix.join('assets', 'characters', cid, cleanName);

        const cJsonPath = path.join(charDir, 'character.json');
        if (fs.existsSync(cJsonPath)) {
          const cData = readJsonSafe(cJsonPath, {});
          cData.referenceImages = cData.referenceImages || {};
          cData.referenceImages[slot || 'portrait'] = relPath;
          fs.writeFileSync(cJsonPath, JSON.stringify(cData, null, 2) + '\n', 'utf8');
        }
        return sendJson(res, 200, {
          ok: true,
          relPath,
          output: `Đã lưu ảnh người thật tại ${relPath}`,
          state: loadWorkspaceState()
        });
      }

      if (kind === 'footage') {
        const footageDir = path.join(ROOT, 'assets', 'footage');
        fs.mkdirSync(footageDir, { recursive: true });
        const destAbs = path.join(footageDir, cleanName);
        fs.writeFileSync(destAbs, buffer);
        const relPath = path.posix.join('assets', 'footage', cleanName);
        const ingestRes = await runScript('scripts/ingest-footage.mjs');
        const clipId = path.basename(cleanName, path.extname(cleanName)).toLowerCase().replace(/[^a-z0-9]+/g, '-');
        let sampleAnalysis = null;
        try {
          sampleAnalysis = analyzeSampleVideo({
            videoArg: clipId,
            productId: 'sample-product',
            characterId: 'sample-kol'
          });
        } catch {
          // ignore if probe fails
        }
        return sendJson(res, 200, {
          ok: true,
          relPath,
          clipId,
          sampleAnalysis,
          output: `Đã lưu & phân tích Video Mẫu tại ${relPath}\n${ingestRes.output}\n${sampleAnalysis ? '→ Ý tưởng rút ra: ' + sampleAnalysis.extractedIdea : ''}`,
          state: loadWorkspaceState()
        });
      }

      if (kind === 'music') {
        const musicDir = path.join(ROOT, 'assets', 'music');
        fs.mkdirSync(musicDir, { recursive: true });
        const destAbs = path.join(musicDir, cleanName);
        fs.writeFileSync(destAbs, buffer);
        const relPath = path.posix.join('assets', 'music', cleanName);
        return sendJson(res, 200, {
          ok: true,
          relPath,
          output: `Đã lưu nhạc nền Auto-Ducking tại ${relPath}`,
          state: loadWorkspaceState()
        });
      }

      return sendJson(res, 400, { ok: false, output: `Loại tài sản không hợp lệ: ${kind}` });
    } catch (e) {
      return sendJson(res, 500, { ok: false, output: e.message });
    }
  }

  if (req.method === 'POST' && url.pathname === '/api/analyze-sample-video') {
    const startMs = Date.now();
    try {
      const { clipId, productId, characterId } = await readBody(req);
      const ana = analyzeSampleVideo({
        videoArg: clipId || '',
        productId: productId || 'sample-product',
        characterId: characterId || 'sample-kol'
      });
      const st = loadWorkspaceState();
      st.sampleAnalysis = ana;
      return sendJson(res, 200, {
        ok: true,
        elapsedSec: ((Date.now() - startMs) / 1000).toFixed(1),
        sampleAnalysis: ana,
        output: `Đã phân tích Video Mẫu "${ana.sampleVideo.clipId}" (${ana.sampleVideo.durationSec}s, ${ana.sampleVideo.width}×${ana.sampleVideo.height}).\n→ Đã rút ra ý tưởng & phương án thay thế bằng Sản phẩm "${ana.targetReplacement.productName}" và Nhân vật "${ana.targetReplacement.characterName}"!`,
        state: st
      });
    } catch (e) {
      return sendJson(res, 500, { ok: false, output: e.message });
    }
  }

  if (req.method === 'POST' && (url.pathname === '/api/import-url' || url.pathname === '/api/fetch-sample-url')) {
    try {
      const { videoUrl, productId, characterId } = await readBody(req);
      if (!videoUrl || !/^https?:\/\/.+/i.test(videoUrl.trim())) {
        return sendJson(res, 400, { ok: false, output: 'URL video không hợp lệ (cần bắt đầu bằng http:// hoặc https://).' });
      }
      const slug = `url-${Date.now()}`;
      const outFile = path.join(ROOT, 'assets', 'footage', `${slug}.mp4`);
      try {
        await heavyJobs.run(() =>
          execFileAsync('yt-dlp', ['-f', 'mp4/best[ext=mp4]/best', '--no-playlist', '-o', outFile, videoUrl.trim()], {
            encoding: 'utf8',
            timeout: 60000,
            windowsHide: true
          })
        );
      } catch (err) {
        const msg = String(err.message || '');
        if (msg.includes('ENOENT') || msg.includes('not recognized')) {
          return sendJson(res, 400, {
            ok: false,
            output: 'Máy chưa cài yt-dlp. Hãy chạy `winget install yt-dlp` trong PowerShell hoặc tải video MP4 về rồi kéo thả vào Mục 05.'
          });
        }
        return sendJson(res, 500, { ok: false, output: `Không tải được video từ URL: ${msg}` });
      }
      const ingested = await runScript('scripts/ingest-footage.mjs', ['--force']);
      if (!ingested.ok) return sendJson(res, 500, { ok: false, output: `Quét kho cảnh lỗi: ${ingested.output}` });
      const ana = analyzeSampleVideo({
        videoArg: slug,
        productId: productId || 'sample-product',
        characterId: characterId || 'sample-kol'
      });
      const st = loadWorkspaceState();
      st.sampleAnalysis = ana;
      return sendJson(res, 200, {
        ok: true,
        clipId: slug,
        sampleAnalysis: ana,
        output: `Đã tải video từ link và phân tích xong (${ana.sampleVideo.durationSec}s).`,
        state: st
      });
    } catch (e) {
      return sendJson(res, 500, { ok: false, output: e.message });
    }
  }

  if (req.method === 'POST' && url.pathname === '/api/xray-ai') {
    const startMs = Date.now();
    try {
      const { clipId, productId, characterId } = await readBody(req);
      const aiCfg = fs.existsSync(AI_CONFIG_PATH) ? JSON.parse(fs.readFileSync(AI_CONFIG_PATH, 'utf8')) : {};
      const apiKey = aiCfg.geminiApiKey || process.env.GEMINI_API_KEY || '';
      if (!apiKey) {
        return sendJson(res, 400, {
          ok: false,
          output: 'Chưa cấu hình GEMINI_API_KEY (hãy nhập trong "Cài đặt Bộ não & Công cụ" hoặc file .env).'
        });
      }

      const ana = analyzeSampleVideo({
        videoArg: clipId || '',
        productId: productId || 'sample-product',
        characterId: characterId || 'sample-kol'
      });
      const videoAbs = path.join(ROOT, ana.sampleVideo.filePath);
      if (!fs.existsSync(videoAbs)) {
        return sendJson(res, 404, { ok: false, output: `Không tìm thấy file video mẫu: ${ana.sampleVideo.filePath}` });
      }

      const model = aiCfg.llmModel || DEFAULT_MODEL;
      const uploaded = await uploadVideo(apiKey, videoAbs);
      const breakdown = await aiBreakdown(apiKey, uploaded, ana.xray, { model });

      ana.breakdown = breakdown;
      const anaOut = path.join(ROOT, 'assets', 'footage', 'analysis', ana.sampleVideo.clipId, 'analysis.json');
      fs.writeFileSync(anaOut, JSON.stringify(ana, null, 2) + '\n', 'utf8');

      const st = loadWorkspaceState();
      st.sampleAnalysis = ana;
      return sendJson(res, 200, {
        ok: true,
        elapsedSec: ((Date.now() - startMs) / 1000).toFixed(1),
        breakdown,
        sampleAnalysis: ana,
        output: `Đã giải phẫu sâu Gemini (${model}) cho "${ana.sampleVideo.clipId}": nhận diện khung ${breakdown.framework || 'AIDA'}, ${breakdown.shots?.length || 0} cảnh chi tiết.`,
        state: st
      });
    } catch (e) {
      return sendJson(res, 500, { ok: false, output: `Lỗi Giải phẫu Gemini: ${e.message}` });
    }
  }

  if (req.method === 'POST' && url.pathname === '/api/ai-remake') {
    const startMs = Date.now();
    try {
      const { clipId, productId, category, style } = await readBody(req);
      const aiCfg = fs.existsSync(AI_CONFIG_PATH) ? JSON.parse(fs.readFileSync(AI_CONFIG_PATH, 'utf8')) : {};
      const apiKey = aiCfg.geminiApiKey || process.env.GEMINI_API_KEY || '';
      const anaPath = path.join(ROOT, 'assets', 'footage', 'analysis', clipId || 'video-m-u', 'analysis.json');
      if (!fs.existsSync(anaPath)) {
        return sendJson(res, 404, { ok: false, output: 'Chưa có dữ liệu phân tích video mẫu. Hãy bấm "1. Phân Tích Video Mẫu" trước.' });
      }
      const ana = JSON.parse(fs.readFileSync(anaPath, 'utf8'));
      const prodPath = path.join(ROOT, 'assets', 'products', productId || 'sample-product', 'product.json');
      const prod = fs.existsSync(prodPath) ? JSON.parse(fs.readFileSync(prodPath, 'utf8')) : { name: 'Sản phẩm' };
      const productInput = {
        name: prod.name,
        category: category || prod.category || 'home',
        style: style || prod.style || 'ugc-iphone',
        usp: Array.isArray(prod.highlights) ? prod.highlights.join(', ') : '',
        offer: prod.salePrice ? `Ưu đãi còn ${prod.salePrice}` : '',
        pain: ''
      };

      const chosenLlm = aiCfg.llmModel || DEFAULT_MODEL;
      const useOllama = String(chosenLlm).startsWith('ollama:');
      let remake;
      let engineLabel = 'Template chuẩn';
      if (useOllama) {
        remake = await ollamaRemake({
          model: chosenLlm,
          xray: ana.xray || { shots: [] },
          breakdown: ana.breakdown || null,
          product: productInput,
          baseUrl: aiCfg.ollamaBaseUrl
        });
        engineLabel = `Ollama Local (${chosenLlm})`;
      } else if (apiKey) {
        remake = await aiRemake(apiKey, {
          model: chosenLlm,
          xray: ana.xray || { shots: [] },
          breakdown: ana.breakdown || null,
          product: productInput
        });
        engineLabel = 'Gemini AI';
      } else {
        remake = templateRemake(ana.xray || { shots: [] }, ana.breakdown || null, productInput);
      }

      return sendJson(res, 200, {
        ok: true,
        elapsedSec: ((Date.now() - startMs) / 1000).toFixed(1),
        usedAi: Boolean(useOllama || apiKey),
        remake,
        output: `Đã nhân bản công thức (${engineLabel}) cho "${prod.name}" (${remake.shots?.length || 0} cảnh).`
      });
    } catch (e) {
      return sendJson(res, 500, { ok: false, output: `Lỗi nhân bản kịch bản: ${e.message}` });
    }
  }

  if (req.method === 'POST' && url.pathname === '/api/character-sheet') {
    try {
      const { characterId } = await readBody(req);
      const resSheet = await generateCharacterSheet(characterId || 'sample-kol');
      return sendJson(res, 200, {
        ok: true,
        ...resSheet,
        output: `Đã tạo Bộ Ảnh Nhân Vật 4 Góc (${resSheet.method}): ${resSheet.relPath}`,
        state: loadWorkspaceState()
      });
    } catch (e) {
      return sendJson(res, 500, { ok: false, output: `Lỗi tạo Bộ Ảnh Nhân Vật: ${e.message}` });
    }
  }

  // ===== KOL AI STUDIO ENDPOINTS =====
  if (req.method === 'GET' && url.pathname === '/api/kol/skills') {
    return sendJson(res, 200, { ok: true, skills: listInstalledSkills() });
  }

  if (req.method === 'POST' && url.pathname === '/api/kol/save') {
    try {
      const body = await readBody(req);
      const saved = saveKolCharacter(body);
      return sendJson(res, 200, {
        ...saved,
        output: `Đã lưu hồ sơ KOL AI tại ${saved.relPath}`,
        state: loadWorkspaceState()
      });
    } catch (e) {
      return sendJson(res, 400, { ok: false, output: e.message });
    }
  }

  if (req.method === 'POST' && url.pathname === '/api/kol/generate-persona') {
    try {
      const body = await readBody(req);
      const aiConfig = loadAiConfig();
      const apiKey = process.env.GEMINI_API_KEY || '';
      const persona = await generateKolPersona({ ...body, aiConfig, apiKey });
      return sendJson(res, 200, { ok: true, persona, output: `Đã sinh hồ sơ KOL AI (${persona.engine}).` });
    } catch (e) {
      return sendJson(res, 500, { ok: false, output: e.message });
    }
  }

  if (req.method === 'POST' && url.pathname === '/api/kol/generate-script') {
    try {
      const body = await readBody(req);
      const state = loadWorkspaceState();
      const character = state.characters.find((c) => c.id === body.characterId) || body.character || state.characters[0];
      const product = body.productId ? state.products.find((p) => p.id === body.productId) : null;
      const aiConfig = loadAiConfig();
      const apiKey = process.env.GEMINI_API_KEY || '';
      const script = await generateKolScript({
        character,
        product,
        topic: body.topic,
        platform: body.platform,
        durationSec: body.durationSec,
        aiConfig,
        apiKey
      });
      return sendJson(res, 200, { ok: true, script, output: `Đã sinh kịch bản KOL (${script.engine}) — ${script.wordCount} từ (~${script.estimatedSec}s).` });
    } catch (e) {
      return sendJson(res, 500, { ok: false, output: e.message });
    }
  }

  if (req.method === 'POST' && url.pathname === '/api/kol/approve') {
    try {
      const body = await readBody(req);
      const campaignId = String(body.campaignId || '').trim();
      if (!/^[a-z0-9][a-z0-9-]*$/i.test(campaignId)) throw new Error('campaignId không hợp lệ.');
      const campPath = path.join(CAMPAIGNS_DIR, campaignId, 'campaign.json');
      if (!fs.existsSync(campPath)) throw new Error(`Chưa có chiến dịch ${campaignId} — hãy dựng video KOL trước khi duyệt.`);
      const r = approveCampaignFile(campPath, body.approvedBy);
      return sendJson(res, 200, {
        ok: true,
        before: r.before,
        output: r.required
          ? `Đã ghi "${r.approvedBy}" duyệt kịch bản ${campaignId}. Dựng lại video để bỏ dấu "BẢN NHÁP".`
          : `Đã ghi duyệt cho ${campaignId} (nhân vật này không nhân bản giọng người thật nên không bắt buộc).`
      });
    } catch (e) {
      return sendJson(res, 400, { ok: false, output: e.message });
    }
  }

  if (req.method === 'POST' && url.pathname === '/api/kol/render-video') {
    try {
      const body = await readBody(req);
      const state = loadWorkspaceState();
      const character = state.characters.find((c) => c.id === body.characterId);
      const product = body.productId ? state.products.find((p) => p.id === body.productId) : null;
      const rendered = await renderKolTalkingVideo({
        character,
        product,
        voiceText: body.voiceText,
        hookTitle: body.hookTitle,
        durationSec: body.durationSec,
        subtitleStyle: body.subtitleStyle || 'word-highlight'
      });
      return sendJson(res, 200, {
        ...rendered,
        output: `Đã dựng xong Video KOL AI 9:16 (${rendered.durationSec}s)!`
      });
    } catch (e) {
      return sendJson(res, 500, { ok: false, output: `Lỗi dựng Video KOL AI: ${e.message}` });
    }
  }

  if (req.method === 'POST' && url.pathname === '/api/kol/sync-studio') {
    try {
      const body = await readBody(req);
      const kolId = String(body.characterId || '').replace(/[^a-z0-9-]/g, '');
      if (!kolId) throw new Error('Thiếu characterId.');
      const campRel = path.posix.join('campaigns', `kol-${kolId}`, 'campaign.json');
      if (!fs.existsSync(path.join(ROOT, campRel))) {
        throw new Error(`Chưa có chiến dịch kol-${kolId}. Hãy bấm "Dựng Video KOL AI" trước khi đồng bộ.`);
      }
      const result = await runScript('scripts/sync-studio.mjs', [campRel]);
      if (!result.ok) throw new Error(`Đồng bộ Remotion lỗi: ${result.output}`);
      return sendJson(res, 200, { ok: true, output: result.output || `Đã đồng bộ kol-${kolId} sang Remotion Studio.` });
    } catch (e) {
      return sendJson(res, 400, { ok: false, output: e.message });
    }
  }

  if (req.method === 'POST' && url.pathname === '/api/kol/lipsync-ai') {
    try {
      const body = await readBody(req);
      const aiConfig = loadAiConfig();
      if (!aiConfig.hasGeminiKey && !aiConfig.hasFalKey) {
        return sendJson(res, 400, {
          ok: false,
          missingKey: true,
          output: 'Chưa có GEMINI_API_KEY hoặc FAL_KEY. Vui lòng nhập API Key tại "⚙️ Cài đặt Bộ não" trước khi gọi Veo 3.1 / Omni 1.2 / Kling.'
        });
      }
      const state = loadWorkspaceState();
      const character = state.characters.find((c) => c.id === body.characterId);
      if (!character) throw new Error('Không tìm thấy hồ sơ KOL.');
      const campId = `kol-${character.id}`;
      const campDir = path.join(CAMPAIGNS_DIR, campId);
      const campPath = path.join(campDir, 'campaign.json');
      fs.mkdirSync(campDir, { recursive: true });
      const camp = readJsonSafe(campPath, {
        id: campId,
        title: `KOL AI Lip-Sync: ${character.name}`,
        productId: body.productId || 'sample-product',
        characterId: character.id,
        hook: body.hookTitle || character.name,
        scenes: []
      });
      camp.scenes = [
        {
          id: 'scene-1',
          type: 'ai-experience',
          durationSec: Math.min(8, Math.max(4, Number(body.durationSec || 5))),
          caption: body.hookTitle || character.name,
          voiceover: body.voiceText || character.catchphrase || '',
          customPrompt: body.veoLipSyncPrompt || '',
          qcStatus: 'pending'
        }
      ];
      fs.writeFileSync(campPath, JSON.stringify(camp, null, 2) + '\n', 'utf8');
      const campRel = path.posix.join('campaigns', campId, 'campaign.json');
      const result = await runScript('scripts/generate-media.mjs', [campRel, '--selective']);
      if (!result.ok) {
        return sendJson(res, 500, { ok: false, campaignId: campId, output: `Lỗi Lip-Sync AI: ${result.output}` });
      }
      return sendJson(res, 200, {
        ok: true,
        campaignId: campId,
        output: result.output || `Đã gửi yêu cầu tạo clip Lip-Sync AI cho ${character.name}.`
      });
    } catch (e) {
      return sendJson(res, 500, { ok: false, output: `Lỗi Lip-Sync AI: ${e.message}` });
    }
  }

  if (req.method === 'POST' && url.pathname === '/api/product/save') {
    try {
      const body = await readBody(req);
      const saved = saveProductRecord(body, { root: ROOT });
      return sendJson(res, 200, {
        ...saved,
        output: `Đã lưu sản phẩm "${saved.product.name}" tại ${saved.relPath}`,
        state: loadWorkspaceState()
      });
    } catch (e) {
      return sendJson(res, 400, { ok: false, output: e.message });
    }
  }

  if (req.method === 'POST' && url.pathname === '/api/save-campaign') {
    try {
      const body = await readBody(req);
      const campaign = body.campaign;
      if (!campaign || !campaign.id || !/^[a-z0-9-]+$/.test(campaign.id)) {
        return sendJson(res, 400, { ok: false, output: 'ID chiến dịch không hợp lệ (chỉ dùng chữ thường, số, dấu gạch ngang).' });
      }
      const targetDir = path.join(ROOT, 'campaigns', campaign.id);
      fs.mkdirSync(targetDir, { recursive: true });
      const campPath = path.join(targetDir, 'campaign.json');
      fs.writeFileSync(campPath, JSON.stringify(campaign, null, 2) + '\n', 'utf8');
      return sendJson(res, 200, {
        ok: true,
        output: `Đã lưu chiến dịch tại campaigns/${campaign.id}/campaign.json`,
        state: loadWorkspaceState()
      });
    } catch (e) {
      return sendJson(res, 500, { ok: false, output: e.message });
    }
  }

  if (req.method === 'POST' && url.pathname === '/api/run-action') {
    try {
      const { action, campaignId, museStyle } = await readBody(req);
      // campaignId thành tên thư mục → chặn ../
      if (campaignId && !safeSlug(campaignId)) {
        return sendJson(res, 400, { ok: false, output: `Mã chiến dịch không hợp lệ: "${campaignId}".` });
      }
      const cid = safeSlug(campaignId) || 'sample-campaign';
      const campRel = path.posix.join('campaigns', cid, 'campaign.json');
      let result;
      let mediaUrl = '';

      if (action === 'validate') {
        result = await runScript('scripts/validate-assets.mjs');
      } else if (action === 'ingest-footage') {
        result = await runScript('scripts/ingest-footage.mjs');
      } else if (action === 'analyze-sample') {
        const startMs = Date.now();
        try {
          const campData = readJsonSafe(path.join(ROOT, campRel), {});
          const ana = analyzeSampleVideo({
            videoArg: '',
            productId: campData.productId || 'sample-product',
            characterId: campData.characterId || 'sample-kol'
          });
          result = {
            ok: true,
            elapsedSec: ((Date.now() - startMs) / 1000).toFixed(1),
            sampleAnalysis: ana,
            output: `Đã phân tích Video Mẫu "${ana.sampleVideo.clipId}" (${ana.sampleVideo.durationSec}s, 4 phân cảnh).\nÝ tưởng rút ra: ${ana.extractedIdea}`
          };
        } catch (err) {
          result = {
            ok: false,
            elapsedSec: ((Date.now() - startMs) / 1000).toFixed(1),
            output: err.message
          };
        }
      } else if (action === 'generate-prompts' || action === 'generate-veo3-pack' || action === 'generate-muse-pack') {
        const styleArg = String(museStyle || '');
        if (styleArg) {
          await runScript('scripts/generate-muse-pack.mjs', [campRel, styleArg]);
        }
        result = await runScript('scripts/generate-prompts.mjs', [campRel]);
        const packPath = path.join(ROOT, 'campaigns', cid, 'veo3-prompts.json');
        if (fs.existsSync(packPath)) {
          result.veo3PromptsPack = readJsonSafe(packPath, null);
        }
      } else if (action === 'run-veo3-cloud') {
        const aiCfg = loadAiConfig();
        await runScript('scripts/generate-prompts.mjs', [campRel]);
        buildLocalKeyframesFromRealImages(campRel);
        if (aiCfg.hasGeminiKey) {
          process.env.GEMINI_VIDEO_MODEL = aiCfg.videoModel || 'veo-3.1-generate-001';
          result = await runScript('scripts/generate-media.mjs', [campRel, '--mode', 'video']);
        } else {
          result = await runScript('scripts/generate-media.mjs', [campRel, '--mode', 'video', '--dry-run']);
          result.output = `[CHẾ ĐỘ CHUẨN BỊ NGUYÊN LIỆU VEO 3.1]\nĐã khóa Keyframes (Ảnh Người thật + SP thật), cắt Clip mẫu 3s và xuất veo3-prompts.json!\n(Nếu muốn gọi trực tiếp API Cloud Veo 3.1 / Omni 1.2, hãy điền GEMINI_API_KEY tại mục Cài đặt Bộ não; hoặc bấm Copy Prompt Veo 3 bên dưới để dán vào Google Veo 3 / Flow).\n${result.output}`;
        }
      } else if (action === 'generate-voiceover') {
        result = await runScript('scripts/generate-voiceover.mjs', [campRel]);
        mediaUrl = `/campaigns/${cid}/media/audio/voiceover-full.mp3?t=${Date.now()}`;
      } else if (action === 'build-keyframes') {
        const aiCfg = loadAiConfig();
        if (aiCfg.hasGeminiKey && aiCfg.renderEngine === 'gemini-cloud') {
          result = await runScript('scripts/generate-media.mjs', [campRel, '--mode', 'keyframe']);
        } else {
          result = buildLocalKeyframesFromRealImages(campRel);
        }
      } else if (action === 'export-cutlist') {
        result = await runScript('scripts/export-cutlist.mjs', [campRel]);
      } else if (action === 'render-ffmpeg') {
        result = await runScript('scripts/export-cutlist.mjs', [campRel, '--render-ffmpeg']);
        mediaUrl = `/campaigns/${cid}/out/ffmpeg-9x16.mp4?t=${Date.now()}`;
      } else if (action === 'render-all-ratios') {
        result = await runScript('scripts/export-cutlist.mjs', [campRel, '--render-ffmpeg', '--ratio=all']);
        mediaUrl = `/campaigns/${cid}/out/ffmpeg-9x16.mp4?t=${Date.now()}`;
      } else if (action === 'record-reel') {
        // Cùng 1 hàm với Auto-Pilot/Batch: tôn trọng duyệt KOL ("CHỜ KOL DUYỆT") và nhãn "GIỌNG TẠM"
        const rec = recordReelSheet(path.join(ROOT, campRel));
        const row = loadWorkspaceState().sheet.reels.find((r) => r.id === rec.id);
        result = { ok: true, elapsedSec: '0.0', output: `Đã ghi Reel "${rec.id}" vào Sổ vận hành: ${row?.qcStatus || ''}` };
      } else if (action === 'sync-studio') {
        result = await runScript('scripts/sync-studio.mjs', [campRel]);
      } else if (action === 'verify-integrity') {
        result = await runScript('scripts/verify-integrity.mjs', [campRel]);
      } else if (action === 'run-optimal-pipeline') {
        buildLocalKeyframesFromRealImages(campRel);
        result = await runScript('scripts/run-optimal-pipeline.mjs', [campRel]);
        mediaUrl = `/campaigns/${cid}/out/ffmpeg-9x16.mp4?t=${Date.now()}`;
      } else {
        return sendJson(res, 400, { ok: false, output: `Hành động không hỗ trợ: ${action}` });
      }
      return sendJson(res, 200, { ...result, mediaUrl, state: loadWorkspaceState() });
    } catch (e) {
      return sendJson(res, 500, { ok: false, output: e.message });
    }
  }

  if (req.method === 'POST' && url.pathname === '/api/save-sheet') {
    try {
      const body = await readBody(req);
      const reels = (Array.isArray(body.reels) ? body.reels : []).map(normalizeReelRow);
      fs.mkdirSync(path.dirname(SHEET_PATH), { recursive: true });
      fs.writeFileSync(SHEET_PATH, JSON.stringify({ reels }, null, 2) + '\n', 'utf8');
      return sendJson(res, 200, { ok: true, output: `Đã lưu Sổ vận hành (${reels.length} reel).` });
    } catch (e) {
      return sendJson(res, 500, { ok: false, output: e.message });
    }
  }

  // ===== GIAI ĐOẠN 3: BATCH CSV & SỔ CHI PHÍ =====
  if (req.method === 'GET' && url.pathname === '/api/batch/status') {
    try {
      const csvPath = path.join(ASSETS_DIR, 'products', 'batch-template.csv');
      const csvText = fs.existsSync(csvPath) ? fs.readFileSync(csvPath, 'utf8') : '';
      const aiCfg = loadAiConfig();
      const preview = previewBatchCsv(csvText, aiCfg);
      const ledger = summarizeCostLedgers(CAMPAIGNS_DIR);
      return sendJson(res, 200, { ok: true, csvText, preview, ledger });
    } catch (e) {
      return sendJson(res, 500, { ok: false, output: e.message });
    }
  }

  if (req.method === 'POST' && url.pathname === '/api/batch/run') {
    try {
      const body = await readBody(req);
      const csvPath = path.join(ASSETS_DIR, 'products', 'batch-template.csv');
      if (typeof body.csvText === 'string' && body.csvText.trim()) {
        fs.writeFileSync(csvPath, body.csvText.trimEnd() + '\n', 'utf8');
      }
      const args = [path.posix.join('assets', 'products', 'batch-template.csv')];
      if (body.runPipeline) args.push('--run');
      if (body.resume !== false) args.push('--resume');
      const result = await runScript('scripts/batch-from-csv.mjs', args);
      const aiCfg = loadAiConfig();
      const csvText = fs.existsSync(csvPath) ? fs.readFileSync(csvPath, 'utf8') : '';
      return sendJson(res, 200, {
        ...result,
        preview: previewBatchCsv(csvText, aiCfg),
        ledger: summarizeCostLedgers(CAMPAIGNS_DIR),
        state: loadWorkspaceState()
      });
    } catch (e) {
      return sendJson(res, 500, { ok: false, output: e.message });
    }
  }

  // Serve files under /assets/ and /campaigns/ for live video/audio/image preview
  if (req.method === 'GET' && url.pathname.startsWith('/assets/')) {
    const assetRel = decodeURIComponent(url.pathname.replace(/^\/assets\//, ''));
    const safeAsset = path.normalize(path.join(ASSETS_DIR, assetRel));
    // Không phục vụ assets/private (giọng KOL, văn bản đồng ý), voice-cache, ai-config.json (có API key), file ẩn
    if (!isServableAssetPath(assetRel)) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      return res.end('Không tìm thấy.');
    }
    if (safeAsset.startsWith(ASSETS_DIR + path.sep) && fs.existsSync(safeAsset) && !fs.statSync(safeAsset).isDirectory()) {
      const ext = path.extname(safeAsset).toLowerCase();
      res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'application/octet-stream' });
      return fs.createReadStream(safeAsset).pipe(res);
    }
  }

  if (req.method === 'GET' && url.pathname.startsWith('/campaigns/')) {
    const campRel = decodeURIComponent(url.pathname.replace(/^\/campaigns\//, ''));
    const safeCamp = path.normalize(path.join(CAMPAIGNS_DIR, campRel));
    if (safeCamp.startsWith(CAMPAIGNS_DIR) && fs.existsSync(safeCamp) && !fs.statSync(safeCamp).isDirectory()) {
      const ext = path.extname(safeCamp).toLowerCase();
      res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'application/octet-stream' });
      return fs.createReadStream(safeCamp).pipe(res);
    }
  }

  // Static files from dashboard/
  const relPath = url.pathname === '/' ? 'index.html' : url.pathname.replace(/^\/+/, '');
  const safePath = path.normalize(path.join(DASHBOARD_DIR, relPath));
  if (!safePath.startsWith(DASHBOARD_DIR) || !fs.existsSync(safePath) || fs.statSync(safePath).isDirectory()) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    return res.end('Không tìm thấy trang.');
  }

  const ext = path.extname(safePath).toLowerCase();
  res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'application/octet-stream' });
  fs.createReadStream(safePath).pipe(res);
});

server.listen(PORT, HOST, () => {
  console.log(`==========================================================`);
  console.log(` Đội Làm Video A.I. (7 Trợ Lý) đang chạy tại:`);
  console.log(` -> http://localhost:${PORT}`);
  if (LAN_MODE) {
    console.warn(` [CẢNH BÁO] DASHBOARD_HOST=${HOST}: máy khác trong mạng truy cập được Dashboard (API ghi .env, chạy pipeline).`);
  }
  console.log(`==========================================================`);
});
