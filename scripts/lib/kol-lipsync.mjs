// Kế hoạch tạo clip Lip-Sync AI cho KOL (POST /api/kol/lipsync-ai) — hàm thuần, KHÔNG gọi API.
// Thiết kế:
//  - Ảnh khung = ảnh chân dung GỐC của KOL (copy nguyên byte, $0) — không để AI vẽ lại khuôn mặt.
//    Vì là ảnh gốc nên đã đạt QC (qcStatus "approved"); người dùng duyệt CHI PHÍ ở hộp xác nhận trên giao diện.
//  - Ước tính theo đúng số giây clip (Fal Kling tính tròn 5s/10s); vượt ngân sách thì chặn trước khi gọi.
//  - Lời thoại đi vào scene.subtitle (prompt-builder đọc trường này), prompt lip-sync vào visualAction.
//  - Chiến dịch riêng kol-<id>-lipsync, không ghi đè chiến dịch video KOL kol-<id>.
import fs from 'node:fs';
import path from 'node:path';
import { estimateVideoCost, falBilledSeconds } from './cost-ledger.mjs';
import { FAL_VIDEO_ENDPOINTS } from './fal-client.mjs';
import { assertVoiceConsent, DEFAULT_CONSENT_DIR } from './kol-consent.mjs';

export const LIPSYNC_MIN_SEC = 4;
export const LIPSYNC_MAX_SEC = 8;
const FREE_VIDEO_MODELS = new Set(['ffmpeg-bokeh-cinema', 'ffmpeg-anchored-real', '']);
const PORTRAIT_KEYS = ['portrait', 'halfBody', 'front', 'fullBody'];
const AI_MADE_KEYS = new Set(['sheet4Angles', 'referenceChart']); // ảnh do AI/ghép tạo ra, không phải ảnh gốc

export function pickPortrait(referenceImages = {}, root = process.cwd()) {
  const refs = referenceImages || {};
  const ordered = [
    ...PORTRAIT_KEYS.filter((k) => refs[k]),
    ...Object.keys(refs).filter((k) => !PORTRAIT_KEYS.includes(k) && !AI_MADE_KEYS.has(k))
  ];
  for (const key of ordered) {
    const rel = refs[key];
    if (typeof rel !== 'string' || !rel) continue;
    const abs = path.isAbsolute(rel) ? rel : path.join(root, rel);
    if (fs.existsSync(abs) && !fs.statSync(abs).isDirectory()) return abs;
  }
  return '';
}

export function planLipSync({ character, product, aiConfig = {}, body = {}, root = process.cwd(), privateDir = DEFAULT_CONSENT_DIR } = {}) {
  const errors = [];
  const durationSec = Math.min(LIPSYNC_MAX_SEC, Math.max(LIPSYNC_MIN_SEC, Number(body.durationSec || 5)));
  const videoModel = String(aiConfig.videoModel || '');
  const billedSec = FAL_VIDEO_ENDPOINTS[videoModel] ? falBilledSeconds(durationSec, videoModel) : durationSec;
  const estimate = estimateVideoCost({
    imageModel: 'ffmpeg-real-composite', // ảnh khung là ảnh chân dung gốc → $0
    videoModel: videoModel || 'ffmpeg-bokeh-cinema',
    ttsModel: aiConfig.ttsModel,
    aiSceneCount: 1,
    sceneSec: billedSec,
    maxUsd: aiConfig.maxCostUsdPerVideo
  });

  if (!character?.id) errors.push('Không tìm thấy hồ sơ KOL.');
  if (!product?.id) errors.push('Hãy chọn 1 sản phẩm cho clip Lip-Sync (để giữ đúng sản phẩm thật trong khung hình).');
  if (FREE_VIDEO_MODELS.has(videoModel)) {
    errors.push('Đang chọn công cụ video $0 (FFmpeg). Hãy chọn model Video AI (Wan 2.2 / Kling / Veo 3.1) trong "⚙️ Bộ não & chi phí".');
  }
  const portraitAbs = character?.id ? pickPortrait(character.referenceImages, root) : '';
  if (character?.id && !portraitAbs) errors.push(`KOL "${character.name || character.id}" chưa có ảnh chân dung gốc.`);
  if (!estimate.withinBudget) {
    errors.push(`Vượt ngân sách: ước tính $${estimate.totalUsd} > $${estimate.maxUsd} / video (${videoModel}, ${billedSec}s).`);
  }
  if (character?.id) {
    try {
      assertVoiceConsent({ character, product, privateDir }); // KOL người thật (mode clone) phải có văn bản đồng ý còn hiệu lực
    } catch (e) {
      errors.push(e.message);
    }
  }

  const voiceText = String(body.voiceText || character?.catchphrase || '').trim();
  const campId = `kol-${character?.id || 'unknown'}-lipsync`;
  const campaign = {
    id: campId,
    title: `KOL AI Lip-Sync: ${character?.name || ''}`,
    productId: product?.id || '',
    characterId: character?.id || '',
    hook: body.hookTitle || character?.name || '',
    scenes: [
      {
        id: 'scene-1',
        type: 'ai-experience',
        durationSec,
        subtitle: voiceText,
        caption: body.hookTitle || character?.name || '',
        visualAction:
          String(body.veoLipSyncPrompt || '').trim() ||
          `${character?.name || 'KOL'} nói trực diện vào camera, khẩu hình khớp từng chữ lời thoại, giữ nguyên 100% khuôn mặt trong ảnh gốc.`,
        keyframeSrc: 'media/keyframes/scene-1.png',
        qcStatus: 'approved',
        qcNote: 'Ảnh khung là ảnh chân dung gốc của KOL (không qua AI) — đạt QC ảnh khung.'
      }
    ]
  };

  return {
    ok: errors.length === 0,
    errors,
    overBudget: !estimate.withinBudget,
    estimate,
    billedSec,
    portraitAbs,
    campaign
  };
}
