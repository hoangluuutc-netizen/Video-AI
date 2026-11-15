import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { ROOT, loadCatalog } from './lib/footage.mjs';
import { detectVideoCuts, buildShots, analyzeAudioSync, pacingMetrics } from './lib/video-analyzer.mjs';
import { fileURLToPath } from 'node:url';

function probeVideo(absPath) {
  try {
    const out = execFileSync(
      'ffprobe',
      ['-v', 'error', '-show_entries', 'format=duration:stream=codec_type,width,height,r_frame_rate', '-of', 'json', absPath],
      { encoding: 'utf8' }
    );
    const info = JSON.parse(out);
    const vStream = (info.streams || []).find((s) => s.codec_type === 'video') || {};
    const aStream = (info.streams || []).find((s) => s.codec_type === 'audio');
    const [num, den] = String(vStream.r_frame_rate || '30/1').split('/').map(Number);
    return {
      durationSec: Number(Number(info.format?.duration || 16).toFixed(2)),
      width: Number(vStream.width || 1080),
      height: Number(vStream.height || 1920),
      fps: den ? Math.round(num / den) : 30,
      hasAudio: Boolean(aStream)
    };
  } catch {
    return { durationSec: 16, width: 1080, height: 1920, fps: 30, hasAudio: true };
  }
}

function readJsonSafe(filePath, fallback) {
  try {
    if (!fs.existsSync(filePath)) return fallback;
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return fallback;
  }
}

function findSampleVideo(argVideo) {
  if (argVideo) {
    const abs = path.isAbsolute(argVideo) ? argVideo : path.join(ROOT, argVideo);
    if (fs.existsSync(abs)) {
      const clipId = path.basename(abs, path.extname(abs)).toLowerCase().replace(/[^a-z0-9]+/g, '-');
      return { abs, rel: path.relative(ROOT, abs).replace(/\\/g, '/'), clipId };
    }
    const catalog = loadCatalog();
    const fromCat = catalog.get(argVideo);
    if (fromCat && fs.existsSync(path.join(ROOT, fromCat.filePath))) {
      return {
        abs: path.join(ROOT, fromCat.filePath),
        rel: fromCat.filePath,
        clipId: fromCat.id
      };
    }
  }

  // Tìm video mới nhất trong assets/footage/
  const footageDir = path.join(ROOT, 'assets', 'footage');
  if (fs.existsSync(footageDir)) {
    const files = fs
      .readdirSync(footageDir)
      .filter((f) => /\.(mp4|mov|m4v|webm)$/i.test(f))
      .map((f) => ({
        name: f,
        abs: path.join(footageDir, f),
        mtime: fs.statSync(path.join(footageDir, f)).mtimeMs
      }))
      .sort((a, b) => b.mtime - a.mtime);

    if (files.length > 0) {
      const chosen = files[0];
      const clipId = path.basename(chosen.name, path.extname(chosen.name)).toLowerCase().replace(/[^a-z0-9]+/g, '-');
      return {
        abs: chosen.abs,
        rel: path.posix.join('assets', 'footage', chosen.name),
        clipId
      };
    }
  }

  // Fallback sang video thành phẩm mẫu nếu chưa có video trong assets/footage
  const fallbackMp4 = path.join(ROOT, 'campaigns', 'sample-campaign', 'out', 'ffmpeg-9x16.mp4');
  if (fs.existsSync(fallbackMp4)) {
    return {
      abs: fallbackMp4,
      rel: 'campaigns/sample-campaign/out/ffmpeg-9x16.mp4',
      clipId: 'video-mau-tham-chieu'
    };
  }

  return null;
}

export function analyzeSampleVideo({ videoArg = '', productId = 'sample-product', characterId = 'sample-kol' } = {}) {
  const found = findSampleVideo(videoArg);
  if (!found) {
    throw new Error('Chưa có video mẫu trong assets/footage/. Hãy kéo thả 1 video mẫu (.mp4, .mov) vào giao diện để phân tích.');
  }

  const meta = probeVideo(found.abs);
  const totalDur = Math.max(8, Math.round(meta.durationSec || 16));

  // Đo cắt cảnh thật + sóng âm/BPM thật bằng ffmpeg
  const realCuts = detectVideoCuts(found.abs, { durationSec: meta.durationSec || totalDur });
  const realShots = buildShots(realCuts, meta.durationSec || totalDur);
  const realPacing = pacingMetrics(realShots, meta.durationSec || totalDur, realCuts);
  const realAudio = meta.hasAudio ? analyzeAudioSync(found.abs, meta.durationSec || totalDur) : null;

  const product = readJsonSafe(path.join(ROOT, 'assets', 'products', productId, 'product.json'), {
    id: productId,
    name: 'Sản phẩm của bạn',
    price: '399.000đ',
    salePrice: '249.000đ',
    discountBadge: 'ƯU ĐÃI HÔM NAY',
    highlights: ['Chất liệu cao cấp', 'Thiết kế hoàn thiện tỉ mỉ', 'Tiện lợi sử dụng mỗi ngày']
  });

  const character = readJsonSafe(path.join(ROOT, 'assets', 'characters', characterId, 'character.json'), {
    id: characterId,
    name: 'Nhân vật của bạn',
    role: 'Người trải nghiệm thực tế'
  });

  // Chia nhịp 4 phân cảnh theo ranh giới cắt cảnh thật (nếu phát hiện >= 3 điểm cắt) hoặc fallback theo tỷ lệ
  let s1Dur = Math.max(3, Math.round(totalDur * 0.24));
  let s2Dur = Math.max(4, Math.round(totalDur * 0.32));
  let s3Dur = Math.max(3, Math.round(totalDur * 0.25));
  let s4Dur = Math.max(2, totalDur - (s1Dur + s2Dur + s3Dur));
  if (realCuts.length >= 3) {
    const pickCut = (targetSec) =>
      realCuts.reduce((best, c) => (Math.abs(c - targetSec) < Math.abs(best - targetSec) ? c : best), realCuts[0]);
    const c1 = Math.max(2, Math.round(pickCut(totalDur * 0.24)));
    const c2 = Math.max(c1 + 2, Math.round(pickCut(totalDur * 0.56)));
    const c3 = Math.max(c2 + 2, Math.min(totalDur - 2, Math.round(pickCut(totalDur * 0.81))));
    if (c3 > c2 && c2 > c1 && totalDur - c3 >= 2) {
      s1Dur = c1;
      s2Dur = c2 - c1;
      s3Dur = c3 - c2;
      s4Dur = totalDur - c3;
    }
  }

  const segments = [
    { idx: 1, id: 'scene-1-hook', role: 'Mở đầu (Hook 3s đầu)', start: 0, dur: s1Dur },
    { idx: 2, id: 'scene-2-experience', role: 'Tình huống & Trải nghiệm', start: s1Dur, dur: s2Dur },
    { idx: 3, id: 'scene-3-product-truth', role: 'Cận cảnh Chi tiết Sản phẩm', start: s1Dur + s2Dur, dur: s3Dur },
    { idx: 4, id: 'scene-4-cta', role: 'Kết quả & Báo giá CTA', start: s1Dur + s2Dur + s3Dur, dur: s4Dur }
  ];

  const analysisDir = path.join(ROOT, 'assets', 'footage', 'analysis', found.clipId);
  fs.mkdirSync(analysisDir, { recursive: true });

  const h1 = product.highlights?.[0] || 'Chất liệu cao cấp chính hãng';
  const h2 = product.highlights?.[1] || 'Thiết kế chống bám bẩn, bền bỉ';
  const h3 = product.highlights?.[2] || 'Tiện lợi mang theo mỗi ngày';
  const sale = product.salePrice || product.price || '249.000đ';

  const sceneBlueprints = segments.map((seg) => {
    const midSec = Math.min(Math.max(0.2, meta.durationSec - 0.2), seg.start + seg.dur / 2);
    const thumbName = `scene-${seg.idx}.jpg`;
    const thumbAbs = path.join(analysisDir, thumbName);
    try {
      execFileSync('ffmpeg', [
        '-y', '-v', 'error',
        '-ss', midSec.toFixed(2),
        '-i', found.abs,
        '-frames:v', '1',
        '-vf', 'scale=360:640:force_original_aspect_ratio=decrease',
        thumbAbs
      ]);
    } catch {
      // Bỏ qua nếu không trích xuất được khung hình
    }

    const thumbUrl = fs.existsSync(thumbAbs)
      ? `/assets/footage/analysis/${found.clipId}/${thumbName}?t=${Date.now()}`
      : '';

    const blueprintsByIdx = {
      1: {
        samplePattern: 'Cảnh 1 (Mở đầu): Nhân vật trong video mẫu xuất hiện trực diện cùng sản phẩm để giữ chân người xem trong 3 giây đầu.',
        replacementMethod: `Thay bằng hình ảnh "${character.name}" + "${product.name}" (bám sát nhịp ${seg.dur}s của video mẫu, giữ 100% chi tiết gốc).`,
        suggestedVisualAction: `[Thay thế theo nhịp Cảnh 1 Video Mẫu (${seg.start}s→${seg.start + seg.dur}s)]: ${character.name} cầm trực diện ${product.name}, giữ nguyên 100% khuôn mặt người thật & hình dáng sản phẩm thật.`,
        suggestedSubtitle: `Đừng mua ${product.name} nếu bạn chưa kiểm tra 3 chi tiết thực tế này!`
      },
      2: {
        samplePattern: 'Cảnh 2 (Trải nghiệm/Vấn đề): Video mẫu chuyển góc trung cảnh thể hiện thao tác sử dụng thực tế và giải quyết nỗi đau khách hàng.',
        replacementMethod: `Thay bằng cảnh "${character.name}" trải nghiệm "${product.name}" trên nền chuyển động mượt theo đúng thời lượng ${seg.dur}s của video mẫu.`,
        suggestedVisualAction: `[Thay thế theo nhịp Cảnh 2 Video Mẫu (${seg.start}s→${seg.start + seg.dur}s)]: ${character.name} thao tác sử dụng ${product.name}, làm nổi bật ưu điểm "${h1}" và "${h2}".`,
        suggestedSubtitle: `Khác biệt hoàn toàn với hàng trôi nổi: ${h1}, kết hợp ${h2.toLowerCase()} cực kỳ tiện lợi.`
      },
      3: {
        samplePattern: 'Cảnh 3 (Chứng minh chất lượng): Video mẫu zoom cận cảnh vào chất liệu, logo và chi tiết hoàn thiện của sản phẩm.',
        replacementMethod: `Thay hoàn toàn bằng Ảnh Sản Phẩm Thật 100% của "${product.name}" + 3 thông số chuẩn từ product.json (không biến dạng chữ/logo).`,
        suggestedVisualAction: `[Thay thế theo nhịp Cảnh 3 Video Mẫu (${seg.start}s→${seg.start + seg.dur}s)]: Cận cảnh 100% ảnh gốc ${product.name} sắc nét: ${h1} • ${h2} • ${h3}.`,
        suggestedSubtitle: `Nhìn cận cảnh từng chi tiết thật: ${h1}; ${h2}; và ${h3}.`
      },
      4: {
        samplePattern: 'Cảnh 4 (Chốt đơn / CTA): Video mẫu tổng kết lợi ích và thúc đẩy hành động mua hàng ở cuối video.',
        replacementMethod: `Thay bằng thẻ giá thật của shop (${product.price} → ${sale}) kèm hình "${product.name}" và lời kêu gọi đặt hàng.`,
        suggestedVisualAction: `[Thay thế theo nhịp Cảnh 4 Video Mẫu (${seg.start}s→${seg.start + seg.dur}s)]: Hiển thị ${product.name} nguyên bản + Bảng giá ưu đãi ${sale} (${product.discountBadge || 'Flash Sale'}).`,
        suggestedSubtitle: `Giá gốc ${product.price} nay ưu đãi chỉ còn ${sale} — bấm giỏ hàng chốt ngay hôm nay!`
      }
    };

    const bp = blueprintsByIdx[seg.idx];
    return {
      sceneIndex: seg.idx,
      id: seg.id,
      role: seg.role,
      sampleStartSec: seg.start,
      sampleEndSec: seg.start + seg.dur,
      durationSec: seg.dur,
      sampleThumbnailUrl: thumbUrl,
      samplePattern: bp.samplePattern,
      replacementMethod: bp.replacementMethod,
      suggestedVisualAction: bp.suggestedVisualAction,
      suggestedSubtitle: bp.suggestedSubtitle
    };
  });

  const extractedIdea = `Lấy cấu trúc từ Video mẫu "${found.clipId}" (${totalDur}s, ${meta.width}×${meta.height}, 4 phân cảnh nhịp ${s1Dur}s–${s2Dur}s–${s3Dur}s–${s4Dur}s): Thay thế nhân vật và sản phẩm trong video mẫu bằng "${character.name}" và "${product.name}" (${h1}, ${h2}, ưu đãi ${sale}).`;

  // Bảng khuôn mẫu ý tưởng cho từng cơ chế Hook (cho phép giữ giống video mẫu hoặc đổi sang ý tưởng khác)
  const hookIdeaPresets = {
    'same-as-sample': {
      label: '🎯 Giống Video Mẫu (Chỉ thay SP & Nhân vật của mình)',
      ideaTemplate: `Bám sát nhịp mở đầu ${s1Dur}s của video mẫu "${found.clipId}", thay bằng ${character.name} cầm ${product.name} trực diện.`
    },
    'new-pain-point': {
      label: '🔄 Đổi Nỗi Đau Mới (Làm khác video mẫu)',
      ideaTemplate: `Làm khác video mẫu: Mở đầu bằng nỗi đau thực tế khi dùng sản phẩm kém chất lượng trước khi đưa ${product.name} ra giải quyết.`
    },
    'reverse-shock': {
      label: '🔥 Đảo Ngược Tình Huống / Bóc Sự Thật (Làm khác video mẫu)',
      ideaTemplate: `Làm khác video mẫu: Mở đầu bằng câu phản biện ngược gây tò mò mạnh về ${h1} của ${product.name}.`
    },
    'live-test-proof': {
      label: '🧪 Test Thực Tế Cận Cảnh Ngay 3s Đầu (Làm khác video mẫu)',
      ideaTemplate: `Làm khác video mẫu: Không nói lý thuyết, đưa thẳng cảnh test ${h3} của ${product.name} lên 3 giây đầu tiên.`
    },
    'flash-deal-first': {
      label: '🎁 Đập Ngay Giá Sốc / Deal Hời Đầu Video (Làm khác video mẫu)',
      ideaTemplate: `Làm khác video mẫu: Đánh thẳng vào mức giảm giá ${product.discountBadge || sale} của ${product.name} cho người săn sale.`
    }
  };

  const result = {
    analyzedAt: new Date().toISOString(),
    sampleVideo: {
      clipId: found.clipId,
      filePath: found.rel,
      durationSec: totalDur,
      width: meta.width,
      height: meta.height,
      fps: meta.fps,
      hasAudio: meta.hasAudio
    },
    targetReplacement: {
      productId: product.id,
      productName: product.name,
      characterId: character.id,
      characterName: character.name
    },
    extractedIdea,
    sampleStructureSummary: `Video mẫu dài ${totalDur}s (${meta.width}×${meta.height}, ${meta.fps}fps) — đo thật: ${realPacing.shotCount} cảnh cắt (${realPacing.avgShotSec}s/cảnh, ${realPacing.pace}${realAudio?.bpm ? `, ~${realAudio.bpm.value} BPM` : ''}). Khung 4 nhịp thay thế: Mở đầu (${s1Dur}s) → Trải nghiệm (${s2Dur}s) → Cận cảnh (${s3Dur}s) → CTA (${s4Dur}s).`,
    xray: {
      cuts: realCuts,
      shots: realShots,
      pacing: realPacing,
      audio: realAudio ? { bpm: realAudio.bpm, meanDb: realAudio.meanDb, silenceRatio: realAudio.silenceRatio, hopSec: realAudio.hopSec, waveform: realAudio.waveform } : null
    },
    sceneBlueprints,
    hookIdeaPresets
  };

  const outJsonPath = path.join(analysisDir, 'analysis.json');
  fs.writeFileSync(outJsonPath, JSON.stringify(result, null, 2) + '\n', 'utf8');
  return result;
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  const args = process.argv.slice(2);
  const videoArg = args.find((a) => !a.startsWith('--')) || '';
  const prodIdx = args.indexOf('--product');
  const charIdx = args.indexOf('--character');
  const productId = prodIdx >= 0 ? args[prodIdx + 1] : 'sample-product';
  const characterId = charIdx >= 0 ? args[charIdx + 1] : 'sample-kol';

  try {
    const res = analyzeSampleVideo({ videoArg, productId, characterId });
    console.log(`Đã phân tích xong Video Mẫu "${res.sampleVideo.clipId}" (${res.sampleVideo.durationSec}s).`);
    console.log(`Ý tưởng rút ra: ${res.extractedIdea}`);
    console.log(`File phân tích: assets/footage/analysis/${res.sampleVideo.clipId}/analysis.json`);
  } catch (err) {
    console.error('LỖI phân tích video mẫu:', err.message);
    process.exit(1);
  }
}
