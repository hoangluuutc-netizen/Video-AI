import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  loadConsent,
  assertVoiceConsent,
  computeScriptHash,
  getApprovalState,
  validateVoiceProfile,
  isCloneCharacter
} from '../lib/kol-consent.mjs';

const product = { id: 'ao', category: 'fashion' };
const clone = (consentRef = 'KOL-TEST-1') => ({
  id: 'kol-that',
  voiceProfile: {
    engine: 'voxcpm2',
    provider: 'voicestudio',
    mode: 'clone',
    voiceId: 'vs-1',
    referenceAudio: 'assets/private/voices/kol-that/voice-ref.wav',
    consentRef
  }
});
const design = () => ({ id: 'linh-dan', voiceProfile: { engine: 'voxcpm2', mode: 'design' } });

function withConsent(consent, fn) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'consent-'));
  try {
    if (consent) fs.writeFileSync(path.join(tmp, `${consent.consentRef}.json`), JSON.stringify(consent));
    return fn(tmp);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

const validConsent = {
  consentRef: 'KOL-TEST-1',
  characterId: 'kol-that',
  signedAt: '2026-11-20',
  validUntil: '2027-11-20',
  scope: { categories: ['fashion', 'beauty'], platforms: ['TikTok'] },
  revokedAt: null
};

test('isCloneCharacter chỉ đúng với mode clone', () => {
  assert.equal(isCloneCharacter(clone()), true);
  assert.equal(isCloneCharacter(design()), false);
  assert.equal(isCloneCharacter({ id: 'x' }), false);
});

test('loadConsent trả null khi không có file', () =>
  withConsent(null, (dir) => assert.equal(loadConsent('KHONG-CO', { privateDir: dir }), null)));

test('thiếu văn bản đồng ý → chặn', () =>
  withConsent(null, (dir) =>
    assert.throws(() => assertVoiceConsent({ character: clone('KOL-X'), product, privateDir: dir }), /chưa có văn bản đồng ý/)));

test('văn bản hợp lệ → cho phép và trả về văn bản', () =>
  withConsent(validConsent, (dir) => {
    const c = assertVoiceConsent({ character: clone(), product, now: new Date('2026-12-01'), privateDir: dir });
    assert.equal(c.consentRef, 'KOL-TEST-1');
  }));

test('hết hạn → chặn', () =>
  withConsent(validConsent, (dir) =>
    assert.throws(() => assertVoiceConsent({ character: clone(), product, now: new Date('2028-01-01'), privateDir: dir }), /hết hạn/)));

test('đã thu hồi → chặn', () =>
  withConsent({ ...validConsent, revokedAt: '2026-12-01' }, (dir) =>
    assert.throws(() => assertVoiceConsent({ character: clone(), product, now: new Date('2026-12-05'), privateDir: dir }), /thu hồi/)));

test('sai ngành hàng → chặn', () =>
  withConsent(validConsent, (dir) =>
    assert.throws(
      () => assertVoiceConsent({ character: clone(), product: { category: 'home' }, now: new Date('2026-12-01'), privateDir: dir }),
      /ngoài phạm vi/
    )));

test('văn bản của nhân vật khác → chặn', () =>
  withConsent({ ...validConsent, characterId: 'nguoi-khac' }, (dir) =>
    assert.throws(() => assertVoiceConsent({ character: clone(), product, now: new Date('2026-12-01'), privateDir: dir }), /không khớp/)));

test('design và nhân vật thường không cần đồng ý', () => {
  assert.equal(assertVoiceConsent({ character: design(), product }), null);
  assert.equal(assertVoiceConsent({ character: { id: 'x' }, product }), null);
});

const camp = () => ({
  hookText: 'Đừng mua áo này',
  ctaText: 'Chỉ 199.000đ',
  scenes: [{ subtitle: 'Câu một' }, { subtitle: 'Câu hai' }]
});

test('computeScriptHash ổn định và đổi khi lời đổi', () => {
  assert.equal(computeScriptHash(camp()), computeScriptHash(camp()));
  const c = camp();
  c.scenes[1].subtitle = 'Câu hai!';
  assert.notEqual(computeScriptHash(c), computeScriptHash(camp()));
});

test('getApprovalState: not-required / pending / approved / stale', () => {
  assert.equal(getApprovalState(camp(), design()), 'not-required');
  assert.equal(getApprovalState(camp(), clone()), 'pending');
  const approved = { ...camp(), kolApproval: { status: 'approved', scriptHash: computeScriptHash(camp()) } };
  assert.equal(getApprovalState(approved, clone()), 'approved');
  approved.scenes = [{ subtitle: 'Câu một' }, { subtitle: 'Đã sửa' }];
  assert.equal(getApprovalState(approved, clone()), 'stale');
});

test('validateVoiceProfile: clone hợp lệ không lỗi', () => {
  const r = validateVoiceProfile(clone().voiceProfile, 'c', { root: os.tmpdir(), privateDir: os.tmpdir() });
  assert.equal(r.errors.length, 0);
});

test('validateVoiceProfile: clone thiếu consentRef là lỗi', () => {
  const r = validateVoiceProfile({ ...clone().voiceProfile, consentRef: '' }, 'c', { root: os.tmpdir() });
  assert.match(r.errors[0], /đồng ý/);
});

test('validateVoiceProfile: clone có referenceAudio ngoài assets/private là lỗi', () => {
  const r = validateVoiceProfile(
    { ...clone().voiceProfile, referenceAudio: 'assets/characters/a/voice-ref.wav' },
    'c',
    { root: os.tmpdir() }
  );
  assert.equal(r.errors.length, 1);
  assert.match(r.errors[0], /assets\/private/);
});

test('validateVoiceProfile: engine omnivoice là lỗi', () => {
  const r = validateVoiceProfile({ engine: 'omnivoice', mode: 'design' }, 'c', { root: os.tmpdir() });
  assert.equal(r.errors.length, 1);
});

test('validateVoiceProfile: thiếu file văn bản đồng ý trên máy chỉ là cảnh báo', () => {
  const r = validateVoiceProfile(clone().voiceProfile, 'c', { root: os.tmpdir(), privateDir: path.join(os.tmpdir(), 'khong-co-thu-muc') });
  assert.equal(r.errors.length, 0);
  assert.ok(r.warnings.some((w) => /văn bản đồng ý/.test(w)));
});
