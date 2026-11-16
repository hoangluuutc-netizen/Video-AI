// Client chuẩn OpenAI Audio API cho TTS/ASR chạy trên máy (Gói 7 — Task 7).
// Backend chính: VoiceStudio (AGPL-3.0, cài NGOÀI repo, chỉ gọi qua HTTP loopback — không import mã của nó).
// Backend dự phòng: sidecar VoxCPM2 tự viết (tools/speech/tts_server.py, Task 7B).
// Mọi chỗ chưa xác minh với server thật (tên trường engine, cách tham chiếu giọng clone) nằm trong
// VOICESTUDIO_DEFAULT_FIELDS và có thể ghi đè bằng aiCfg.localTts.fields sau khi Task 0 dò API.
import fs from 'node:fs';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';

const LOOPBACK_HOSTS = new Set(['127.0.0.1', 'localhost', '::1', '[::1]']);
export const ALLOWED_TTS_ENGINES = ['voxcpm2'];

export const VOICESTUDIO_DEFAULT_FIELDS = {
  wellKnownPath: '/.well-known/voicestudio-speech',
  // Thử lần lượt các khóa (dạng a.b.c) để đọc engine TTS đang chạy từ discovery — xác minh ở Task 0
  engineKeys: ['tts_backend', 'tts.backend', 'tts.engine', 'engine', 'backends.tts', 'capabilities.tts.backend'],
  speechPath: '/v1/audio/speech',
  transcriptionsPath: '/v1/audio/transcriptions',
  extraSpeechBody: {}
};

export function resolveLocalTtsConfig(aiCfg = {}, env = process.env) {
  const lt = aiCfg.localTts || {};
  const provider = (lt.provider || env.LOCAL_TTS_PROVIDER || 'voicestudio') === 'sidecar' ? 'sidecar' : 'voicestudio';
  const fallbackUrl = provider === 'sidecar' ? 'http://127.0.0.1:3901' : 'http://127.0.0.1:3900';
  const baseUrl = String(lt.baseUrl || env.LOCAL_TTS_URL || fallbackUrl).replace(/\/$/, '');
  let host;
  try {
    host = new URL(baseUrl).hostname;
  } catch {
    throw new Error(`Địa chỉ TTS local không hợp lệ: ${baseUrl}`);
  }
  if (!LOOPBACK_HOSTS.has(host)) {
    throw new Error(`Chỉ được gọi TTS local qua loopback (127.0.0.1 / localhost / ::1), không dùng "${host}" — dữ liệu giọng KOL không được rời máy.`);
  }
  return {
    provider,
    baseUrl,
    apiKey: lt.apiKey || env.LOCAL_TTS_API_KEY || '',
    model: lt.model || env.LOCAL_TTS_MODEL || 'voxcpm2',
    timeoutMs: Number(lt.timeoutMs || env.LOCAL_TTS_TIMEOUT_MS || 600000),
    allowedEngines: ALLOWED_TTS_ENGINES,
    engineConfirmed: lt.engineConfirmed || env.LOCAL_TTS_ENGINE_CONFIRMED || '',
    startCmd: lt.startCmd || env.LOCAL_TTS_START_CMD || '',
    startCwd: lt.startCwd || env.LOCAL_TTS_START_CWD || '',
    fields: { ...VOICESTUDIO_DEFAULT_FIELDS, ...(lt.fields || {}) }
  };
}

export function extractEngineName(json, keys = VOICESTUDIO_DEFAULT_FIELDS.engineKeys) {
  for (const k of keys) {
    const v = k.split('.').reduce((o, p) => (o && typeof o === 'object' ? o[p] : undefined), json);
    if (typeof v === 'string' && v.trim()) return v.trim().toLowerCase();
  }
  return null;
}

export function assertCommercialSafeEngine(engine, allowedEngines = ALLOWED_TTS_ENGINES) {
  const e = String(engine || '').toLowerCase();
  if (!e) {
    throw new Error(
      'Không xác định được engine TTS đang chạy trên VoiceStudio. Kiểm tra trong VoiceStudio rằng engine là VoxCPM2, rồi đặt localTts.engineConfirmed = "voxcpm2" trong ai-config.json.'
    );
  }
  if (e.includes('omnivoice')) {
    throw new Error(`Engine "${engine}" dùng trọng số CC-BY-NC — cấm dùng cho video quảng cáo thương mại. Chuyển VoiceStudio sang VoxCPM2.`);
  }
  if (!allowedEngines.some((a) => e.includes(a))) {
    throw new Error(`Engine "${engine}" không nằm trong danh sách được phép (${allowedEngines.join(', ')}).`);
  }
}

function authHeaders(cfg) {
  return cfg.apiKey ? { Authorization: `Bearer ${cfg.apiKey}` } : {};
}

async function fetchWithTimeout(url, opts, timeoutMs, fetchImpl = fetch) {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), timeoutMs);
  try {
    return await fetchImpl(url, { ...opts, signal: ac.signal });
  } catch (e) {
    if (e.name === 'AbortError') throw new Error(`TTS local quá thời gian (${Math.round(timeoutMs / 1000)}s) tại ${url}`);
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

export async function checkLocalTts(cfg, { fetchImpl = fetch } = {}) {
  const url = cfg.provider === 'sidecar' ? `${cfg.baseUrl}/health` : `${cfg.baseUrl}${cfg.fields.wellKnownPath}`;
  try {
    const res = await fetchWithTimeout(url, { headers: authHeaders(cfg) }, 5000, fetchImpl);
    if (!res.ok) return { ok: false, engine: null, detail: `HTTP ${res.status}` };
    const json = await res.json().catch(() => ({}));
    let engine = cfg.provider === 'sidecar' ? (json.engine || null) : extractEngineName(json, cfg.fields.engineKeys);
    let detail = 'discovery';
    if (!engine && cfg.engineConfirmed) {
      engine = String(cfg.engineConfirmed).toLowerCase();
      detail = 'xác nhận thủ công (localTts.engineConfirmed)';
    }
    return { ok: true, engine, detail };
  } catch (e) {
    return { ok: false, engine: null, detail: e.message };
  }
}

export async function synthesizeLocalTts(text, { cfg, voiceProfile = {}, fetchImpl = fetch, root = process.cwd() } = {}) {
  const status = await checkLocalTts(cfg, { fetchImpl });
  if (!status.ok) throw new Error(`TTS local không phản hồi (${cfg.baseUrl}): ${status.detail}`);
  assertCommercialSafeEngine(status.engine, cfg.allowedEngines);

  const body = {
    model: cfg.model,
    input: text,
    voice: voiceProfile.voiceId || voiceProfile.characterId || 'default',
    response_format: 'wav',
    ...cfg.fields.extraSpeechBody
  };
  if (cfg.provider === 'sidecar') {
    if (voiceProfile.referenceAudio) body.ref_audio_path = path.resolve(root, voiceProfile.referenceAudio);
    if (voiceProfile.referenceText) body.ref_text = voiceProfile.referenceText;
  }
  const res = await fetchWithTimeout(
    `${cfg.baseUrl}${cfg.fields.speechPath}`,
    { method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeaders(cfg) }, body: JSON.stringify(body) },
    cfg.timeoutMs,
    fetchImpl
  );
  if (!res.ok) {
    const t = await res.text().catch(() => '');
    throw new Error(`TTS local HTTP ${res.status}: ${t.slice(0, 200)}`);
  }
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length < 44) throw new Error('TTS local không trả về dữ liệu âm thanh.');
  return buf;
}

export async function transcribeLocalAsr(wavPath, { cfg, language = 'vi', fetchImpl = fetch } = {}) {
  const form = new FormData();
  form.append('file', new Blob([fs.readFileSync(wavPath)], { type: 'audio/wav' }), path.basename(wavPath));
  form.append('model', 'whisper-1');
  form.append('language', language);
  form.append('response_format', 'verbose_json');
  form.append('timestamp_granularities[]', 'word');
  const res = await fetchWithTimeout(
    `${cfg.baseUrl}${cfg.fields.transcriptionsPath}`,
    { method: 'POST', headers: authHeaders(cfg), body: form },
    cfg.timeoutMs,
    fetchImpl
  );
  if (!res.ok) throw new Error(`ASR local HTTP ${res.status}`);
  const json = await res.json();
  const raw = Array.isArray(json.words) ? json.words : (json.segments || []).flatMap((s) => s.words || []);
  const words = raw
    .map((x) => ({ w: x.word ?? x.text ?? '', start: Number(x.start), end: Number(x.end) }))
    .filter((x) => x.w && Number.isFinite(x.start) && Number.isFinite(x.end));
  return { text: json.text || '', words: words.length ? words : null };
}

export async function unloadLocalTts(cfg, { fetchImpl = fetch } = {}) {
  if (cfg.provider !== 'sidecar') {
    console.log('[TTS local] VoiceStudio chưa có API giải phóng RAM — dùng chế độ managed (LOCAL_TTS_START_CMD) hoặc tắt app sau lô.');
    return false;
  }
  try {
    const res = await fetchWithTimeout(`${cfg.baseUrl}/admin/unload`, { method: 'POST', headers: authHeaders(cfg) }, 15000, fetchImpl);
    return res.ok;
  } catch {
    return false;
  }
}

function killTree(child) {
  if (!child?.pid) return;
  if (process.platform === 'win32') spawnSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore', windowsHide: true });
  else child.kill('SIGTERM');
}

// Nếu server chưa chạy mà có startCmd: tự mở, chờ sẵn sàng (≤ 120s), chạy fn, rồi tắt ĐÚNG tiến trình đã mở.
export async function withManagedLocalTts(cfg, fn, { healthTimeoutMs = 120000, pollMs = 2000 } = {}) {
  const first = await checkLocalTts(cfg);
  if (first.ok || !cfg.startCmd) return fn();
  console.log(`[TTS local] Đang khởi động: ${cfg.startCmd}`);
  const child = spawn(cfg.startCmd, { shell: true, cwd: cfg.startCwd || undefined, windowsHide: true, stdio: 'ignore' });
  try {
    const t0 = Date.now();
    let ready = false;
    while (Date.now() - t0 < healthTimeoutMs) {
      await new Promise((r) => setTimeout(r, pollMs));
      if ((await checkLocalTts(cfg)).ok) {
        ready = true;
        break;
      }
    }
    if (!ready) throw new Error(`TTS local không sẵn sàng sau ${Math.round(healthTimeoutMs / 1000)}s.`);
    return await fn();
  } finally {
    killTree(child);
    console.log('[TTS local] Đã tắt tiến trình TTS do pipeline mở.');
  }
}

export function loadLocalTtsConfigFromDisk(root = process.cwd()) {
  const p = path.join(root, 'assets', 'brand-kit', 'ai-config.json');
  let aiCfg = {};
  try {
    aiCfg = fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : {};
  } catch {
    aiCfg = {};
  }
  return resolveLocalTtsConfig(aiCfg, process.env);
}

export function makeDefaultTranscriber(cfg = loadLocalTtsConfigFromDisk()) {
  return (wavPath) => transcribeLocalAsr(wavPath, { cfg });
}
