import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync, execFileSync } from 'node:child_process';
import { ROOT, VERTICAL_FILTER, loadCatalog, resolveFootageScenes } from './lib/footage.mjs';
import { readJson } from './lib/prompt-builder.mjs';

const THRESHOLD = 0.9; // SSIM tối thiểu (cho phép sai số do nén lại H.264)

function extractFrame(input, timeSec, outPng, vf) {
  const args = ['-y', '-v', 'error', '-ss', timeSec.toFixed(3), '-i', input, '-frames:v', '1'];
  if (vf) args.push('-vf', vf);
  args.push(outPng);
  execFileSync('ffmpeg', args);
}

function ssim(a, b) {
  const r = spawnSync('ffmpeg', ['-i', a, '-i', b, '-lavfi', 'ssim', '-f', 'null', '-'], { encoding: 'utf8' });
  const m = /All:([0-9.]+)/.exec(r.stderr || '');
  if (!m) throw new Error('Không đọc được SSIM từ ffmpeg');
  return parseFloat(m[1]);
}

function main() {
  const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
  const [campaignArg, videoArg] = args;
  if (!campaignArg) {
    console.error('Cách dùng: node scripts/verify-integrity.mjs <campaign.json> [video.mp4]');
    console.error('Mặc định video = <thư mục chiến dịch>/out/ffmpeg-9x16.mp4 (chỉ gồm các cảnh quay thật nối liền).');
    process.exit(1);
  }
  const campaignPath = path.isAbsolute(campaignArg) ? campaignArg : path.join(ROOT, campaignArg);
  const campaign = readJson(campaignPath);
  const video = videoArg
    ? (path.isAbsolute(videoArg) ? videoArg : path.join(ROOT, videoArg))
    : path.join(path.dirname(campaignPath), 'out', 'ffmpeg-9x16.mp4');
  if (!fs.existsSync(video)) {
    console.error(`Không tìm thấy video thành phẩm: ${video}`);
    process.exit(1);
  }

  const { items, errors } = resolveFootageScenes(campaign, loadCatalog());
  if (errors.length > 0 || items.length === 0) {
    errors.forEach((e) => console.error(' - ' + e));
    console.error(items.length === 0 ? 'Không có cảnh quay thật để kiểm.' : 'Dữ liệu cảnh chưa hợp lệ.');
    process.exit(1);
  }

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'verify-'));
  let offset = 0;
  let failed = 0;
  try {
    items.forEach((it, i) => {
      const mid = it.dur / 2;
      const outPng = path.join(tmp, `out-${i}.png`);
      const srcPng = path.join(tmp, `src-${i}.png`);
      extractFrame(video, offset + mid, outPng);
      // Khung gốc đi qua đúng bộ lọc cắt dọc xác định (không AI) để so cùng hệ quy chiếu.
      extractFrame(it.absPath, it.start + mid, srcPng, VERTICAL_FILTER);
      const score = ssim(outPng, srcPng);
      const ok = score >= THRESHOLD;
      if (!ok) failed++;
      console.log(`${ok ? 'ĐẠT' : 'HỎNG'} | ${it.scene.id} | SSIM=${score.toFixed(4)} (ngưỡng ${THRESHOLD})`);
      offset += it.dur;
    });
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }

  if (failed > 0) {
    console.error(`KIỂM NGUYÊN VẸN THẤT BẠI: ${failed}/${items.length} cảnh lệch quá ngưỡng.`);
    process.exit(1);
  }
  console.log(`OK: ${items.length}/${items.length} cảnh khớp cảnh gốc — hình sản phẩm và người không bị biến đổi.`);
}

main();
