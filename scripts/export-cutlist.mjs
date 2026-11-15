import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { ROOT, VERTICAL_FILTER, loadCatalog } from './lib/footage.mjs';
import { inferMuseStyle, readJson } from './lib/prompt-builder.mjs';
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

function wrapVietnameseText(text, maxCharsPerLine = 32) {
  const words = String(text || '').trim().split(/\s+/).filter(Boolean);
  if (!words.length) return '';
  const lines = [];
  let cur = '';
  for (const w of words) {
    if ((cur + ' ' + w).trim().length > maxCharsPerLine) {
      if (cur) lines.push(cur);
      cur = w;
    } else {
      cur = (cur + ' ' + w).trim();
    }
  }
  if (cur) lines.push(cur);
  return lines.slice(0, 4).join('\n');
}

function toFfmpegFontPath() {
  const candidates = [
    'C:/Windows/Fonts/segoeuib.ttf',
    'C:/Windows/Fonts/arialbd.ttf',
    'C:/Windows/Fonts/segoeui.ttf',
    'C:/Windows/Fonts/arial.ttf'
  ];
  for (const f of candidates) {
    if (fs.existsSync(f)) return f.replace(/:/g, '\\:');
  }
  return '';
}

function hasAlphaChannel(imgPath) {
  try {
    const out = execFileSync(
      'ffprobe',
      ['-v', 'quiet', '-select_streams', 'v:0', '-show_entries', 'stream=pix_fmt', '-of', 'csv=p=0', imgPath],
      { encoding: 'utf8' }
    ).trim();
    return /^(rgba|bgra|argb|abgr|yuva|pal8|ya)/i.test(out);
  } catch {
    return false;
  }
}

function prepareCleanProductImage(productImgAbs, tmpDir) {
  if (!productImgAbs || !fs.existsSync(productImgAbs)) return '';
  // Nếu ảnh PNG đã có nền trong suốt sẵn thì giữ nguyên để không làm lủng chi tiết sản phẩm màu trắng/xám
  if (path.extname(productImgAbs).toLowerCase() === '.png' && hasAlphaChannel(productImgAbs)) {
    return productImgAbs;
  }
  const cleanOut = path.join(tmpDir, 'product-nobg.png');
  try {
    // Tách nền trắng tinh (0xFFFFFF) quanh sản phẩm để sản phẩm nổi 3D trực tiếp lên nền Bokeh Cinema
    execFileSync('ffmpeg', [
      '-y', '-v', 'error',
      '-i', productImgAbs,
      '-vf', 'format=rgba,colorkey=0xFFFFFF:0.06:0.03',
      '-frames:v', '1',
      cleanOut
    ]);
    if (fs.existsSync(cleanOut)) return cleanOut;
  } catch {
    // Fallback giữ ảnh gốc
  }
  return productImgAbs;
}

function renderSceneSegment(scene, idx, ctx, tmpDir) {
  const { campaignDir, catalog, productImgAbs, cleanProdAbs, charImgAbs, replaceSampleWithOwnAssets, product } = ctx;
  const dur = Math.max(1, Number(scene.durationSec || 4));
  const segOut = path.join(tmpDir, `seg-${String(idx).padStart(2, '0')}.mp4`);
  const audioAbs = scene.audioSrc ? path.join(campaignDir, scene.audioSrc) : '';
  const hasVoiceover = audioAbs && fs.existsSync(audioAbs);

  const hasOwnAssets = Boolean(productImgAbs || charImgAbs);
  const veoClipAbs = scene.videoSrc && fs.existsSync(path.join(campaignDir, scene.videoSrc))
    ? path.join(campaignDir, scene.videoSrc)
    : fs.existsSync(path.join(campaignDir, 'media', 'clips', `${scene.id}.mp4`))
    ? path.join(campaignDir, 'media', 'clips', `${scene.id}.mp4`)
    : '';

  // 1. Ưu tiên dùng Clip Điện Ảnh đã sinh từ Veo 3.1 / Gemini Omni 1.2 Flash (nếu có)
  if (veoClipAbs && scene.type !== 'real-product-closeup' && scene.type !== 'offer-cta') {
    const args = ['-y', '-v', 'error', '-t', String(dur), '-i', veoClipAbs];
    if (hasVoiceover) {
      args.push('-i', audioAbs);
      args.push('-vf', VERTICAL_FILTER, '-map', '0:v:0', '-map', '1:a:0');
    } else {
      args.push('-f', 'lavfi', '-i', 'anullsrc=r=48000:cl=stereo');
      args.push('-vf', VERTICAL_FILTER, '-map', '0:v:0', '-map', '1:a:0');
    }
    args.push(
      '-c:v', 'libx264', '-crf', '16', '-preset', 'medium', '-pix_fmt', 'yuv420p',
      '-c:a', 'aac', '-ar', '48000', '-ac', '2', '-shortest', segOut
    );
    execFileSync('ffmpeg', args, { stdio: 'inherit' });
    return segOut;
  }

  const clipMeta = scene.footageId ? catalog.get(scene.footageId) : Array.from(catalog.values())[0];
  const clipAbs = clipMeta && fs.existsSync(path.join(ROOT, clipMeta.filePath))
    ? path.join(ROOT, clipMeta.filePath)
    : '';

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

  // CHẾ ĐỘ STUDIO PRO LOCAL:
  // - Nền Bokeh chuyển động điện ảnh cho TẤT CẢ các cảnh (lấy từ Video Mẫu, làm mờ sâu boxblur=42:6)
  // - Nhân vật thật: Crop chân dung/nửa thân trên cân đối + Ken Burns zoompan mượt 30fps
  // - Sản phẩm thật: Đã tách nền trắng (cleanProdAbs) + chuyển động nổi 3D (floating sine) sắc nét 100%
  // - Vẽ trực tiếp Thanh Hook / Thông số / Thẻ giá Flash Sale + Phụ đề Tiếng Việt vào khung hình
  const sceneLayoutIdx = idx % 4;
  const bgPalette = ['0x0F172A', '0x111827', '0x1E293B', '0x1E1B4B'];
  const bgHex = scene.type === 'offer-cta' ? '0x1E1B4B' : bgPalette[sceneLayoutIdx];
  const museStyle = inferMuseStyle(scene, ctx.campaignStyleId || 'tvc-studio-luxury');
  const fps = 30;
  const totalFrames = Math.max(30, Math.round(dur * fps));

  const args = ['-y', '-v', 'error'];
  let bgFilterPrefix = '[0:v]';
  if (clipAbs) {
    const clipDur = Math.max(4, Number(clipMeta?.durationSec || 30));
    const sampleStart = Math.max(0, Number(scene.trimStartSec ?? idx * 4)) % clipDur;
    args.push('-stream_loop', '-1', '-ss', String(sampleStart.toFixed(2)), '-t', String(dur), '-i', clipAbs);
    bgFilterPrefix =
      `[0:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,boxblur=42:6,eq=${museStyle.ffmpegEq},setsar=1,fps=${fps}[bg0];[bg0]`;
  } else {
    args.push('-f', 'lavfi', '-i', `color=c=${bgHex}:s=1080x1920:r=${fps}:d=${dur}`);
  }

  // Tạo file text UTF-8 cho phụ đề & banner để không lỗi dấu tiếng Việt
  const fontEsc = toFfmpegFontPath();
  const subText = wrapVietnameseText(scene.subtitle || '', 36);
  const subFile = path.join(tmpDir, `sub-${idx}.txt`);
  fs.writeFileSync(subFile, subText || ' ', 'utf8');
  const subFileEsc = subFile.replace(/\\/g, '/').replace(/:/g, '\\:');

  let topBadgeText = '';
  if (sceneLayoutIdx === 0) topBadgeText = 'CẢNH BÁO QUAN TRỌNG TRƯỚC KHI MUA';
  else if (sceneLayoutIdx === 1) topBadgeText = `TRẢI NGHIỆM THỰC TẾ • ${product.name.slice(0, 26).toUpperCase()}`;
  else if (scene.type === 'real-product-closeup' || sceneLayoutIdx === 2) topBadgeText = 'KIỂM CHỨNG 100% CHI TIẾT THẬT';
  else topBadgeText = `FLASH SALE CHỈ ${product.salePrice || product.price} • ĐẶT NGAY`;

  const topFile = path.join(tmpDir, `top-${idx}.txt`);
  fs.writeFileSync(topFile, topBadgeText, 'utf8');
  const topFileEsc = topFile.replace(/\\/g, '/').replace(/:/g, '\\:');

  const overlayGraphics = fontEsc
    ? `,drawbox=x=80:y=96:w=920:h=86:color=#FF5A1F@0.94:t=fill` +
      `,drawtext=fontfile='${fontEsc}':textfile='${topFileEsc}':expansion=none:fontcolor=white:fontsize=34:x=(w-text_w)/2:y=122` +
      `,drawbox=x=56:y=1500:w=968:h=245:color=#09090B@0.82:t=fill` +
      `,drawbox=x=56:y=1500:w=968:h=6:color=#FF5A1F@0.95:t=fill` +
      `,drawtext=fontfile='${fontEsc}':textfile='${subFileEsc}':expansion=none:fontcolor=white:fontsize=34:line_spacing=10:x=(w-text_w)/2:y=1532`
    : '';

  const prodSrc = cleanProdAbs || productImgAbs;

  if (charImgAbs && prodSrc && charImgAbs !== prodSrc) {
    args.push('-loop', '1', '-t', String(dur), '-i', charImgAbs);
    args.push('-loop', '1', '-t', String(dur), '-i', prodSrc);
    if (hasVoiceover) args.push('-i', audioAbs);
    else args.push('-f', 'lavfi', '-i', `anullsrc=r=48000:cl=stereo:d=${dur}`);

    let filterComplex = '';
    if (scene.type === 'real-product-closeup' || sceneLayoutIdx === 2) {
      // Cảnh 3: Cận cảnh Sản phẩm thật nổi bật ở trung tâm + chuyển động nổi 3D + Nhân vật góc trên
      filterComplex =
        `[2:v]format=rgba,scale=820:1040:force_original_aspect_ratio=decrease[prod];` +
        `[1:v]crop=iw*0.86:ih*0.72:iw*0.07:ih*0.04,scale=420:460:force_original_aspect_ratio=increase,crop=420:460,` +
        `zoompan=z='min(zoom+0.0006,1.07)':d=${totalFrames}:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=380x420:fps=${fps}[char];` +
        `${bgFilterPrefix}[prod]overlay=(W-w)/2:'430+14*sin(2*PI*t/2.8)'[tmp];` +
        `[tmp][char]overlay=W-w-44:210${overlayGraphics},setsar=1,fps=${fps}[v]`;
    } else if (scene.type === 'offer-cta' || sceneLayoutIdx === 3) {
      // Cảnh 4: Sản phẩm thật to rõ phía trên + Nhân vật thật phía dưới + Thẻ Flash Sale
      filterComplex =
        `[2:v]format=rgba,scale=760:860:force_original_aspect_ratio=decrease[prod];` +
        `[1:v]crop=iw*0.86:ih*0.72:iw*0.07:ih*0.04,scale=720:640:force_original_aspect_ratio=increase,crop=720:640,` +
        `zoompan=z='min(zoom+0.0005,1.06)':d=${totalFrames}:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=680x580:fps=${fps}[char];` +
        `${bgFilterPrefix}[char]overlay=(W-w)/2:890[tmp];` +
        `[tmp][prod]overlay=(W-w)/2:'210+12*sin(2*PI*t/2.6)'${overlayGraphics},setsar=1,fps=${fps}[v]`;
    } else if (sceneLayoutIdx === 1) {
      // Cảnh 2: Nhân vật bên trái (Ken Burns) + Sản phẩm nổi 3D lớn bên phải
      filterComplex =
        `[1:v]crop=iw*0.86:ih*0.72:iw*0.07:ih*0.04,scale=640:820:force_original_aspect_ratio=increase,crop=640:820,` +
        `zoompan=z='min(zoom+0.0007,1.09)':d=${totalFrames}:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=560x760:fps=${fps}[char];` +
        `[2:v]format=rgba,scale=620:880:force_original_aspect_ratio=decrease[prod];` +
        `${bgFilterPrefix}[char]overlay=48:260[tmp];` +
        `[tmp][prod]overlay=W-w-40:'560+14*sin(2*PI*t/2.8)'${overlayGraphics},setsar=1,fps=${fps}[v]`;
    } else {
      // Cảnh 1 (Hook): Nhân vật lớn sắc nét phía trên + Sản phẩm nổi 3D ở trung tâm dưới
      filterComplex =
        `[1:v]crop=iw*0.86:ih*0.72:iw*0.07:ih*0.04,scale=840:780:force_original_aspect_ratio=increase,crop=840:780,` +
        `zoompan=z='min(zoom+0.0007,1.08)':d=${totalFrames}:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=780x720:fps=${fps}[char];` +
        `[2:v]format=rgba,scale=640:760:force_original_aspect_ratio=decrease[prod];` +
        `${bgFilterPrefix}[char]overlay=(W-w)/2:215[tmp];` +
        `[tmp][prod]overlay=(W-w)/2:'760+14*sin(2*PI*t/2.5)'${overlayGraphics},setsar=1,fps=${fps}[v]`;
    }

    args.push('-filter_complex', filterComplex, '-map', '[v]', '-map', '3:a:0');
  } else if (prodSrc || charImgAbs) {
    const onlyImg = prodSrc || charImgAbs;
    args.push('-loop', '1', '-t', String(dur), '-i', onlyImg);
    if (hasVoiceover) args.push('-i', audioAbs);
    else args.push('-f', 'lavfi', '-i', `anullsrc=r=48000:cl=stereo:d=${dur}`);

    args.push(
      '-filter_complex',
      `[1:v]format=rgba,scale=920:1280:force_original_aspect_ratio=decrease[fg];` +
      `${bgFilterPrefix}[fg]overlay=(W-w)/2:'(H-h)/2+12*sin(2*PI*t/2.8)'${overlayGraphics},setsar=1,fps=${fps}[v]`,
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

function findBackgroundMusic(campaign) {
  if (campaign.bgmSrc) {
    const abs = path.isAbsolute(campaign.bgmSrc) ? campaign.bgmSrc : path.join(ROOT, campaign.bgmSrc);
    if (fs.existsSync(abs)) return abs;
  }
  const musicDir = path.join(ROOT, 'assets', 'music');
  if (!fs.existsSync(musicDir)) return '';
  const files = fs.readdirSync(musicDir).filter((f) => /\.(mp3|wav|m4a|aac)$/i.test(f));
  return files.length > 0 ? path.join(musicDir, files[0]) : '';
}

function applyBgmAutoDucking(videoPath, bgmPath, tmpDir) {
  if (!bgmPath || !fs.existsSync(bgmPath)) return;
  const duckedTmp = path.join(tmpDir, 'master-ducked.mp4');
  execFileSync('ffmpeg', [
    '-y', '-v', 'error',
    '-i', videoPath,
    '-stream_loop', '-1', '-i', bgmPath,
    '-filter_complex',
    '[1:a]volume=0.22[bgm];[bgm][0:a]sidechaincompress=threshold=0.03:ratio=6:attack=25:release=300[ducked];[0:a][ducked]amix=inputs=2:duration=first:dropout_transition=0[aout]',
    '-map', '0:v:0', '-map', '[aout]',
    '-c:v', 'copy', '-c:a', 'aac', '-ar', '48000', '-ac', '2', '-shortest',
    duckedTmp
  ], { stdio: 'inherit' });
  fs.renameSync(duckedTmp, videoPath);
}

function renderRatioVariant(master9x16, outPath, w, h) {
  execFileSync('ffmpeg', [
    '-y', '-v', 'error',
    '-i', master9x16,
    '-filter_complex',
    `[0:v]scale=${w}:${h}:force_original_aspect_ratio=increase,crop=${w}:${h},boxblur=28:5,eq=brightness=-0.15[bg];` +
    `[0:v]scale=${w}:${h}:force_original_aspect_ratio=decrease[fg];` +
    `[bg][fg]overlay=(W-w)/2:(H-h)/2,setsar=1[v]`,
    '-map', '[v]', '-map', '0:a:0',
    '-c:v', 'libx264', '-crf', '16', '-preset', 'medium', '-pix_fmt', 'yuv420p',
    '-c:a', 'copy', '-shortest', outPath
  ], { stdio: 'inherit' });
}

async function main() {
  const args = process.argv.slice(2);
  const render = args.includes('--render-ffmpeg');
  const ratioArg = (args.find((a) => a.startsWith('--ratio=')) || '--ratio=9x16').split('=')[1];
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

  const refImgs = product.referenceImages || {};
  const productImgAbs = findFirstExisting([refImgs.transparent, refImgs.cutout, ...Object.values(refImgs)]);
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

    const cleanProdAbs = prepareCleanProductImage(productImgAbs, tmpDir);

    const ctx = {
      campaignDir: dir,
      catalog,
      productImgAbs,
      cleanProdAbs,
      charImgAbs,
      replaceSampleWithOwnAssets,
      campaignStyleId: campaign.museStyle || 'tvc-studio-luxury',
      product
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

    const bgmAbs = findBackgroundMusic(campaign);
    if (bgmAbs) {
      applyBgmAutoDucking(outFile, bgmAbs, tmpDir);
      console.log(`Đã trộn nhạc nền Auto-Ducking: ${path.relative(ROOT, bgmAbs)}`);
    }

    if (ratioArg === '1x1' || ratioArg === 'all') {
      const out1x1 = path.join(outDir, 'ffmpeg-1x1.mp4');
      renderRatioVariant(outFile, out1x1, 1080, 1080);
      console.log(`Đã xuất bản Facebook/Shopee vuông 1:1: ${path.relative(ROOT, out1x1)}`);
    }
    if (ratioArg === '16x9' || ratioArg === 'all') {
      const out16x9 = path.join(outDir, 'ffmpeg-16x9.mp4');
      renderRatioVariant(outFile, out16x9, 1920, 1080);
      console.log(`Đã xuất bản Website/YouTube ngang 16:9: ${path.relative(ROOT, out16x9)}`);
    }

    console.log(`Đã dựng thành công video Studio Pro (Tách nền SP + Ken Burns + Phụ đề Việt + Có Tiếng): ${path.relative(ROOT, outFile)}`);
  }
}

main().catch((e) => {
  console.error('LỖI export-cutlist:', e.message);
  process.exit(1);
});
