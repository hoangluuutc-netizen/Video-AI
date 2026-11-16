import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  voiceCacheKey,
  getCachedVoice,
  putCachedVoice,
  purgeVoiceCache
} from '../lib/voice-cache.mjs';

test('cache key đổi khi text đổi', () => {
  const b = { engine: 'google-vi-natural', model: 'm1', voiceId: 'v1', refAudioHash: 'h1' };
  assert.notEqual(
    voiceCacheKey({ ...b, text: 'a' }),
    voiceCacheKey({ ...b, text: 'b' })
  );
});

test('purgeVoiceCache chỉ xóa file của đúng nhân vật', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'vc-'));
  try {
    const k1 = voiceCacheKey({ engine: 'e', model: 'm', voiceId: 'a', text: '1', refAudioHash: '' });
    const k2 = voiceCacheKey({ engine: 'e', model: 'm', voiceId: 'a', text: '2', refAudioHash: '' });
    const k3 = voiceCacheKey({ engine: 'e', model: 'm', voiceId: 'b', text: '3', refAudioHash: '' });

    putCachedVoice(k1, Buffer.from('a1'), { cacheDir: tmp, characterId: 'kol-a' });
    putCachedVoice(k2, Buffer.from('a2'), { cacheDir: tmp, characterId: 'kol-a' });
    const p3 = putCachedVoice(k3, Buffer.from('b1'), { cacheDir: tmp, characterId: 'kol-b' });

    assert.ok(getCachedVoice(k1, { cacheDir: tmp }));
    assert.equal(purgeVoiceCache('kol-a', { cacheDir: tmp }), 2);
    assert.equal(getCachedVoice(k1, { cacheDir: tmp }), null);
    assert.equal(getCachedVoice(k2, { cacheDir: tmp }), null);
    assert.equal(getCachedVoice(k3, { cacheDir: tmp }), p3);
    assert.ok(fs.existsSync(p3));
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});
