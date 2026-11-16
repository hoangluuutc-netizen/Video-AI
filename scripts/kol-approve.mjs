// Ghi nhận KOL đã duyệt kịch bản hiện tại (Gói 7 — Task 8).
// Cách dùng: node scripts/kol-approve.mjs <campaign.json> --by "Tên KOL hoặc người được ủy quyền"
// Duyệt gắn với scriptHash: sửa bất kỳ lời thoại/hook/CTA nào sau đó sẽ làm video quay lại trạng thái nháp.
import fs from 'node:fs';
import path from 'node:path';
import { approveCampaign, computeScriptHash, getApprovalState } from './lib/kol-consent.mjs';

const ROOT = process.cwd();

export function approveCampaignFile(campaignPath, approvedBy) {
  const campaign = JSON.parse(fs.readFileSync(campaignPath, 'utf8'));
  const charPath = path.join(ROOT, 'assets', 'characters', campaign.characterId || '', 'character.json');
  const character = fs.existsSync(charPath) ? JSON.parse(fs.readFileSync(charPath, 'utf8')) : {};
  const before = getApprovalState(campaign, character);
  const updated = approveCampaign(campaign, approvedBy);
  const tmp = `${campaignPath}.tmp-${process.pid}`;
  fs.writeFileSync(tmp, JSON.stringify(updated, null, 2) + '\n', 'utf8');
  fs.renameSync(tmp, campaignPath);
  return { before, scriptHash: computeScriptHash(updated), approvedBy: updated.kolApproval.approvedBy, required: before !== 'not-required' };
}

if (process.argv[1]?.endsWith('kol-approve.mjs')) {
  const args = process.argv.slice(2);
  const byIdx = args.indexOf('--by');
  const by = byIdx >= 0 ? args[byIdx + 1] : '';
  const campArg = args.find((a, i) => !a.startsWith('--') && i !== byIdx + 1);
  if (!campArg) {
    console.error('Cách dùng: node scripts/kol-approve.mjs <campaign.json> --by "Tên người duyệt"');
    process.exit(1);
  }
  const abs = path.isAbsolute(campArg) ? campArg : path.join(ROOT, campArg);
  try {
    const r = approveCampaignFile(abs, by);
    console.log(`OK: "${r.approvedBy}" đã duyệt kịch bản (${r.scriptHash.slice(0, 12)}…). Trạng thái trước: ${r.before}.`);
    if (!r.required) console.log('Lưu ý: nhân vật của chiến dịch này không nhân bản giọng người thật nên không bắt buộc duyệt.');
  } catch (e) {
    console.error('LỖI duyệt kịch bản:', e.message);
    process.exit(1);
  }
}
