import fs from 'node:fs';
import path from 'node:path';
import { execFileSync, spawn } from 'node:child_process';

const ROOT = process.cwd();

function assertFile(relPath) {
  const abs = path.join(ROOT, relPath);
  if (!fs.existsSync(abs)) {
    throw new Error(`Thiếu file kiểm thử bắt buộc: ${relPath}`);
  }
}

async function waitForServer(url, retries = 15) {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url);
      if (res.ok) return await res.json();
    } catch {
      // Đợi server khởi động
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error(`Không kết nối được server tại ${url}`);
}

async function main() {
  console.log('1. Kiểm tra dữ liệu tài sản & chiến dịch...');
  execFileSync('node', [path.join(ROOT, 'scripts', 'validate-assets.mjs')], { stdio: 'inherit' });

  console.log('2. Kiểm tra đầy đủ file đầu ra mẫu...');
  [
    'assets/characters/sample-kol/character-sheet-4angles.png',
    'assets/products/batch-template.csv',
    'campaigns/sample-campaign/prompts.md',
    'campaigns/sample-campaign/veo3-prompts.json',
    'campaigns/sample-campaign/muse-ai-pack.json',
    'campaigns/sample-campaign/media/audio/voiceover-full.mp3',
    'campaigns/sample-campaign/media/audio/subtitles.srt',
    'campaigns/sample-campaign/media/audio/subtitles.ass',
    'campaigns/sample-campaign/out/ffmpeg-9x16.mp4',
    'campaigns/sample-campaign/out/ffmpeg-1x1.mp4',
    'campaigns/sample-campaign/out/ffmpeg-16x9.mp4'
  ].forEach(assertFile);
  console.log('OK: Đủ 11 file đầu ra mẫu (3 tỷ lệ MP4, audio, phụ đề .srt/.ass, prompts, character sheet).');

  console.log('3. Kiểm tra chất lượng video mẫu 9:16...');
  execFileSync(
    'node',
    [
      path.join(ROOT, 'scripts', 'verify-integrity.mjs'),
      'campaigns/sample-campaign/campaign.json',
      'campaigns/sample-campaign/out/ffmpeg-9x16.mp4'
    ],
    { stdio: 'inherit' }
  );

  console.log('4. Kiểm tra khởi động Dashboard Server & API...');
  const port = 4179;
  const child = spawn('node', [path.join(ROOT, 'scripts', 'dashboard-server.mjs')], {
    env: { ...process.env, PORT: String(port) },
    stdio: 'ignore'
  });

  try {
    const state = await waitForServer(`http://localhost:${port}/api/state`);
    if (!state.products?.length || !state.campaigns?.length) {
      throw new Error('API /api/state trả về thiếu dữ liệu products/campaigns');
    }
    const remakeRes = await fetch(`http://localhost:${port}/api/ai-remake`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clipId: 'video-m-u', productId: 'sample-product', category: 'home', style: 'ugc-iphone' })
    });
    const remake = await remakeRes.json();
    if (!remake.ok || !remake.remake?.shots?.length) {
      throw new Error('API /api/ai-remake không trả về danh sách phân cảnh');
    }
    console.log(`OK: Dashboard Server phản hồi chuẩn (products=${state.products.length}, remakeShots=${remake.remake.shots.length}).`);
  } finally {
    child.kill();
  }

  console.log('\n=== SMOKE TEST ĐẠT 100% — HỆ THỐNG SẴN SÀNG TEST THỬ ===');
}

main().catch((e) => {
  console.error('SMOKE TEST THẤT BẠI:', e.message);
  process.exit(1);
});
