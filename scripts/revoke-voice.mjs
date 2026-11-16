// Thu hồi giọng của một KOL người thật (Gói 7 — Task 8).
// Cách dùng: node scripts/revoke-voice.mjs <characterId>         → chỉ liệt kê những gì sẽ bị xóa
//            node scripts/revoke-voice.mjs <characterId> --yes   → đánh dấu thu hồi + xóa thật (không khôi phục được)
import fs from 'node:fs';
import path from 'node:path';
import { purgeVoiceCache } from './lib/voice-cache.mjs';

const ROOT = process.cwd();

export function planVoiceRevocation(characterId, { root = ROOT } = {}) {
  const consentsDir = path.join(root, 'assets', 'private', 'consents');
  const consents = fs.existsSync(consentsDir)
    ? fs.readdirSync(consentsDir)
        .filter((f) => f.endsWith('.json'))
        .map((f) => path.join(consentsDir, f))
        .filter((f) => {
          try {
            return JSON.parse(fs.readFileSync(f, 'utf8')).characterId === characterId;
          } catch {
            return false;
          }
        })
    : [];
  const voiceDir = path.join(root, 'assets', 'private', 'voices', characterId);
  const campaignsDir = path.join(root, 'campaigns');
  const campaignAudioDirs = fs.existsSync(campaignsDir)
    ? fs.readdirSync(campaignsDir, { withFileTypes: true })
        .filter((d) => d.isDirectory())
        .map((d) => path.join(campaignsDir, d.name))
        .filter((dir) => {
          const f = path.join(dir, 'campaign.json');
          try {
            return fs.existsSync(f) && JSON.parse(fs.readFileSync(f, 'utf8')).characterId === characterId;
          } catch {
            return false;
          }
        })
        .map((dir) => path.join(dir, 'media', 'audio'))
        .filter((d) => fs.existsSync(d))
    : [];
  return { consents, voiceDir: fs.existsSync(voiceDir) ? voiceDir : null, campaignAudioDirs };
}

export function executeVoiceRevocation(characterId, plan, { now = new Date(), cacheDir } = {}) {
  for (const f of plan.consents) {
    const c = JSON.parse(fs.readFileSync(f, 'utf8'));
    c.revokedAt = c.revokedAt || now.toISOString().slice(0, 10);
    fs.writeFileSync(f, JSON.stringify(c, null, 2) + '\n', 'utf8');
  }
  if (plan.voiceDir) fs.rmSync(plan.voiceDir, { recursive: true, force: true });
  for (const d of plan.campaignAudioDirs) fs.rmSync(d, { recursive: true, force: true });
  return purgeVoiceCache(characterId, cacheDir ? { cacheDir } : undefined);
}

if (process.argv[1]?.endsWith('revoke-voice.mjs')) {
  const characterId = process.argv[2];
  const yes = process.argv.includes('--yes');
  if (!characterId || characterId.startsWith('--')) {
    console.error('Cách dùng: node scripts/revoke-voice.mjs <characterId> [--yes]');
    process.exit(1);
  }
  const plan = planVoiceRevocation(characterId);
  const rel = (p) => path.relative(ROOT, p);
  console.log(`Thu hồi giọng của "${characterId}":`);
  console.log(`- Đánh dấu thu hồi ${plan.consents.length} văn bản đồng ý: ${plan.consents.map(rel).join(', ') || '(không có)'}`);
  console.log(`- Xóa giọng mẫu: ${plan.voiceDir ? rel(plan.voiceDir) : '(không có)'}`);
  console.log(`- Xóa audio đã dựng của ${plan.campaignAudioDirs.length} chiến dịch: ${plan.campaignAudioDirs.map(rel).join(', ') || '(không có)'}`);
  console.log('- Xóa các file giọng của nhân vật này trong assets/voice-cache/');
  console.log('- VIỆC THỦ CÔNG: mở VoiceStudio → thư viện giọng → xóa giọng đã lưu của KOL này (thư mục dữ liệu VoiceStudio ghi trong docs/SPEECH_API_NOTES.md).');
  console.log('- Video đã đăng lên nền tảng: xử lý theo điều khoản trong văn bản đồng ý (không tự động).');
  if (!yes) {
    console.log('\nChưa xóa gì. Chạy lại với --yes để thực hiện (không khôi phục được).');
  } else {
    const removed = executeVoiceRevocation(characterId, plan);
    console.log(`\nĐã thu hồi: ${plan.consents.length} văn bản, ${removed} file cache giọng, ${plan.campaignAudioDirs.length} thư mục audio.`);
  }
}
