// Luật dùng giọng KOL người thật (Gói 7 — Task 8): văn bản đồng ý, phạm vi, duyệt kịch bản theo scriptHash.
// Dữ liệu riêng (văn bản đồng ý, giọng mẫu) chỉ nằm trong assets/private/ (gitignored), không commit.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export const DEFAULT_CONSENT_DIR = path.join(process.cwd(), 'assets', 'private', 'consents');
const ALLOWED_ENGINES = ['voxcpm2'];

export function isCloneCharacter(character) {
  return character?.voiceProfile?.mode === 'clone';
}

export function loadConsent(consentRef, { privateDir = DEFAULT_CONSENT_DIR } = {}) {
  if (!consentRef) return null;
  const safeRef = String(consentRef).replace(/[^A-Za-z0-9._-]/g, '');
  const filePath = path.join(privateDir, `${safeRef}.json`);
  if (!fs.existsSync(filePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
}

function endOfDay(dateStr) {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return null;
  d.setHours(23, 59, 59, 999);
  return d;
}

// Ném lỗi tiếng Việt nếu không được phép nhân bản giọng; trả về văn bản đồng ý (hoặc null nếu không cần).
export function assertVoiceConsent({ character, product, now = new Date(), privateDir = DEFAULT_CONSENT_DIR } = {}) {
  if (!isCloneCharacter(character)) return null;
  const id = character.id || '(không rõ)';
  const ref = character.voiceProfile.consentRef;
  const consent = ref ? loadConsent(ref, { privateDir }) : null;
  if (!consent) {
    throw new Error(
      `Nhân vật "${id}" chưa có văn bản đồng ý${ref ? ` (${ref})` : ''} trong assets/private/consents/ — không được nhân bản giọng.`
    );
  }
  if (consent.characterId && consent.characterId !== character.id) {
    throw new Error(`Văn bản đồng ý ${ref} thuộc nhân vật "${consent.characterId}", không khớp với "${id}".`);
  }
  if (consent.revokedAt && new Date(consent.revokedAt) <= now) {
    throw new Error(`KOL "${id}" đã thu hồi đồng ý dùng giọng từ ${consent.revokedAt} — không được sinh giọng mới.`);
  }
  const until = consent.validUntil ? endOfDay(consent.validUntil) : null;
  if (until && now > until) {
    throw new Error(`Văn bản đồng ý ${ref} đã hết hạn ngày ${consent.validUntil} — cần ký gia hạn trước khi dùng giọng.`);
  }
  const categories = consent.scope?.categories;
  if (Array.isArray(categories) && categories.length && !categories.includes(product?.category)) {
    throw new Error(
      `Ngành hàng "${product?.category || '(trống)'}" ngoài phạm vi đồng ý của KOL "${id}" (chỉ: ${categories.join(', ')}).`
    );
  }
  return consent;
}

export function computeScriptHash(campaign = {}) {
  const parts = [campaign.hookText || '', campaign.ctaText || '', ...(campaign.scenes || []).map((s) => s.subtitle || '')];
  return crypto.createHash('sha256').update(JSON.stringify(parts), 'utf8').digest('hex');
}

export function getApprovalState(campaign, character) {
  if (!isCloneCharacter(character)) return 'not-required';
  const a = campaign?.kolApproval;
  if (!a || a.status !== 'approved') return 'pending';
  return a.scriptHash === computeScriptHash(campaign) ? 'approved' : 'stale';
}

export function approveCampaign(campaign, approvedBy, now = new Date()) {
  const by = String(approvedBy || '').trim();
  if (!by) throw new Error('Cần ghi tên người duyệt (KOL hoặc người được KOL ủy quyền).');
  return {
    ...campaign,
    kolApproval: { status: 'approved', scriptHash: computeScriptHash(campaign), approvedBy: by, approvedAt: now.toISOString() }
  };
}

// Dùng trong validate-assets.mjs: lỗi chặn commit, cảnh báo thì vẫn đạt (máy khác không có dữ liệu riêng).
export function validateVoiceProfile(vp, label, { root = process.cwd(), privateDir = DEFAULT_CONSENT_DIR } = {}) {
  const errors = [];
  const warnings = [];
  if (!vp) return { errors, warnings };
  if (!ALLOWED_ENGINES.includes(vp.engine)) {
    errors.push(`[${label}] voiceProfile.engine "${vp.engine}" không được phép (chỉ ${ALLOWED_ENGINES.join(', ')}; OmniVoice là CC-BY-NC, cấm thương mại).`);
  }
  if (vp.mode !== 'design' && vp.mode !== 'clone') {
    errors.push(`[${label}] voiceProfile.mode phải là "design" hoặc "clone".`);
  }
  if (vp.mode === 'clone') {
    if (!vp.consentRef) {
      errors.push(`[${label}] Nhân bản giọng người thật cần voiceProfile.consentRef (mã văn bản đồng ý).`);
    } else if (!loadConsent(vp.consentRef, { privateDir })) {
      warnings.push(`[${label}] Không thấy văn bản đồng ý ${vp.consentRef} trên máy này (assets/private/consents/) — sẽ bị chặn khi sinh giọng.`);
    }
    if (vp.referenceAudio && !String(vp.referenceAudio).replace(/\\/g, '/').startsWith('assets/private/')) {
      errors.push(`[${label}] Giọng mẫu của KOL người thật phải nằm trong assets/private/ (không commit), đang là "${vp.referenceAudio}".`);
    }
  }
  if (vp.referenceAudio && !fs.existsSync(path.join(root, vp.referenceAudio))) {
    warnings.push(`[${label}] Chưa có file giọng mẫu ${vp.referenceAudio} trên máy này.`);
  }
  return { errors, warnings };
}
