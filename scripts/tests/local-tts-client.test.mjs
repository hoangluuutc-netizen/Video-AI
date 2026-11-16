import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  resolveLocalTtsConfig,
  assertCommercialSafeEngine,
  extractEngineName,
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

test('từ chối host không phải loopback', () => {
  assert.throws(() => resolveLocalTtsConfig({ localTts: { baseUrl: 'http://192.168.1.5:3900' } }, {}), /loopback/);
  assert.equal(resolveLocalTtsConfig({}, {}).baseUrl, 'http://127.0.0.1:3900');
  assert.equal(resolveLocalTtsConfig({ localTts: { provider: 'sidecar' } }, {}).baseUrl, 'http://127.0.0.1:3901');
});

test('chặn OmniVoice và engine không xác định', () => {
  assert.throws(() => assertCommercialSafeEngine('omnivoice-gguf', ['voxcpm2']), /CC-BY-NC|thương mại/);
  assert.throws(() => assertCommercialSafeEngine(null, ['voxcpm2']), /không xác định/i);
  assert.throws(() => assertCommercialSafeEngine('cosyvoice3', ['voxcpm2']), /không nằm trong/);
  assert.doesNotThrow(() => assertCommercialSafeEngine('VoxCPM2', ['voxcpm2']));
});

test('extractEngineName đọc được nhiều dạng discovery', () => {
  assert.equal(extractEngineName({ tts: { backend: 'voxcpm2' } }), 'voxcpm2');
  assert.equal(extractEngineName({ tts_backend: 'OmniVoice' }), 'omnivoice');
  assert.equal(extractEngineName({ other: 1 }), null);
});

test('checkLocalTts dùng engineConfirmed khi discovery không lộ engine', async () => {
  const s = await mockServer({ 'GET /.well-known/voicestudio-speech': () => ({ json: { name: 'vs' } }) });
  try {
    assert.equal((await checkLocalTts(cfgFor(s.baseUrl))).engine, null);
    assert.equal((await checkLocalTts(cfgFor(s.baseUrl, { engineConfirmed: 'voxcpm2' }))).engine, 'voxcpm2');
  } finally {
    await s.close();
  }
});

test('synthesize từ chối khi server báo engine omnivoice', async () => {
  const s = await mockServer({ 'GET /.well-known/voicestudio-speech': () => ({ json: { tts_backend: 'omnivoice' } }) });
  try {
    await assert.rejects(synthesizeLocalTts('Xin chào', { cfg: cfgFor(s.baseUrl), voiceProfile: { voiceId: 'v' } }), /CC-BY-NC|thương mại/);
  } finally {
    await s.close();
  }
});

test('gửi body OpenAI-compatible, trả Buffer WAV', async () => {
  const s = await mockServer({
    'GET /.well-known/voicestudio-speech': () => ({ json: { tts: { backend: 'voxcpm2' } } }),
    'POST /v1/audio/speech': () => ({ buffer: WAV })
  });
  try {
    const buf = await synthesizeLocalTts('Xin chào', { cfg: cfgFor(s.baseUrl), voiceProfile: { voiceId: 'vs-voice-123' } });
    const call = s.calls.find((c) => c.url === '/v1/audio/speech');
    const body = JSON.parse(call.raw.toString('utf8'));
    assert.equal(body.input, 'Xin chào');
    assert.equal(body.voice, 'vs-voice-123');
    assert.equal(body.response_format, 'wav');
    assert.equal(body.model, 'voxcpm2');
    assert.equal(call.headers.authorization, 'Bearer k');
    assert.equal(buf.subarray(0, 4).toString(), 'RIFF');
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
    'GET /.well-known/voicestudio-speech': () => ({ json: { tts_backend: 'voxcpm2' } }),
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

test('unloadLocalTts: sidecar gọi /admin/unload, VoiceStudio trả false', async () => {
  const s = await mockServer({ 'POST /admin/unload': () => ({ json: { unloaded: true } }) });
  try {
    assert.equal(await unloadLocalTts(cfgFor(s.baseUrl, { provider: 'sidecar' })), true);
    assert.equal(await unloadLocalTts(cfgFor(s.baseUrl)), false);
  } finally {
    await s.close();
  }
});

test('withManagedLocalTts chạy thẳng khi server đã sẵn sàng', async () => {
  const s = await mockServer({ 'GET /.well-known/voicestudio-speech': () => ({ json: { tts_backend: 'voxcpm2' } }) });
  try {
    assert.equal(await withManagedLocalTts(cfgFor(s.baseUrl, { startCmd: 'khong-duoc-goi' }), async () => 42), 42);
  } finally {
    await s.close();
  }
});
