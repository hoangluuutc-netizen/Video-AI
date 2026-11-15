import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { buildScenePrompt, inferMuseStyle, readJson } from './lib/prompt-builder.mjs';
import { loadCatalog } from './lib/footage.mjs';
import { generateMuseKeyframesAndPack } from './generate-muse-pack.mjs';

const ROOT = process.cwd();

function findFirstExistingRel(obj) {
  for (const rel of Object.values(obj || {})) {
    if (!rel) continue;
    const abs = path.isAbsolute(rel) ? rel : path.join(ROOT, rel);
    if (fs.existsSync(abs)) return rel.replace(/\\/g, '/');
  }
  return '';
}

function extractSampleRefClip(sampleAbs, startSec, durSec, outAbs) {
  try {
    fs.mkdirSync(path.dirname(outAbs), { recursive: true });
    const safeDur = Math.min(3, Math.max(2, Number(durSec || 3)));
    execFileSync('ffmpeg', [
      '-y', '-v', 'error',
      '-ss', String(Math.max(0, Number(startSec || 0))),
      '-t', String(safeDur),
      '-i', sampleAbs,
      '-vf', 'scale=720:1280:force_original_aspect_ratio=decrease,pad=720:1280:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=24',
      '-an',
      '-c:v', 'libx264', '-crf', '22', '-preset', 'fast',
      outAbs
    ]);
    return fs.existsSync(outAbs);
  } catch {
    return false;
  }
}

export function generateVeo3PromptsAndPack(campaignArg = 'campaigns/sample-campaign/campaign.json') {
  const campaignPath = path.isAbsolute(campaignArg) ? campaignArg : path.join(ROOT, campaignArg);

  if (!fs.existsSync(campaignPath)) {
    throw new Error(`Không tìm thấy file chiến dịch: ${campaignPath}`);
  }

  // Tạo sẵn bộ ảnh Keyframe Khung Đầu / Khung Cuối & gói Muse AI 3-Slot
  generateMuseKeyframesAndPack(campaignPath);

  const campaign = readJson(campaignPath);
  const campDir = path.dirname(campaignPath);
  const productPath = path.join(ROOT, 'assets', 'products', campaign.productId, 'product.json');
  const charPath = path.join(ROOT, 'assets', 'characters', campaign.characterId, 'character.json');

  const product = readJson(productPath);
  const character = readJson(charPath);
  const catalog = loadCatalog();

  const prodImgRel = findFirstExistingRel(product.referenceImages);
  const charImgRel = findFirstExistingRel(character.referenceImages);

  const firstClip = Array.from(catalog.values())[0];
  const sampleVideoAbs = firstClip && fs.existsSync(path.join(ROOT, firstClip.filePath))
    ? path.join(ROOT, firstClip.filePath)
    : '';

  const campaignStyleId = campaign.museStyle || 'tvc-studio-luxury';
  const campaignStyle = inferMuseStyle({}, campaignStyleId);

  const lines = [
    `# 🎨🎬 HỒ SƠ KỊCH BẢN PHÂN CẢNH MUSE AI × WHISK 3-SLOT × VEO 3.1 — ${campaign.title}`,
    ``,
    `> **Phương pháp kết hợp tối ưu (Muse AI × Google Whisk 3-Slot × ToolKichBan × Veo 3.1):**`,
    `> 1. **Whisk 3-Slot Remix (Chủ thể + Bối cảnh + Phong cách):** Khóa cứng Chủ thể (\`${charImgRel}\` + \`${prodImgRel}\`), Bối cảnh trích từ Video Mẫu, và Phong cách ánh sáng \`${campaignStyle.label}\`.`,
    `> 2. **Frames-to-Video (Khung Đầu → Khung Cuối):** Tự động sinh cặp ảnh \`-start.png\` và \`-end.png\` cho mỗi cảnh để khóa quỹ đạo chuyển động không bị biến dạng sản phẩm.`,
    `> 3. **Học Chuyển Động Từ Video Mẫu (Video-to-Video Reference):** Trích đoạn 3s từ Video Mẫu để dẫn hướng góc máy.`,
    `> 4. **Âm Thanh Gốc Veo 3 (Native Audio + Lip-Sync + SFX):** Đồng bộ khẩu hình miệng tiếng Việt kết hợp hiệu ứng âm thanh thực tế.`,
    ``,
    `- **Sản phẩm:** ${product.name} (\`${product.sku || product.id}\`) — Giá ưu đãi: **${product.salePrice || product.price}**`,
    `- **Nhân vật cố định:** ${character.name}`,
    `- **Phong cách Muse / Whisk Style:** ${campaignStyle.label}`,
    `- **Ảnh gốc Nhân vật (Slot 1A):** \`${charImgRel || 'Chưa tải ảnh'}\``,
    `- **Ảnh gốc Sản phẩm (Slot 1B):** \`${prodImgRel || 'Chưa tải ảnh'}\``,
    ``
  ];

  const batchScenes = [];

  campaign.scenes.forEach((scene, idx) => {
    const built = buildScenePrompt(scene, product, character, idx, campaignStyleId);
    const refClipRel = path.posix.join('media', 'ref-clips', `${scene.id}-ref3s.mp4`);
    const refClipAbs = path.join(campDir, refClipRel);
    let hasRefClip = false;
    if (sampleVideoAbs) {
      hasRefClip = extractSampleRefClip(sampleVideoAbs, scene.trimStartSec ?? idx * 4, 3, refClipAbs);
    }

    const startKeyframeRel = scene.startKeyframeSrc || path.posix.join('media', 'keyframes', `${scene.id}-start.png`);
    const endKeyframeRel = scene.endKeyframeSrc || path.posix.join('media', 'keyframes', `${scene.id}-end.png`);
    const keyframeRel = scene.keyframeSrc || startKeyframeRel;
    const sceneThumbRel = `assets/footage/analysis/video-m-u/scene-${(idx % 4) + 1}.jpg`;
    const outClipRel = path.posix.join('media', 'clips', `${scene.id}.mp4`);

    batchScenes.push({
      sceneNumber: idx + 1,
      id: scene.id,
      type: scene.type,
      durationSec: Number(scene.durationSec || 4),
      aspectRatio: '9:16',
      resolution: '1080p',
      subtitleVi: scene.subtitle || '',
      cameraSpec: built.cameraSpec,
      sfxSpec: built.sfxSpec,
      museStyleId: built.museStyle.id,
      museStyleLabel: built.museStyle.label,
      visualAction: scene.visualAction,
      ingredients: {
        characterImage: charImgRel,
        productImage: prodImgRel,
        sceneBackdropImage: sceneThumbRel,
        firstFrameKeyframe: startKeyframeRel,
        lastFrameKeyframe: endKeyframeRel,
        sampleMotionRef3s: hasRefClip ? refClipRel : ''
      },
      whisk3SlotPrompt: built.whisk3SlotPrompt,
      veo3Prompt: built.veo3Prompt,
      omniFlashR2VPrompt: built.omniFlashR2VPrompt,
      keyframePrompt: built.keyframePrompt,
      outputClip: outClipRel
    });

    lines.push(`---`);
    lines.push(`## Phân cảnh ${idx + 1}: \`${scene.id}\` (${scene.type} • ${scene.durationSec}s • 9:16 1080p)`);
    lines.push(`- **Lời thoại Tiếng Việt (Lip-Sync / Voiceover):** "${scene.subtitle}"`);
    lines.push(`- **Phong cách Muse Style:** ${built.museStyle.label}`);
    lines.push(`- **Khung hình Đầu (Start Frame):** \`${startKeyframeRel}\``);
    lines.push(`- **Khung hình Cuối (End Frame):** \`${endKeyframeRel}\``);
    lines.push(`- **Góc máy & Ống kính (Camera):** ${built.cameraSpec}`);
    lines.push(`- **Hiệu ứng âm thanh (SFX):** ${built.sfxSpec}`);
    if (hasRefClip) {
      lines.push(`- **Clip mẫu tham chiếu nhịp máy (3s):** \`${refClipRel}\``);
    }
    lines.push(``);
    lines.push(`### A. Prompt Chuẩn Muse AI / Google Whisk 3-Slot (Subject + Scene + Style)`);
    lines.push('```text');
    lines.push(built.whisk3SlotPrompt);
    lines.push('```');
    lines.push(``);
    lines.push(`### B. Prompt Chuẩn Google Veo 3.1 (Start→End Frame + Native Audio Lip-Sync)`);
    lines.push('```text');
    lines.push(built.veo3Prompt);
    lines.push('```');
    lines.push(``);
    lines.push(`### C. Prompt Chuẩn Gemini Omni 1.2 Flash (Reference-to-Video R2V)`);
    lines.push('```text');
    lines.push(built.omniFlashR2VPrompt);
    lines.push('```');
    lines.push(``);
  });

  const mdOutPath = path.join(campDir, 'prompts.md');
  fs.writeFileSync(mdOutPath, lines.join('\n'), 'utf8');

  const veo3JsonOutPath = path.join(campDir, 'veo3-prompts.json');
  const packData = {
    generatedAt: new Date().toISOString(),
    campaignId: campaign.id,
    title: campaign.title,
    workflowStyle: 'MuseAI-Whisk3Slot-Veo3.1-Hybrid-RealAssetLock',
    museStyle: campaignStyle,
    characterBible: {
      id: character.id,
      name: character.name,
      immutableTraits: character.immutableTraits || [],
      referenceImage: charImgRel
    },
    productBible: {
      id: product.id,
      name: product.name,
      price: product.price,
      salePrice: product.salePrice,
      immutableFeatures: product.immutableFeatures || [],
      forbiddenChanges: product.forbiddenChanges || [],
      referenceImage: prodImgRel
    },
    scenes: batchScenes
  };
  fs.writeFileSync(veo3JsonOutPath, JSON.stringify(packData, null, 2) + '\n', 'utf8');

  return {
    mdRel: path.relative(ROOT, mdOutPath).replace(/\\/g, '/'),
    jsonRel: path.relative(ROOT, veo3JsonOutPath).replace(/\\/g, '/'),
    packData
  };
}

if (process.argv[1] && path.resolve(process.argv[1]).endsWith('generate-prompts.mjs')) {
  const argPath = process.argv[2] || 'campaigns/sample-campaign/campaign.json';
  const res = generateVeo3PromptsAndPack(argPath);
  console.log(`Đã xuất bộ Prompt Muse AI × Whisk 3-Slot × Veo 3.1 tại: ${res.mdRel} và ${res.jsonRel}`);
}
