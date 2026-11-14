import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const ROOT = process.cwd();
const PORT = Number(process.env.PORT || 4173);
const DASHBOARD_DIR = path.join(ROOT, 'dashboard');
const SHEET_PATH = path.join(ROOT, 'campaigns', 'reel-sheet.json');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.mp4': 'video/mp4'
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

function loadWorkspaceState() {
  const brand = readJsonSafe(path.join(ROOT, 'assets', 'brand-kit', 'brand.json'), {});
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

  return { brand, products, characters, catalog, campaigns, sheet };
}

function sendJson(res, status, payload) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(payload));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => {
      data += chunk;
    });
    req.on('end', () => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch (e) {
        reject(e);
      }
    });
    req.on('error', reject);
  });
}

function runScript(scriptRel, args = []) {
  try {
    const out = execFileSync('node', [path.join(ROOT, scriptRel), ...args], {
      cwd: ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe']
    });
    return { ok: true, output: out.trim() };
  } catch (e) {
    const msg = [e.stdout, e.stderr, e.message].filter(Boolean).join('\n').trim();
    return { ok: false, output: msg };
  }
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://localhost:${PORT}`);

  if (req.method === 'GET' && url.pathname === '/api/state') {
    return sendJson(res, 200, loadWorkspaceState());
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
      const campRel = path.posix.join('campaigns', campaignId || 'sample-campaign', 'campaign.json');
      let result;
      if (action === 'validate') {
        result = runScript('scripts/validate-assets.mjs');
      } else if (action === 'ingest-footage') {
        result = runScript('scripts/ingest-footage.mjs');
      } else if (action === 'generate-prompts') {
        result = runScript('scripts/generate-prompts.mjs', [campRel]);
      } else if (action === 'export-cutlist') {
        result = runScript('scripts/export-cutlist.mjs', [campRel]);
      } else if (action === 'render-ffmpeg') {
        result = runScript('scripts/export-cutlist.mjs', [campRel, '--render-ffmpeg']);
      } else if (action === 'sync-studio') {
        result = runScript('scripts/sync-studio.mjs', [campRel]);
      } else if (action === 'verify-integrity') {
        result = runScript('scripts/verify-integrity.mjs', [campRel]);
      } else {
        return sendJson(res, 400, { ok: false, output: `Hành động không hỗ trợ: ${action}` });
      }
      return sendJson(res, 200, { ...result, state: loadWorkspaceState() });
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
