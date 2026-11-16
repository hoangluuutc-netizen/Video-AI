import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { planVoiceRevocation, executeVoiceRevocation } from '../revoke-voice.mjs';
import { putCachedVoice, getCachedVoice } from '../lib/voice-cache.mjs';

function scaffold() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'revoke-'));
  const w = (rel, data) => {
    const p = path.join(root, rel);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, typeof data === 'string' ? data : JSON.stringify(data));
  };
  w('assets/private/consents/K1.json', { consentRef: 'K1', characterId: 'kol-a', revokedAt: null });
  w('assets/private/consents/K2.json', { consentRef: 'K2', characterId: 'kol-b', revokedAt: null });
  w('assets/private/voices/kol-a/voice-ref.wav', 'RIFF');
  w('campaigns/c1/campaign.json', { characterId: 'kol-a' });
  w('campaigns/c1/media/audio/scene-1.wav', 'RIFF');
  w('campaigns/c2/campaign.json', { characterId: 'kol-b' });
  w('campaigns/c2/media/audio/scene-1.wav', 'RIFF');
  return root;
}

test('planVoiceRevocation chỉ chọn dữ liệu của đúng nhân vật', () => {
  const root = scaffold();
  try {
    const plan = planVoiceRevocation('kol-a', { root });
    assert.equal(plan.consents.length, 1);
    assert.ok(plan.voiceDir.endsWith(path.join('voices', 'kol-a')));
    assert.equal(plan.campaignAudioDirs.length, 1);
    assert.ok(plan.campaignAudioDirs[0].includes(`${path.sep}c1${path.sep}`));
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('executeVoiceRevocation đánh dấu thu hồi, xóa giọng mẫu, audio và cache của nhân vật; giữ nhân vật khác', () => {
  const root = scaffold();
  const cacheDir = path.join(root, 'assets', 'voice-cache');
  try {
    putCachedVoice('ka', Buffer.from('a'), { cacheDir, characterId: 'kol-a' });
    putCachedVoice('kb', Buffer.from('b'), { cacheDir, characterId: 'kol-b' });
    const plan = planVoiceRevocation('kol-a', { root });
    const removed = executeVoiceRevocation('kol-a', plan, { now: new Date('2026-12-01'), cacheDir });
    assert.equal(removed, 1);
    assert.equal(JSON.parse(fs.readFileSync(path.join(root, 'assets/private/consents/K1.json'), 'utf8')).revokedAt, '2026-12-01');
    assert.equal(JSON.parse(fs.readFileSync(path.join(root, 'assets/private/consents/K2.json'), 'utf8')).revokedAt, null);
    assert.equal(fs.existsSync(path.join(root, 'assets/private/voices/kol-a')), false);
    assert.equal(fs.existsSync(path.join(root, 'campaigns/c1/media/audio')), false);
    assert.equal(fs.existsSync(path.join(root, 'campaigns/c2/media/audio')), true);
    assert.equal(getCachedVoice('kb', { cacheDir }) !== null, true);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
