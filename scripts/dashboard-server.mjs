import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync, spawn } from 'node:child_process';
import { analyzeSampleVideo } from './analyze-sample-video.mjs';
import { generateCharacterSheet } from './generate-character-sheet.mjs';
import { uploadVideo, DEFAULT_MODEL } from './lib/gemini-client.mjs';
import { aiBreakdown } from './lib/video-forensics.mjs';
import { aiRemake, templateRemake } from './lib/video-remake.mjs';

const ROOT = process.cwd();
const PORT = Number(process.env.PORT || 4173);
const DASHBOARD_DIR = path.join(ROOT, 'dashboard');
const ASSETS_DIR = path.join(ROOT, 'assets');
const CAMPAIGNS_DIR = path.join(ROOT, 'campaigns');
const SHEET_PATH = path.join(ROOT, 'campaigns', 'reel-sheet.json');
const AI_CONFIG_PATH = path.join(ROOT, 'assets', 'brand-kit', 'ai-config.json');

  const DEFAULT_AI_CONFIG = {
  llmModel: 'gemini-3.1-pro-preview',
  imageModel: 'gemini-nano-banana-2.1',
  videoModel: 'veo-3.1-generate-001',
  ttsModel: 'google-vi-natural',
  ttsVoice: 'Kore',
  renderEngine: 'veo3-hybrid-real-lock',
  hasGeminiKey: false
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
  let envHasGemini = Boolean(process.env.GEMINI_API_KEY);
  if (fs.existsSync(envPath)) {
    const raw = fs.readFileSync(envPath, 'utf8');
    if (/GEMINI_API_KEY=\S+/.test(raw)) envHasGemini = true;
  }
  return {
    ...DEFAULT_AI_CONFIG,
    ...saved,
    hasGeminiKey: Boolean(saved.geminiApiKey || envHasGemini)
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
  const sheet = readJsonSafe(SHEET_PATH, { reels: [] });

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

  return { brand, aiConfig, products, characters, catalog, campaigns, sheet, sampleAnalysis, veo3PromptsPack, museAiPack };
}

function sendJson(res, status, payload) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(payload));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
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

function runScript(scriptRel, args = []) {
  const startMs = Date.now();
  try {
    const out = execFileSync('node', [path.join(ROOT, scriptRel), ...args], {
      cwd: ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe']
    });
    return {
      ok: true,
      elapsedSec: ((Date.now() - startMs) / 1000).toFixed(1),
      output: out.trim()
    };
  } catch (e) {
    const msg = [e.stdout, e.stderr, e.message].filter(Boolean).join('\n').trim();
    return {
      ok: false,
      elapsedSec: ((Date.now() - startMs) / 1000).toFixed(1),
      output: msg
    };
  }
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
        renderEngine: body.renderEngine || current.renderEngine
      };
      if (body.geminiApiKey !== undefined && body.geminiApiKey.trim() !== '') {
        updated.geminiApiKey = body.geminiApiKey.trim();
        process.env.GEMINI_API_KEY = updated.geminiApiKey;
      }
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

      if (kind === 'product') {
        const pid = targetId || 'sample-product';
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
        const cid = targetId || 'sample-kol';
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
        const ingestRes = runScript('scripts/ingest-footage.mjs');
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
        execFileSync('yt-dlp', ['-f', 'mp4/best[ext=mp4]/best', '--no-playlist', '-o', outFile, videoUrl.trim()], {
          encoding: 'utf8',
          timeout: 60000
        });
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
      execFileSync('node', [path.join(ROOT, 'scripts', 'ingest-footage.mjs'), '--force'], { encoding: 'utf8' });
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

      const remake = apiKey
        ? await aiRemake(apiKey, ana.xray || { shots: [] }, ana.breakdown || null, productInput, { model: aiCfg.llmModel || DEFAULT_MODEL })
        : templateRemake(ana.xray || { shots: [] }, ana.breakdown || null, productInput);

      return sendJson(res, 200, {
        ok: true,
        elapsedSec: ((Date.now() - startMs) / 1000).toFixed(1),
        usedAi: Boolean(apiKey),
        remake,
        output: `Đã nhân bản công thức (${apiKey ? 'Gemini AI' : 'Template chuẩn'}) cho "${prod.name}" (${remake.shots?.length || 0} cảnh).`
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
      const { action, campaignId } = await readBody(req);
      const cid = campaignId || 'sample-campaign';
      const campRel = path.posix.join('campaigns', cid, 'campaign.json');
      let result;
      let mediaUrl = '';

      if (action === 'validate') {
        result = runScript('scripts/validate-assets.mjs');
      } else if (action === 'ingest-footage') {
        result = runScript('scripts/ingest-footage.mjs');
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
        const styleArg = body.museStyle || '';
        if (styleArg) {
          runScript('scripts/generate-muse-pack.mjs', [campRel, styleArg]);
        }
        result = runScript('scripts/generate-prompts.mjs', [campRel]);
        const packPath = path.join(ROOT, 'campaigns', cid, 'veo3-prompts.json');
        if (fs.existsSync(packPath)) {
          result.veo3PromptsPack = readJsonSafe(packPath, null);
        }
      } else if (action === 'run-veo3-cloud') {
        const aiCfg = loadAiConfig();
        runScript('scripts/generate-prompts.mjs', [campRel]);
        buildLocalKeyframesFromRealImages(campRel);
        if (aiCfg.hasGeminiKey) {
          process.env.GEMINI_VIDEO_MODEL = aiCfg.videoModel || 'veo-3.1-generate-001';
          result = runScript('scripts/generate-media.mjs', [campRel, '--mode', 'video']);
        } else {
          result = runScript('scripts/generate-media.mjs', [campRel, '--mode', 'video', '--dry-run']);
          result.output = `[CHẾ ĐỘ CHUẨN BỊ NGUYÊN LIỆU VEO 3.1]\nĐã khóa Keyframes (Ảnh Người thật + SP thật), cắt Clip mẫu 3s và xuất veo3-prompts.json!\n(Nếu muốn gọi trực tiếp API Cloud Veo 3.1 / Omni 1.2, hãy điền GEMINI_API_KEY tại mục Cài đặt Bộ não; hoặc bấm Copy Prompt Veo 3 bên dưới để dán vào Google Veo 3 / Flow).\n${result.output}`;
        }
      } else if (action === 'generate-voiceover') {
        result = runScript('scripts/generate-voiceover.mjs', [campRel]);
        mediaUrl = `/campaigns/${cid}/media/audio/voiceover-full.mp3?t=${Date.now()}`;
      } else if (action === 'build-keyframes') {
        const aiCfg = loadAiConfig();
        if (aiCfg.hasGeminiKey && aiCfg.renderEngine === 'gemini-cloud') {
          result = runScript('scripts/generate-media.mjs', [campRel, '--mode', 'keyframe']);
        } else {
          result = buildLocalKeyframesFromRealImages(campRel);
        }
      } else if (action === 'export-cutlist') {
        result = runScript('scripts/export-cutlist.mjs', [campRel]);
      } else if (action === 'render-ffmpeg') {
        result = runScript('scripts/export-cutlist.mjs', [campRel, '--render-ffmpeg']);
        mediaUrl = `/campaigns/${cid}/out/ffmpeg-9x16.mp4?t=${Date.now()}`;
      } else if (action === 'render-all-ratios') {
        result = runScript('scripts/export-cutlist.mjs', [campRel, '--render-ffmpeg', '--ratio=all']);
        mediaUrl = `/campaigns/${cid}/out/ffmpeg-9x16.mp4?t=${Date.now()}`;
      } else if (action === 'sync-studio') {
        result = runScript('scripts/sync-studio.mjs', [campRel]);
      } else if (action === 'verify-integrity') {
        result = runScript('scripts/verify-integrity.mjs', [campRel]);
      } else if (action === 'run-optimal-pipeline') {
        buildLocalKeyframesFromRealImages(campRel);
        result = runScript('scripts/run-optimal-pipeline.mjs', [campRel]);
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
      const reels = Array.isArray(body.reels) ? body.reels : [];
      fs.mkdirSync(path.dirname(SHEET_PATH), { recursive: true });
      fs.writeFileSync(SHEET_PATH, JSON.stringify({ reels }, null, 2) + '\n', 'utf8');
      return sendJson(res, 200, { ok: true, output: `Đã lưu Sổ vận hành (${reels.length} reel).` });
    } catch (e) {
      return sendJson(res, 500, { ok: false, output: e.message });
    }
  }

  // Serve files under /assets/ and /campaigns/ for live video/audio/image preview
  if (req.method === 'GET' && url.pathname.startsWith('/assets/')) {
    const assetRel = decodeURIComponent(url.pathname.replace(/^\/assets\//, ''));
    const safeAsset = path.normalize(path.join(ASSETS_DIR, assetRel));
    if (safeAsset.startsWith(ASSETS_DIR) && fs.existsSync(safeAsset) && !fs.statSync(safeAsset).isDirectory()) {
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

server.listen(PORT, () => {
  console.log(`==========================================================`);
  console.log(` Đội Làm Video A.I. (7 Trợ Lý) đang chạy tại:`);
  console.log(` -> http://localhost:${PORT}`);
  console.log(`==========================================================`);
});
