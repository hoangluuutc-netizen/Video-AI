import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pickVoiceRoute } from '../generate-voiceover.mjs';
import { putCachedVoice, getCachedVoiceMeta } from '../lib/voice-cache.mjs';

const cloneChar = { id: 'kol-that', voiceProfile: { engine: 'voxcpm2', provider: 'voicestudio', mode: 'clone', consentRef: 'K1' } };
const plain = { id: 'sample-kol' };

test('clone chỉ đi engine local, không fallback, bỏ qua ttsModel đang chọn', () =>
  assert.deepEqual(pickVoiceRoute({ ttsModel: 'vbee-vi', character: cloneChar }), { engines: ['voicestudio-voxcpm2'], mustBeLocal: true }));

test('clone với provider sidecar đi sidecar', () =>
  assert.deepEqual(
    pickVoiceRoute({ ttsModel: 'vbee-vi', character: { ...cloneChar, voiceProfile: { ...cloneChar.voiceProfile, provider: 'sidecar' } } }).engines,
    ['sidecar-voxcpm2']
  ));

test('nhân vật thường giữ chuỗi fallback cũ', () =>
  assert.deepEqual(pickVoiceRoute({ ttsModel: 'voicestudio-voxcpm2', character: plain }).engines.slice(-2), ['google-vi-natural', 'windows-sapi-vi']));

test('windows-sapi-vi giữ hành vi cũ (Google trước, SAPI cuối)', () =>
  assert.deepEqual(pickVoiceRoute({ ttsModel: 'windows-sapi-vi', character: plain }).engines, ['google-vi-natural', 'windows-sapi-vi']));

test('clone + allowGenericVoice cho fallback', () => {
  const r = pickVoiceRoute({ ttsModel: 'voicestudio-voxcpm2', character: cloneChar, allowGenericVoice: true });
  assert.ok(r.engines.length > 1);
  assert.equal(r.mustBeLocal, false);
});

test('cache giọng lưu kèm meta vùng tiếng nói', () => {
  const cacheDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vcache-'));
  try {
    putCachedVoice('k1', Buffer.from('x'), { cacheDir, characterId: 'a', meta: { speechStart: 0.2, speechEnd: 3.1 } });
    assert.deepEqual(getCachedVoiceMeta('k1', { cacheDir }), { speechStart: 0.2, speechEnd: 3.1 });
    assert.equal(getCachedVoiceMeta('khong-co', { cacheDir }), null);
  } finally {
    fs.rmSync(cacheDir, { recursive: true, force: true });
  }
});
