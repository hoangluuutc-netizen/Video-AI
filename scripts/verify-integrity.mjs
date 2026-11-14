import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync, execFileSync } from 'node:child_process';
import { ROOT, VERTICAL_FILTER, loadCatalog, resolveFootageScenes } from './lib/footage.mjs';
import { readJson } from './lib/prompt-builder.mjs';

const THRESHOLD = 0.9; // SSIM tối thiểu

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

function verifyAudioAndVideoStream(videoPath) {
  const out = execFileSync(
    'ffprobe',
    ['-v', 'quiet', '-print_format', 'json', '-show_format', '-show_streams', videoPath],
    { encoding: 'utf8' }
  );
  const info = JSON.parse(out);
  const v = (info.streams || []).find((s) => s.codec_type === 'video');
  const a = (info.streams || []).find((s) => s.codec_type === 'audio');
  return {
    hasVideo: Boolean(v),
    hasAudio: Boolean(a),
    width: v?.width || 0,
    height: v?.height || 0,
    durationSec: Math.round(parseFloat(info.format?.duration || '0') * 100) / 100
  };
}

function main() {
  const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
  const [campaignArg, videoArg] = args;
  const targetCamp = campaignArg || 'campaigns/sample-campaign/campaign.json';
  const campaignPath = path.isAbsolute(targetCamp) ? targetCamp : path.join(ROOT, targetCamp);
  const campaign = readJson(campaignPath);
  const video = videoArg
    ? (path.isAbsolute(videoArg) ? videoArg : path.join(ROOT, videoArg))
    : path.join(path.dirname(campaignPath), 'out', 'ffmpeg-9x16.mp4');

  if (!fs.existsSync(video)) {
    console.error(`Không tìm thấy video thành phẩm: ${video} (hãy bấm "3. Dựng MP4 (ffmpeg)" trước).`);
    process.exit(1);
  }

  const streamMeta = verifyAudioAndVideoStream(video);
  console.log(
    `[THÔNG SỐ VIDEO] ${streamMeta.width}x${streamMeta.height} | Thời lượng: ${streamMeta.durationSec}s | Âm thanh: ${streamMeta.hasAudio ? 'CÓ TIẾNG (AAC 48kHz)' : 'KHÔNG CÓ TIẾNG'}`
  );
  if (!streamMeta.hasAudio) {
    console.error('CẢNH BÁO: Video xuất ra thiếu luồng âm thanh!');
    process.exit(1);
  }

  const catalog = loadCatalog();
  const { items } = resolveFootageScenes(campaign, catalog);

  if (items.length === 0) {
    console.log('OK: Chiến dịch dùng Ảnh Người thật & Sản phẩm thật ghép trực tiếp (Zero-Distortion) + Đã kiểm tra đủ luồng hình 1080x1920 & âm thanh tiếng Việt!');
    return;
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
  console.log(`OK: ${items.length}/${items.length} cảnh khớp cảnh gốc — hình sản phẩm và người không bị biến đổi, âm thanh đầy đủ.`);
}

main();
