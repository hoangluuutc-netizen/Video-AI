import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { ROOT, VERTICAL_FILTER, loadCatalog } from './lib/footage.mjs';
import { readJson } from './lib/prompt-builder.mjs';
import { generateCampaignVoiceover } from './generate-voiceover.mjs';

function csvCell(v) {
  return `"${String(v ?? '').replace(/"/g, '""')}"`;
}

function fmt(t) {
  const m = Math.floor(t / 60);
  const s = (t - m * 60).toFixed(2).padStart(5, '0');
  return `${String(m).padStart(2, '0')}:${s}`;
}

function findFirstExisting(candidates) {
  for (const rel of candidates) {
    if (!rel) continue;
    const abs = path.isAbsolute(rel) ? rel : path.join(ROOT, rel);
    if (fs.existsSync(abs)) return abs;
  }
  return '';
}

function renderSceneSegment(scene, idx, ctx, tmpDir) {
  const { campaignDir, catalog, productImgAbs, charImgAbs } = ctx;
  const dur = Math.max(1, Number(scene.durationSec || 4));
  const segOut = path.join(tmpDir, `seg-${String(idx).padStart(2, '0')}.mp4`);
  const audioAbs = scene.audioSrc ? path.join(campaignDir, scene.audioSrc) : '';
  const hasVoiceover = audioAbs && fs.existsSync(audioAbs);

  // 1. Kiểm tra nếu cảnh có video quay thật trong catalog hoặc video AI đã render
  const clipMeta = scene.footageId ? catalog.get(scene.footageId) : null;
  const clipAbs = clipMeta && fs.existsSync(path.join(ROOT, clipMeta.filePath))
    ? path.join(ROOT, clipMeta.filePath)
    : scene.videoSrc && fs.existsSync(path.join(campaignDir, scene.videoSrc))
    ? path.join(campaignDir, scene.videoSrc)
    : '';

  if (clipAbs) {
    const start = Number(scene.trimStartSec ?? 0);
    const args = ['-y', '-v', 'error', '-ss', String(start), '-t', String(dur), '-i', clipAbs];
    if (hasVoiceover) {
      args.push('-i', audioAbs);
      if (clipMeta?.hasAudio) {
        args.push(
          '-filter_complex',
          `[0:v]${VERTICAL_FILTER}[v];[0:a]volume=0.35[a0];[1:a]volume=1.0[a1];[a0][a1]amix=inputs=2:duration=first:dropout_transition=0[a]`,
          '-map', '[v]', '-map', '[a]'
        );
      } else {
        args.push('-vf', VERTICAL_FILTER, '-map', '0:v:0', '-map', '1:a:0');
      }
    } else {
      args.push('-f', 'lavfi', '-i', 'anullsrc=r=48000:cl=stereo');
      args.push('-vf', VERTICAL_FILTER, '-map', '0:v:0', '-map', clipMeta?.hasAudio ? '0:a:0' : '1:a:0');
    }
    args.push(
      '-c:v', 'libx264', '-crf', '16', '-preset', 'medium', '-pix_fmt', 'yuv420p',
      '-c:a', 'aac', '-ar', '48000', '-ac', '2', '-shortest', segOut
    );
    execFileSync('ffmpeg', args, { stdio: 'inherit' });
    return segOut;
  }

  // 2. Cảnh tạo từ Ảnh Người Thật + Ảnh Sản Phẩm Thật (hoặc Keyframe đã duyệt) — Giữ nguyên 100% chi tiết ảnh gốc!
  const keyframeAbs = scene.keyframeSrc && fs.existsSync(path.join(campaignDir, scene.keyframeSrc))
    ? path.join(campaignDir, scene.keyframeSrc)
    : '';
  const isProductFocus = scene.type === 'real-product-closeup' || scene.type === 'offer-cta';
  const primaryImg = keyframeAbs || (isProductFocus ? (productImgAbs || charImgAbs) : (charImgAbs || productImgAbs));
  const secondaryImg = !keyframeAbs && charImgAbs && productImgAbs ? (isProductFocus ? charImgAbs : productImgAbs) : '';

  const bgHex = scene.type === 'offer-cta' ? '0x1E1B4B' : '0x0F172A';
  const args = ['-y', '-v', 'error', '-f', 'lavfi', '-i', `color=c=${bgHex}:s=1080x1920:r=30:d=${dur}`];

  if (primaryImg && secondaryImg && primaryImg !== secondaryImg) {
    // Ghép đồng thời cả Ảnh Người Thật và Ảnh Sản Phẩm Thật trên cùng khung 1080x1920 sắc nét, không biến dạng tỷ lệ
    args.push('-loop', '1', '-t', String(dur), '-i', primaryImg);
    args.push('-loop', '1', '-t', String(dur), '-i', secondaryImg);
    if (hasVoiceover) args.push('-i', audioAbs);
    else args.push('-f', 'lavfi', '-i', `anullsrc=r=48000:cl=stereo:d=${dur}`);

    args.push(
      '-filter_complex',
      `[1:v]scale=920:820:force_original_aspect_ratio=decrease[p1];` +
      `[2:v]scale=760:680:force_original_aspect_ratio=decrease[p2];` +
      `[0:v][p1]overlay=(W-w)/2:140[tmp];` +
      `[tmp][p2]overlay=(W-w)/2:1020,setsar=1,fps=30[v]`,
      '-map', '[v]', '-map', '3:a:0'
    );
  } else if (primaryImg) {
    args.push('-loop', '1', '-t', String(dur), '-i', primaryImg);
    if (hasVoiceover) args.push('-i', audioAbs);
    else args.push('-f', 'lavfi', '-i', `anullsrc=r=48000:cl=stereo:d=${dur}`);

    args.push(
      '-filter_complex',
      `[1:v]scale=980:1480:force_original_aspect_ratio=decrease[fg];` +
      `[0:v][fg]overlay=(W-w)/2:(H-h)/2,setsar=1,fps=30[v]`,
      '-map', '[v]', '-map', '2:a:0'
    );
  } else {
    if (hasVoiceover) args.push('-i', audioAbs);
    else args.push('-f', 'lavfi', '-i', `anullsrc=r=48000:cl=stereo:d=${dur}`);
    args.push('-map', '0:v:0', '-map', '1:a:0');
  }

  args.push(
    '-c:v', 'libx264', '-crf', '16', '-preset', 'medium', '-pix_fmt', 'yuv420p',
    '-c:a', 'aac', '-ar', '48000', '-ac', '2', '-shortest', segOut
  );
  execFileSync('ffmpeg', args, { stdio: 'inherit' });
  return segOut;
}

async function main() {
  const args = process.argv.slice(2);
  const render = args.includes('--render-ffmpeg');
  const argPath = args.find((a) => !a.startsWith('--')) || 'campaigns/sample-campaign/campaign.json';

  const campaignPath = path.isAbsolute(argPath) ? argPath : path.join(ROOT, argPath);
  if (!fs.existsSync(campaignPath)) {
    console.error(`Không tìm thấy file chiến dịch: ${campaignPath}`);
    process.exit(1);
  }

  let campaign = readJson(campaignPath);
  const dir = path.dirname(campaignPath);
  const catalog = loadCatalog();
  const product = readJson(path.join(ROOT, 'assets', 'products', campaign.productId, 'product.json'));
  const character = readJson(path.join(ROOT, 'assets', 'characters', campaign.characterId, 'character.json'));

  const productImgAbs = findFirstExisting(Object.values(product.referenceImages || {}));
  const charImgAbs = findFirstExisting(Object.values(character.referenceImages || {}));

  // Xuất Cutlist CapCut cho mọi cảnh trong chiến dịch
  let t = 0;
  const rows = campaign.scenes.map((sc, i) => {
    const clip = sc.footageId ? catalog.get(sc.footageId) : null;
    const start = Number(sc.trimStartSec ?? 0);
    const dur = Number(sc.durationSec || 4);
    const end = Number(sc.trimEndSec ?? start + dur);
    const sourceLabel = clip
      ? clip.filePath
      : sc.videoSrc
      ? sc.videoSrc
      : sc.keyframeSrc
      ? sc.keyframeSrc
      : productImgAbs || charImgAbs
      ? 'Ảnh Người thật + SP thật (assets/)'
      : 'Studio Card (Remotion/FFmpeg)';

    const row = {
      stt: i + 1,
      scene: sc.id,
      file: sourceLabel,
      in: start,
      out: end,
      dur,
      timelineStart: t,
      subtitle: sc.subtitle
    };
    t += dur;
    return row;
  });

  const md = [
    `# Cutlist CapCut — ${campaign.title}`,
    ``,
    `> Chỉ cắt/ghép/phóng to-thu nhỏ/phụ đề. KHÔNG làm biến dạng điểm ảnh sản phẩm thật và người thật.`,
    `> Khung dọc 9:16 (1080x1920) kèm giọng đọc thuyết minh tiếng Việt.`,
    ``,
    `| # | Cảnh | Nguồn hình/video | In | Out | Dài (s) | Vị trí timeline | Phụ đề / Lời thoại |`,
    `|---|---|---|---|---|---|---|---|`,
    ...rows.map((r) => `| ${r.stt} | ${r.scene} | ${r.file} | ${fmt(r.in)} | ${fmt(r.out)} | ${r.dur.toFixed(2)} | ${fmt(r.timelineStart)} | ${r.subtitle} |`),
    ``,
    `Tổng thời lượng video: **${t.toFixed(2)}s**`,
    ``
  ].join('\n');
  fs.writeFileSync(path.join(dir, 'cutlist.md'), md, 'utf8');

  const csv = [
    ['stt', 'scene', 'file', 'in_sec', 'out_sec', 'duration_sec', 'timeline_start_sec', 'subtitle'].join(','),
    ...rows.map((r) => [r.stt, r.scene, r.file, r.in, r.out, r.dur, r.timelineStart, r.subtitle].map(csvCell).join(','))
  ].join('\n');
  fs.writeFileSync(path.join(dir, 'cutlist.csv'), '\uFEFF' + csv + '\n', 'utf8');
  console.log(`Đã xuất ${path.relative(ROOT, path.join(dir, 'cutlist.md'))} và cutlist.csv`);

  if (render) {
    // Tự động sinh âm thanh & đọc lời thoại tiếng Việt trước khi ghép video
    await generateCampaignVoiceover(campaignPath);
    campaign = readJson(campaignPath);

    const outDir = path.join(dir, 'out');
    const tmpDir = path.join(outDir, '_segments');
    fs.mkdirSync(tmpDir, { recursive: true });

    const ctx = { campaignDir: dir, catalog, productImgAbs, charImgAbs };
    const segFiles = campaign.scenes.map((sc, i) => renderSceneSegment(sc, i, ctx, tmpDir));

    const listPath = path.join(tmpDir, 'concat.txt');
    fs.writeFileSync(listPath, segFiles.map((f) => `file '${f.replace(/\\/g, '/')}'`).join('\n') + '\n', 'utf8');
    const outFile = path.join(outDir, 'ffmpeg-9x16.mp4');
    execFileSync(
      'ffmpeg',
      ['-y', '-v', 'error', '-f', 'concat', '-safe', '0', '-i', listPath, '-c', 'copy', outFile],
      { stdio: 'inherit' }
    );
    console.log(`Đã dựng thành công video (kèm giọng đọc tiếng Việt): ${path.relative(ROOT, outFile)}`);
  }
}

main().catch((e) => {
  console.error('LỖI export-cutlist:', e.message);
  process.exit(1);
});
