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
  const { campaignDir, catalog, productImgAbs, charImgAbs, replaceSampleWithOwnAssets } = ctx;
  const dur = Math.max(1, Number(scene.durationSec || 4));
  const segOut = path.join(tmpDir, `seg-${String(idx).padStart(2, '0')}.mp4`);
  const audioAbs = scene.audioSrc ? path.join(campaignDir, scene.audioSrc) : '';
  const hasVoiceover = audioAbs && fs.existsSync(audioAbs);

  const hasOwnAssets = Boolean(productImgAbs || charImgAbs);
  const clipMeta = scene.footageId ? catalog.get(scene.footageId) : null;
  const clipAbs = clipMeta && fs.existsSync(path.join(ROOT, clipMeta.filePath))
    ? path.join(ROOT, clipMeta.filePath)
    : scene.videoSrc && fs.existsSync(path.join(campaignDir, scene.videoSrc))
    ? path.join(campaignDir, scene.videoSrc)
    : '';

  // Chỉ giữ nguyên điểm ảnh video gốc nếu người dùng tắt chế độ Thay thế (hoặc chưa tải ảnh SP/Nhân vật của mình lên)
  const useRawClipDirectly = clipAbs && !replaceSampleWithOwnAssets && !hasOwnAssets;

  if (useRawClipDirectly) {
    const start = Number(scene.trimStartSec ?? 0);
    const args = ['-y', '-v', 'error', '-ss', String(start), '-t', String(dur), '-i', clipAbs];
    if (hasVoiceover) {
      args.push('-i', audioAbs);
      args.push('-vf', VERTICAL_FILTER, '-map', '0:v:0', '-map', '1:a:0');
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

  // CHẾ ĐỘ CHÍNH: Thay thế Sản phẩm & Nhân vật của Video Mẫu bằng 100% Ảnh Sản Phẩm Thật & Ảnh Nhân Vật Thật của mình!
  // Bố cục từng cảnh mô phỏng theo nhịp của Video Mẫu nhưng giữ nguyên 100% tỷ lệ & chi tiết gốc của SP và Nhân vật của mình.
  const sceneLayoutIdx = idx % 4;
  const bgPalette = ['0x0F172A', '0x111827', '0x1E293B', '0x1E1B4B'];
  const bgHex = scene.type === 'offer-cta' ? '0x1E1B4B' : bgPalette[sceneLayoutIdx];

  const args = ['-y', '-v', 'error', '-f', 'lavfi', '-i', `color=c=${bgHex}:s=1080x1920:r=30:d=${dur}`];

  if (charImgAbs && productImgAbs && charImgAbs !== productImgAbs) {
    args.push('-loop', '1', '-t', String(dur), '-i', charImgAbs);
    args.push('-loop', '1', '-t', String(dur), '-i', productImgAbs);
    if (hasVoiceover) args.push('-i', audioAbs);
    else args.push('-f', 'lavfi', '-i', `anullsrc=r=48000:cl=stereo:d=${dur}`);

    let filterComplex = '';
    if (scene.type === 'real-product-closeup' || sceneLayoutIdx === 2) {
      // Cảnh 3 (Cận cảnh chi tiết sản phẩm): Phóng lớn Ảnh Sản Phẩm Thật ở trung tâm + Ảnh Nhân Vật nhỏ ở góc trên
      filterComplex =
        `[2:v]scale=960:1180:force_original_aspect_ratio=decrease[prod];` +
        `[1:v]scale=380:460:force_original_aspect_ratio=decrease[char];` +
        `[0:v][prod]overlay=(W-w)/2:420[tmp];` +
        `[tmp][char]overlay=W-w-48:80,setsar=1,fps=30[v]`;
    } else if (scene.type === 'offer-cta' || sceneLayoutIdx === 3) {
      // Cảnh 4 (Chốt đơn / Báo giá CTA): Sản phẩm nổi bật phía trên + Nhân vật phía dưới
      filterComplex =
        `[2:v]scale=860:860:force_original_aspect_ratio=decrease[prod];` +
        `[1:v]scale=780:720:force_original_aspect_ratio=decrease[char];` +
        `[0:v][prod]overlay=(W-w)/2:110[tmp];` +
        `[tmp][char]overlay=(W-w)/2:1020,setsar=1,fps=30[v]`;
    } else if (sceneLayoutIdx === 1) {
      // Cảnh 2 (Trải nghiệm & Giải quyết vấn đề): Nhân vật bên trái/trên + Sản phẩm bên phải/dưới theo bố cục chia đôi của video mẫu
      filterComplex =
        `[1:v]scale=900:860:force_original_aspect_ratio=decrease[char];` +
        `[2:v]scale=780:740:force_original_aspect_ratio=decrease[prod];` +
        `[0:v][char]overlay=60:130[tmp];` +
        `[tmp][prod]overlay=W-w-60:980,setsar=1,fps=30[v]`;
    } else {
      // Cảnh 1 (Hook mở đầu): Nhân vật thật + Sản phẩm thật xuất hiện trực diện thu hút trong 3 giây đầu
      filterComplex =
        `[1:v]scale=920:840:force_original_aspect_ratio=decrease[char];` +
        `[2:v]scale=760:700:force_original_aspect_ratio=decrease[prod];` +
        `[0:v][char]overlay=(W-w)/2:120[tmp];` +
        `[tmp][prod]overlay=(W-w)/2:1000,setsar=1,fps=30[v]`;
    }

    args.push('-filter_complex', filterComplex, '-map', '[v]', '-map', '3:a:0');
  } else if (productImgAbs || charImgAbs) {
    const onlyImg = productImgAbs || charImgAbs;
    args.push('-loop', '1', '-t', String(dur), '-i', onlyImg);
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
  const replaceSampleWithOwnAssets = campaign.replaceSampleWithOwnAssets !== false;

  // Xuất Cutlist CapCut cho mọi cảnh trong chiến dịch
  let t = 0;
  const rows = campaign.scenes.map((sc, i) => {
    const start = Number(sc.trimStartSec ?? 0);
    const dur = Number(sc.durationSec || 4);
    const end = Number(sc.trimEndSec ?? start + dur);
    const sourceLabel =
      productImgAbs || charImgAbs
        ? `Thay bằng SP "${product.name}" + NV "${character.name}" (theo nhịp mẫu ${sc.footageId || 'chuẩn'})`
        : sc.footageId || 'Studio Card';

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
    `> Video mẫu được dùng để phân tích lấy ý tưởng & nhịp dựng.`,
    `> Hình ảnh trong video thành phẩm được thay thế 100% bằng Sản phẩm thật (${product.name}) và Nhân vật thật (${character.name}) của bạn.`,
    ``,
    `| # | Cảnh | Nguồn hình thay thế | Nhịp mẫu (In→Out) | Dài (s) | Vị trí timeline | Phụ đề / Lời thoại |`,
    `|---|---|---|---|---|---|---|`,
    ...rows.map((r) => `| ${r.stt} | ${r.scene} | ${r.file} | ${fmt(r.in)} → ${fmt(r.out)} | ${r.dur.toFixed(2)} | ${fmt(r.timelineStart)} | ${r.subtitle} |`),
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
    await generateCampaignVoiceover(campaignPath);
    campaign = readJson(campaignPath);

    const outDir = path.join(dir, 'out');
    const tmpDir = path.join(outDir, '_segments');
    fs.mkdirSync(tmpDir, { recursive: true });

    const ctx = {
      campaignDir: dir,
      catalog,
      productImgAbs,
      charImgAbs,
      replaceSampleWithOwnAssets
    };
    const segFiles = campaign.scenes.map((sc, i) => renderSceneSegment(sc, i, ctx, tmpDir));

    const listPath = path.join(tmpDir, 'concat.txt');
    fs.writeFileSync(listPath, segFiles.map((f) => `file '${f.replace(/\\/g, '/')}'`).join('\n') + '\n', 'utf8');
    const outFile = path.join(outDir, 'ffmpeg-9x16.mp4');
    execFileSync(
      'ffmpeg',
      ['-y', '-v', 'error', '-f', 'concat', '-safe', '0', '-i', listPath, '-c', 'copy', outFile],
      { stdio: 'inherit' }
    );
    console.log(`Đã dựng thành công video thay thế bằng Sản phẩm & Nhân vật của bạn (kèm giọng đọc): ${path.relative(ROOT, outFile)}`);
  }
}

main().catch((e) => {
  console.error('LỖI export-cutlist:', e.message);
  process.exit(1);
});
