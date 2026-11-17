import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isLoopbackHost,
  checkApiRequest,
  isServableAssetPath,
  publicAiConfig,
  safeSlug,
  remotionCompositionId
} from '../lib/dashboard-security.mjs';

const H = (host, extra = {}) => ({ host, ...extra });

test('isLoopbackHost: chỉ nhận localhost / 127.0.0.1 / [::1] đúng cổng', () => {
  assert.equal(isLoopbackHost('localhost:4173', 4173), true);
  assert.equal(isLoopbackHost('127.0.0.1:4173', 4173), true);
  assert.equal(isLoopbackHost('[::1]:4173', 4173), true);
  assert.equal(isLoopbackHost('LOCALHOST:4173', 4173), true);
  assert.equal(isLoopbackHost('evil.example:4173', 4173), false); // DNS rebinding
  assert.equal(isLoopbackHost('192.168.1.5:4173', 4173), false);
  assert.equal(isLoopbackHost('localhost:9999', 4173), false);
  assert.equal(isLoopbackHost('', 4173), false);
});

test('checkApiRequest: GET nội bộ hợp lệ', () => {
  assert.deepEqual(checkApiRequest({ method: 'GET', headers: H('localhost:4173'), port: 4173 }), { ok: true });
});

test('checkApiRequest: chặn Host lạ (DNS rebinding)', () => {
  const r = checkApiRequest({ method: 'GET', headers: H('evil.example:4173'), port: 4173 });
  assert.equal(r.ok, false);
  assert.equal(r.status, 403);
});

test('checkApiRequest: POST phải là application/json (chặn form/text-plain từ trang web lạ)', () => {
  const r = checkApiRequest({ method: 'POST', headers: H('localhost:4173', { 'content-type': 'text/plain;charset=UTF-8' }), port: 4173 });
  assert.equal(r.ok, false);
  assert.equal(r.status, 415);
  assert.equal(checkApiRequest({ method: 'POST', headers: H('localhost:4173'), port: 4173 }).status, 415);
});

test('checkApiRequest: chặn Origin khác dashboard, nhận Origin của chính dashboard', () => {
  const evil = checkApiRequest({
    method: 'POST',
    headers: H('localhost:4173', { 'content-type': 'application/json', origin: 'https://evil.example' }),
    port: 4173
  });
  assert.equal(evil.ok, false);
  assert.equal(evil.status, 403);
  const own = checkApiRequest({
    method: 'POST',
    headers: H('127.0.0.1:4173', { 'content-type': 'application/json; charset=utf-8', origin: 'http://localhost:4173' }),
    port: 4173
  });
  assert.deepEqual(own, { ok: true });
});

test('checkApiRequest: chế độ LAN (người dùng tự bật) bỏ kiểm Host nhưng vẫn giữ kiểm Origin + JSON', () => {
  const lanGet = checkApiRequest({ method: 'GET', headers: H('192.168.1.5:4173'), port: 4173, allowAnyHost: true });
  assert.deepEqual(lanGet, { ok: true });
  const lanPost = checkApiRequest({
    method: 'POST',
    headers: H('192.168.1.5:4173', { 'content-type': 'application/json', origin: 'http://192.168.1.5:4173' }),
    port: 4173,
    allowAnyHost: true
  });
  assert.deepEqual(lanPost, { ok: true });
  const lanCsrf = checkApiRequest({
    method: 'POST',
    headers: H('192.168.1.5:4173', { 'content-type': 'application/json', origin: 'https://evil.example' }),
    port: 4173,
    allowAnyHost: true
  });
  assert.equal(lanCsrf.ok, false);
});

test('isServableAssetPath: chặn dữ liệu riêng, cấu hình chứa key và file ẩn', () => {
  assert.equal(isServableAssetPath('characters/linh-dan/portrait.png'), true);
  assert.equal(isServableAssetPath('music/nhac-nen.mp3'), true);
  assert.equal(isServableAssetPath('private/consents/KOL-1.json'), false);
  assert.equal(isServableAssetPath('private/voices/user-test/source.wav'), false);
  assert.equal(isServableAssetPath('PRIVATE/voices/x.wav'), false);
  assert.equal(isServableAssetPath('private\\voices\\x.wav'), false);
  assert.equal(isServableAssetPath('brand-kit/ai-config.json'), false);
  assert.equal(isServableAssetPath('products/x/.env'), false);
  assert.equal(isServableAssetPath('voice-cache/abc.wav'), false);
});

test('publicAiConfig: bỏ mọi API key / app id, giữ lựa chọn model và cờ has*', () => {
  const out = publicAiConfig({
    llmModel: 'ollama:qwen3.5:9b',
    geminiApiKey: 'g',
    falApiKey: 'f',
    vbeeApiKey: 'v',
    vbeeAppId: 'a',
    fptApiKey: 'p',
    localTts: { provider: 'voicestudio', apiKey: 'lt' },
    hasGeminiKey: true,
    envStatus: { GEMINI_API_KEY: true }
  });
  assert.equal(out.llmModel, 'ollama:qwen3.5:9b');
  assert.equal(out.hasGeminiKey, true);
  assert.deepEqual(out.envStatus, { GEMINI_API_KEY: true });
  for (const k of ['geminiApiKey', 'falApiKey', 'vbeeApiKey', 'vbeeAppId', 'fptApiKey']) assert.equal(k in out, false, k);
  assert.equal(out.localTts.apiKey, undefined);
  assert.equal(out.localTts.provider, 'voicestudio');
});

test('safeSlug: chặn path traversal trong targetId', () => {
  assert.equal(safeSlug('sample-product'), 'sample-product');
  assert.equal(safeSlug('Linh-Dan_2'), 'linh-dan_2');
  assert.equal(safeSlug('../../scripts'), null);
  assert.equal(safeSlug('a/b'), null);
  assert.equal(safeSlug(''), null);
  assert.equal(safeSlug(undefined), null);
});

test('remotionCompositionId: khớp đúng composition trong studio/src/Root.tsx', () => {
  assert.equal(remotionCompositionId('9x16'), 'TikTok-9x16');
  assert.equal(remotionCompositionId('1x1'), 'Facebook-1x1');
  assert.equal(remotionCompositionId('16x9'), 'Web-16x9');
  assert.equal(remotionCompositionId('bogus'), 'TikTok-9x16');
});
