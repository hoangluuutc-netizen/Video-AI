import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  resolveLocalTtsConfig,
  assertCommercialSafeEngine,
  findEngineInModelList,
  checkLocalTts,
  synthesizeLocalTts,
  transcribeLocalAsr,
  unloadLocalTts,
  withManagedLocalTts
} from '../lib/local-tts-client.mjs';

// Máy chủ giả: routes = { 'GET /path': (req, body) => ({ status, json | buffer | hang }) }
async function mockServer(routes) {
  const calls = [];
  const server = http.createServer((req, res) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      const raw = Buffer.concat(chunks);
      calls.push({ method: req.method, url: req.url, headers: req.headers, raw });
      const h = routes[`${req.method} ${req.url.split('?')[0]}`];
      if (!h) {
        res.writeHead(404).end('{}');
        return;
      }
      const r = h(req, raw);
      if (r.hang) return; // không bao giờ trả lời
      if (r.buffer) {
        res.writeHead(r.status || 200, { 'Content-Type': 'audio/wav' }).end(r.buffer);
      } else {
        res.writeHead(r.status || 200, { 'Content-Type': 'application/json' }).end(JSON.stringify(r.json || {}));
      }
    });
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  return { baseUrl, calls, close: () => new Promise((r) => server.close(r)) };
}

const WAV = Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WAVE'), Buffer.alloc(40)]);
const cfgFor = (baseUrl, extra = {}) => resolveLocalTtsConfig({ localTts: { baseUrl, apiKey: 'k', ...extra } }, {});

// Dạng phản hồi thật của GET /v1/models (VoiceStudio v0.5.8, api/routers/openai_compat.py::_model_entry)
const entry = (id, kind, alias) => ({ id, object: 'model', created: 0, owned_by: 'voicestudio', voicestudio: { kind, alias_for_active_engine: alias } });
const MODELS_WITH_VOXCPM2 = {
  object: 'list',
  data: [entry('tts-1', 'tts', true), entry('whisper-1', 'stt', true), entry('omnivoice', 'tts', false), entry('voxcpm2', 'tts', false), entry('whisperx', 'stt', false)]
};
const MODELS_WITHOUT_VOXCPM2 = { object: 'list', data: [entry('tts-1', 'tts', true), entry('omnivoice', 'tts', false)] };

test('cổng mặc định: VoiceStudio 3900, sidecar 3911 (3901 là giao diện web của VoiceStudio)', () => {
  assert.equal(resolveLocalTtsConfig({}, {}).baseUrl, 'http://127.0.0.1:3900');
  assert.equal(resolveLocalTtsConfig({ localTts: { provider: 'sidecar' } }, {}).baseUrl, 'http://127.0.0.1:3911');
});

test('từ chối host không phải loopback', () =>
  assert.throws(() => resolveLocalTtsConfig({ localTts: { baseUrl: 'http://192.168.1.5:3900' } }, {}), /loopback/));

test('chặn OmniVoice, bí danh OpenAI và engine không xác định', () => {
  assert.throws(() => assertCommercialSafeEngine('omnivoice-gguf', ['voxcpm2']), /CC-BY-NC|thương mại/);
  assert.throws(() => assertCommercialSafeEngine('tts-1', ['voxcpm2']), /bí danh/);
  assert.throws(() => assertCommercialSafeEngine(null, ['voxcpm2']), /chưa cài|không xác định/i);
  assert.throws(() => assertCommercialSafeEngine('cosyvoice3', ['voxcpm2']), /không nằm trong/);
  assert.doesNotThrow(() => assertCommercialSafeEngine('voxcpm2', ['voxcpm2']));
});

test('findEngineInModelList chỉ nhận engine thật (không phải bí danh của engine đang bật)', () => {
  assert.equal(findEngineInModelList(MODELS_WITH_VOXCPM2, 'voxcpm2'), 'voxcpm2');
  assert.equal(findEngineInModelList(MODELS_WITHOUT_VOXCPM2, 'voxcpm2'), null);
  assert.equal(findEngineInModelList(MODELS_WITH_VOXCPM2, 'tts-1'), null);
  assert.equal(findEngineInModelList({}, 'voxcpm2'), null);
});

test('checkLocalTts đọc /v1/models: có voxcpm2 → engine voxcpm2', async () => {
  const s = await mockServer({ 'GET /v1/models': () => ({ json: MODELS_WITH_VOXCPM2 }) });
  try {
    const r = await checkLocalTts(cfgFor(s.baseUrl));
    assert.deepEqual([r.ok, r.engine], [true, 'voxcpm2']);
  } finally {
    await s.close();
  }
});

test('checkLocalTts: VoiceStudio chạy nhưng chưa cài voxcpm2 → engine null kèm hướng dẫn', async () => {
  const s = await mockServer({ 'GET /v1/models': () => ({ json: MODELS_WITHOUT_VOXCPM2 }) });
  try {
    const r = await checkLocalTts(cfgFor(s.baseUrl));
    assert.equal(r.ok, true);
    assert.equal(r.engine, null);
    assert.match(r.detail, /engines install/);
  } finally {
    await s.close();
  }
});

test('synthesize từ chối khi VoxCPM2 chưa cài (không gọi /v1/audio/speech)', async () => {
  const s = await mockServer({ 'GET /v1/models': () => ({ json: MODELS_WITHOUT_VOXCPM2 }) });
  try {
    await assert.rejects(synthesizeLocalTts('Xin chào', { cfg: cfgFor(s.baseUrl), voiceProfile: { voiceId: 'v' } }), /chưa cài/i);
    assert.ok(!s.calls.some((c) => c.url === '/v1/audio/speech'));
  } finally {
    await s.close();
  }
});

test('gửi body OpenAI-compatible với model voxcpm2 + language vi, trả Buffer WAV', async () => {
  const s = await mockServer({
    'GET /v1/models': () => ({ json: MODELS_WITH_VOXCPM2 }),
    'POST /v1/audio/speech': () => ({ buffer: WAV })
  });
  try {
    const buf = await synthesizeLocalTts('Xin chào', { cfg: cfgFor(s.baseUrl), voiceProfile: { voiceId: 'vs-voice-123' } });
    const call = s.calls.find((c) => c.url === '/v1/audio/speech');
    const body = JSON.parse(call.raw.toString('utf8'));
    assert.equal(body.model, 'voxcpm2');
    assert.equal(body.input, 'Xin chào');
    assert.equal(body.voice, 'vs-voice-123');
    assert.equal(body.response_format, 'wav');
    assert.equal(body.language, 'vi');
    assert.equal(call.headers.authorization, 'Bearer k');
    assert.equal(buf.subarray(0, 4).toString(), 'RIFF');
  } finally {
    await s.close();
  }
});

test('lỗi 403 chưa chấp nhận giấy phép model → thông báo tiếng Việt rõ ràng', async () => {
  const s = await mockServer({
    'GET /v1/models': () => ({ json: MODELS_WITH_VOXCPM2 }),
    'POST /v1/audio/speech': () => ({ status: 403, json: { error: { message: 'licence not accepted', code: 'model_licence_not_accepted' } } })
  });
  try {
    await assert.rejects(synthesizeLocalTts('x', { cfg: cfgFor(s.baseUrl), voiceProfile: { voiceId: 'v' } }), /giấy phép/);
  } finally {
    await s.close();
  }
});

test('lỗi 400 model_not_available → nói rõ engine chưa sẵn sàng', async () => {
  const s = await mockServer({
    'GET /v1/models': () => ({ json: MODELS_WITH_VOXCPM2 }),
    'POST /v1/audio/speech': () => ({ status: 400, json: { error: { message: "Engine 'voxcpm2' is not available: x", code: 'model_not_available' } } })
  });
  try {
    await assert.rejects(synthesizeLocalTts('x', { cfg: cfgFor(s.baseUrl), voiceProfile: { voiceId: 'v' } }), /chưa sẵn sàng/);
  } finally {
    await s.close();
  }
});

test('sidecar nhận ref_audio_path + ref_text', async () => {
  const s = await mockServer({
    'GET /health': () => ({ json: { ok: true, engine: 'voxcpm2' } }),
    'POST /v1/audio/speech': () => ({ buffer: WAV })
  });
  try {
    await synthesizeLocalTts('Chào', {
      cfg: cfgFor(s.baseUrl, { provider: 'sidecar' }),
      voiceProfile: { referenceAudio: 'assets/private/voices/a/voice-ref.wav', referenceText: 'Câu mẫu' }
    });
    const body = JSON.parse(s.calls.find((c) => c.url === '/v1/audio/speech').raw.toString('utf8'));
    assert.ok(body.ref_audio_path.endsWith(path.join('voices', 'a', 'voice-ref.wav')));
    assert.equal(body.ref_text, 'Câu mẫu');
  } finally {
    await s.close();
  }
});

test('timeout ném lỗi rõ ràng', async () => {
  const s = await mockServer({
    'GET /v1/models': () => ({ json: MODELS_WITH_VOXCPM2 }),
    'POST /v1/audio/speech': () => ({ hang: true })
  });
  try {
    await assert.rejects(
      synthesizeLocalTts('x', { cfg: { ...cfgFor(s.baseUrl), timeoutMs: 80 }, voiceProfile: { voiceId: 'v' } }),
      /quá thời gian/
    );
  } finally {
    s.close();
  }
});

test('transcribeLocalAsr trả words khi có và null khi server không có words[]', async () => {
  const tmp = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'asr-')), 'a.wav');
  fs.writeFileSync(tmp, WAV);
  let withWords = true;
  const s = await mockServer({
    'POST /v1/audio/transcriptions': () => ({
      json: withWords ? { text: 'xin chào', words: [{ word: 'xin', start: 0, end: 0.3 }, { word: 'chào', start: 0.3, end: 0.7 }] } : { text: 'xin chào' }
    })
  });
  try {
    const a = await transcribeLocalAsr(tmp, { cfg: cfgFor(s.baseUrl) });
    assert.deepEqual(a.words[1], { w: 'chào', start: 0.3, end: 0.7 });
    const raw = s.calls[0].raw.toString('latin1');
    assert.match(raw, /timestamp_granularities\[\]/);
    assert.match(raw, /verbose_json/);
    withWords = false;
    const b = await transcribeLocalAsr(tmp, { cfg: cfgFor(s.baseUrl) });
    assert.equal(b.words, null);
    assert.equal(b.text, 'xin chào');
  } finally {
    await s.close();
  }
});

test('unloadLocalTts: sidecar gọi /admin/unload', async () => {
  const s = await mockServer({ 'POST /admin/unload': () => ({ json: { unloaded: true } }) });
  try {
    assert.equal(await unloadLocalTts(cfgFor(s.baseUrl, { provider: 'sidecar' })), true);
  } finally {
    await s.close();
  }
});

test('unloadLocalTts: VoiceStudio gọi /model/unload/sidecar:voxcpm2, lỗi thì thử id gộp sidecars', async () => {
  const s = await mockServer({
    'POST /model/unload/sidecar:voxcpm2': () => ({ status: 400, json: { detail: 'unknown' } }),
    'POST /model/unload/sidecars': () => ({ json: { unloaded: 1 } })
  });
  try {
    assert.equal(await unloadLocalTts(cfgFor(s.baseUrl)), true);
    assert.deepEqual(s.calls.map((c) => c.url), ['/model/unload/sidecar:voxcpm2', '/model/unload/sidecars']);
  } finally {
    await s.close();
  }
});

test('withManagedLocalTts chạy thẳng khi server đã sẵn sàng', async () => {
  const s = await mockServer({ 'GET /v1/models': () => ({ json: MODELS_WITH_VOXCPM2 }) });
  try {
    assert.equal(await withManagedLocalTts(cfgFor(s.baseUrl, { startCmd: 'khong-duoc-goi' }), async () => 42), 42);
  } finally {
    await s.close();
  }
});
