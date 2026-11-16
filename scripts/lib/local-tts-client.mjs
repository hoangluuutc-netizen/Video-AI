// Client chuẩn OpenAI Audio API cho TTS/ASR chạy trên máy (Gói 7 — Task 7).
// Backend chính: VoiceStudio (AGPL-3.0, cài NGOÀI repo, chỉ gọi qua HTTP loopback — không import mã của nó).
// Backend dự phòng: sidecar VoxCPM2 tự viết (tools/speech/tts_server.py, Task 7B).
//
// Đã đối chiếu với backend VoiceStudio v0.5.8 thật (docs/SPEECH_API_NOTES.md):
// - /.well-known/voicestudio-speech là tài liệu năng lực tĩnh, KHÔNG cho biết engine → kiểm bằng GET /v1/models.
// - /v1/audio/speech chọn engine theo `model`: mã engine thật ("voxcpm2") luôn chạy đúng engine đó, chưa sẵn sàng
//   thì 400 model_not_available (không rơi về OmniVoice). Bí danh OpenAI (tts-1…) đi theo engine ĐANG BẬT → cấm dùng.
// - Giải phóng RAM: POST /model/unload/{id} (id "sidecar:<engine>" hoặc gộp "sidecars").
import fs from 'node:fs';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';

const LOOPBACK_HOSTS = new Set(['127.0.0.1', 'localhost', '::1', '[::1]']);
export const ALLOWED_TTS_ENGINES = ['voxcpm2'];
// Bí danh OpenAI mà VoiceStudio chuyển cho engine đang bật (có thể là OmniVoice CC-BY-NC)
const OPENAI_TTS_ALIAS_RE = /^(tts-1(-hd)?|gpt-4o(-mini)?-tts)(-\d{4}-\d{2}-\d{2})?$/i;

export const VOICESTUDIO_DEFAULT_FIELDS = {
  modelsPath: '/v1/models',
  speechPath: '/v1/audio/speech',
  transcriptionsPath: '/v1/audio/transcriptions',
  unloadPath: '/model/unload',
  extraSpeechBody: {}
};

export function resolveLocalTtsConfig(aiCfg = {}, env = process.env) {
  const lt = aiCfg.localTts || {};
  const provider = (lt.provider || env.LOCAL_TTS_PROVIDER || 'voicestudio') === 'sidecar' ? 'sidecar' : 'voicestudio';
  // 3901 là giao diện web của VoiceStudio → sidecar dự phòng dùng 3911
  const fallbackUrl = provider === 'sidecar' ? 'http://127.0.0.1:3911' : 'http://127.0.0.1:3900';
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
    language: lt.language || 'vi',
    timeoutMs: Number(lt.timeoutMs || env.LOCAL_TTS_TIMEOUT_MS || 600000),
    allowedEngines: ALLOWED_TTS_ENGINES,
    startCmd: lt.startCmd || env.LOCAL_TTS_START_CMD || '',
    startCwd: lt.startCwd || env.LOCAL_TTS_START_CWD || '',
    fields: { ...VOICESTUDIO_DEFAULT_FIELDS, ...(lt.fields || {}) }
  };
}

// Trong GET /v1/models: chỉ nhận engine THẬT (alias_for_active_engine === false), không nhận bí danh
export function findEngineInModelList(json, model) {
  const hit = (json?.data || []).find(
    (m) => m?.id === model && m?.voicestudio?.alias_for_active_engine === false && (m.voicestudio.kind ?? 'tts') === 'tts'
  );
  return hit ? hit.id : null;
}

export function assertCommercialSafeEngine(engine, allowedEngines = ALLOWED_TTS_ENGINES) {
  const e = String(engine || '').toLowerCase();
  if (!e) {
    throw new Error(
      'Chưa cài engine VoxCPM2 trong VoiceStudio (hoặc không xác định được engine). Chạy "voicestudio engines install" để cài voxcpm2, rồi chấp nhận giấy phép model.'
    );
  }
  if (e.includes('omnivoice')) {
    throw new Error(`Engine "${engine}" dùng trọng số CC-BY-NC — cấm dùng cho video quảng cáo thương mại. Dùng VoxCPM2.`);
  }
  if (OPENAI_TTS_ALIAS_RE.test(e)) {
    throw new Error(`"${engine}" là bí danh OpenAI — VoiceStudio chuyển nó cho engine đang bật (có thể là OmniVoice). Phải gọi đúng mã engine "voxcpm2".`);
  }
  if (!allowedEngines.some((a) => e === a || e.startsWith(`${a}-`))) {
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
    // Node fetch chỉ báo "fetch failed"; nguyên nhân thật (ECONNRESET, ECONNREFUSED…) nằm ở e.cause.
    // Đã gặp thật 2026-11-16: engine VoxCPM2 chiếm ~12 GB RAM rồi sập giữa lúc sinh giọng, kéo theo VoiceStudio tắt.
    const cause = e.cause?.code || e.cause?.message || e.message;
    throw new Error(
      `Mất kết nối tới TTS local tại ${url} (${cause}) — VoiceStudio có thể đã tắt hoặc engine bị sập (thiếu RAM?). Mở lại VoiceStudio rồi thử lại.`
    );
  } finally {
    clearTimeout(timer);
  }
}

export async function checkLocalTts(cfg, { fetchImpl = fetch } = {}) {
  const url = cfg.provider === 'sidecar' ? `${cfg.baseUrl}/health` : `${cfg.baseUrl}${cfg.fields.modelsPath}`;
  try {
    const res = await fetchWithTimeout(url, { headers: authHeaders(cfg) }, 5000, fetchImpl);
    if (!res.ok) return { ok: false, engine: null, detail: `HTTP ${res.status} tại ${url}` };
    const json = await res.json().catch(() => ({}));
    if (cfg.provider === 'sidecar') return { ok: true, engine: json.engine || null, detail: 'sidecar' };
    const engine = findEngineInModelList(json, cfg.model);
    return {
      ok: true,
      engine,
      detail: engine
        ? `VoiceStudio sẵn sàng với engine ${engine}`
        : `VoiceStudio đang chạy nhưng chưa cài engine ${cfg.model} — chạy "voicestudio engines install" rồi chấp nhận giấy phép model`
    };
  } catch (e) {
    return { ok: false, engine: null, detail: e.message };
  }
}

// Đọc lỗi dạng OpenAI {error:{message,code}} hoặc FastAPI {detail}
async function explainHttpError(res, cfg) {
  const raw = await res.text().catch(() => '');
  let message = raw.slice(0, 200);
  let code = '';
  try {
    const j = JSON.parse(raw);
    message = j?.error?.message || (typeof j?.detail === 'string' ? j.detail : JSON.stringify(j?.detail ?? j)).slice(0, 200);
    code = String(j?.error?.code || j?.detail?.code || '');
  } catch {
    /* giữ nguyên văn bản */
  }
  if (res.status === 403 || /licen[cs]e/i.test(code)) {
    return new Error(
      `VoiceStudio chưa được chấp nhận giấy phép model ${cfg.model}. Người dùng mở "voicestudio models license" để đọc và chấp nhận (VoxCPM2: Apache-2.0). Chi tiết: ${message}`
    );
  }
  if (code === 'model_not_available' || code === 'model_not_found') {
    return new Error(`Engine ${cfg.model} trong VoiceStudio chưa sẵn sàng: ${message}`);
  }
  return new Error(`TTS local HTTP ${res.status}: ${message}`);
}

export async function synthesizeLocalTts(text, { cfg, voiceProfile = {}, fetchImpl = fetch, root = process.cwd() } = {}) {
  const status = await checkLocalTts(cfg, { fetchImpl });
  if (!status.ok) throw new Error(`TTS local không phản hồi (${cfg.baseUrl}): ${status.detail}`);
  assertCommercialSafeEngine(status.engine, cfg.allowedEngines);
  // Request ghim đúng mã engine (không bao giờ là bí danh) → máy chủ không thể chạy engine khác
  assertCommercialSafeEngine(cfg.model, cfg.allowedEngines);

  const body = {
    model: cfg.model,
    input: text,
    voice: voiceProfile.voiceId || voiceProfile.characterId || 'default',
    response_format: 'wav',
    language: cfg.language || 'vi',
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
  if (!res.ok) throw await explainHttpError(res, cfg);
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

// Giải phóng RAM sau pha TTS. VoiceStudio: thử đúng engine phụ, không được thì gộp mọi engine phụ.
export async function unloadLocalTts(cfg, { fetchImpl = fetch } = {}) {
  const post = async (p) => {
    try {
      const res = await fetchWithTimeout(`${cfg.baseUrl}${p}`, { method: 'POST', headers: authHeaders(cfg) }, 15000, fetchImpl);
      return res.ok;
    } catch {
      return false;
    }
  };
  if (cfg.provider === 'sidecar') return post('/admin/unload');
  const base = cfg.fields.unloadPath;
  return (await post(`${base}/sidecar:${encodeURIComponent(cfg.model)}`)) || post(`${base}/sidecars`);
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
