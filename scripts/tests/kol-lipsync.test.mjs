// Nút "✨ Tạo Clip Lip-Sync AI" (KOL Studio). Chỉ test kế hoạch — KHÔNG gọi API tốn tiền.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { planLipSync, pickPortrait } from '../lib/kol-lipsync.mjs';

function tmpRoot() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lipsync-'));
  fs.mkdirSync(path.join(root, 'assets', 'characters', 'linh-dan'), { recursive: true });
  fs.writeFileSync(path.join(root, 'assets', 'characters', 'linh-dan', 'portrait.png'), 'png');
  fs.writeFileSync(path.join(root, 'assets', 'characters', 'linh-dan', 'sheet.png'), 'png');
  return root;
}

const character = {
  id: 'linh-dan',
  name: 'Linh Đan',
  catchphrase: 'Xin chào cả nhà!',
  referenceImages: { sheet4Angles: 'assets/characters/linh-dan/sheet.png', portrait: 'assets/characters/linh-dan/portrait.png' }
};
const product = { id: 'sample-product', name: 'Bình Giữ Nhiệt', category: 'home' };
const veo = { imageModel: 'gemini-3-pro-image', videoModel: 'veo-3.1-generate-001', ttsModel: 'google-vi-natural', maxCostUsdPerVideo: 5 };
const body = { characterId: 'linh-dan', productId: 'sample-product', voiceText: 'Mình là Linh Đan, xem cùng mình nhé!', veoLipSyncPrompt: 'Close-up, she speaks to camera, natural lip-sync.', durationSec: 8 };

test('pickPortrait: ưu tiên ảnh chân dung gốc, không lấy ảnh 4 góc do AI vẽ', () => {
  const root = tmpRoot();
  try {
    assert.equal(pickPortrait(character.referenceImages, root), path.join(root, 'assets/characters/linh-dan/portrait.png'));
    assert.equal(pickPortrait({ sheet4Angles: 'assets/characters/linh-dan/sheet.png' }, root), '');
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('ước tính theo ĐÚNG số giây clip: Veo 3.1 8s = $3.20 (bản cũ luôn tính 5s = $2.00)', () => {
  const root = tmpRoot();
  try {
    const plan = planLipSync({ character, product, aiConfig: veo, body, root });
    assert.deepEqual(plan.errors, []);
    const video = plan.estimate.items.find((i) => i.step === 'video');
    assert.equal(video.units, 8);
    assert.equal(plan.estimate.totalUsd, 3.2);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('Fal Kling tính tròn clip: 8s → trả tiền 10s', () => {
  const root = tmpRoot();
  try {
    const plan = planLipSync({ character, product, aiConfig: { ...veo, videoModel: 'fal-kling-turbo' }, body, root });
    assert.equal(plan.estimate.items.find((i) => i.step === 'video').units, 10);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('ảnh khung = ảnh chân dung gốc ($0, không AI vẽ lại) dù đang chọn model ảnh tốn tiền', () => {
  const root = tmpRoot();
  try {
    const plan = planLipSync({ character, product, aiConfig: veo, body, root });
    assert.equal(plan.estimate.items.some((i) => i.step === 'keyframe' && i.usd > 0), false);
    assert.equal(plan.portraitAbs, path.join(root, 'assets/characters/linh-dan/portrait.png'));
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('cảnh mang đúng lời thoại (subtitle) và prompt lip-sync (visualAction); đã qua QC vì là ảnh gốc', () => {
  const root = tmpRoot();
  try {
    const { campaign } = planLipSync({ character, product, aiConfig: veo, body, root });
    assert.equal(campaign.id, 'kol-linh-dan-lipsync');
    const s = campaign.scenes[0];
    assert.equal(s.subtitle, body.voiceText); // prompt-builder đọc lời thoại từ subtitle
    assert.equal(s.visualAction, body.veoLipSyncPrompt);
    assert.equal(s.keyframeSrc, 'media/keyframes/scene-1.png');
    assert.equal(s.qcStatus, 'approved');
    assert.equal(s.durationSec, 8);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('chặn trước khi tốn tiền: vượt ngân sách / model $0 / thiếu sản phẩm / thiếu ảnh chân dung', () => {
  const root = tmpRoot();
  try {
    const over = planLipSync({ character, product, aiConfig: { ...veo, maxCostUsdPerVideo: 0.5 }, body, root });
    assert.equal(over.overBudget, true);
    assert.match(over.errors.join(' '), /Vượt ngân sách/);

    const free = planLipSync({ character, product, aiConfig: { ...veo, videoModel: 'ffmpeg-bokeh-cinema' }, body, root });
    assert.match(free.errors.join(' '), /model Video AI/);

    const noProduct = planLipSync({ character, product: null, aiConfig: veo, body: { ...body, productId: '' }, root });
    assert.match(noProduct.errors.join(' '), /sản phẩm/);

    const noPortrait = planLipSync({ character: { ...character, referenceImages: {} }, product, aiConfig: veo, body, root });
    assert.match(noPortrait.errors.join(' '), /ảnh chân dung/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('KOL người thật (mode clone) thiếu văn bản đồng ý → chặn', () => {
  const root = tmpRoot();
  try {
    const realKol = { ...character, voiceProfile: { mode: 'clone', engine: 'voxcpm2', provider: 'voicestudio', consentRef: 'KHONG-CO' } };
    const plan = planLipSync({ character: realKol, product, aiConfig: veo, body, root, privateDir: path.join(root, 'private') });
    assert.match(plan.errors.join(' '), /đồng ý/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
