import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { buildScenePrompt, inferMuseStyle, MUSE_STYLE_PRESETS, readJson } from './lib/prompt-builder.mjs';

const ROOT = process.cwd();

function resolveRealAssetPaths(product, character) {
  const prodRel =
    product.referenceImages?.front ||
    Object.values(product.referenceImages || {}).find(Boolean) ||
    'assets/products/sample-product/front.png';
  const charRel =
    character.referenceImages?.portrait ||
    Object.values(character.referenceImages || {}).find(Boolean) ||
    'assets/characters/sample-kol/portrait.png';
  return {
    prodRel,
    charRel,
    prodAbs: path.join(ROOT, prodRel),
    charAbs: path.join(ROOT, charRel)
  };
}

function resolveSampleSceneThumb(idx) {
  const thumbRel = `assets/footage/analysis/video-m-u/scene-${(idx % 4) + 1}.jpg`;
  const thumbAbs = path.join(ROOT, thumbRel);
  if (fs.existsSync(thumbAbs)) return { thumbRel, thumbAbs };
  return { thumbRel: '', thumbAbs: '' };
}

export function generateMuseKeyframesAndPack(campaignArg = 'campaigns/sample-campaign/campaign.json', styleOverride = '') {
  const campaignPath = path.isAbsolute(campaignArg) ? campaignArg : path.join(ROOT, campaignArg);
  if (!fs.existsSync(campaignPath)) {
    throw new Error(`Không tìm thấy campaign.json: ${campaignPath}`);
  }

  const campaignDir = path.dirname(campaignPath);
  const campaign = readJson(campaignPath);
  const styleId = styleOverride || campaign.museStyle || 'tvc-studio-luxury';
  campaign.museStyle = styleId;

  const productPath = path.join(ROOT, 'assets', 'products', campaign.productId, 'product.json');
  const charPath = path.join(ROOT, 'assets', 'characters', campaign.characterId, 'character.json');
  const product = readJson(productPath);
  const character = readJson(charPath);
  const { prodRel, charRel, prodAbs, charAbs } = resolveRealAssetPaths(product, character);

  const keyframeDir = path.join(campaignDir, 'media', 'keyframes');
  fs.mkdirSync(keyframeDir, { recursive: true });

  const scenesPack = [];

  for (let i = 0; i < (campaign.scenes || []).length; i++) {
    const scene = campaign.scenes[i];
    const museStyle = inferMuseStyle(scene, styleId);
    const { thumbRel, thumbAbs } = resolveSampleSceneThumb(i);
    const built = buildScenePrompt(scene, product, character, i, styleId);

    const startRel = path.posix.join('media', 'keyframes', `${scene.id}-start.png`);
    const endRel = path.posix.join('media', 'keyframes', `${scene.id}-end.png`);
    const defaultRel = path.posix.join('media', 'keyframes', `${scene.id}.png`);

    const startAbs = path.join(campaignDir, startRel);
    const endAbs = path.join(campaignDir, endRel);
    const defaultAbs = path.join(campaignDir, defaultRel);

    // 1. Tạo KHUNG HÌNH ĐẦU (Start Frame: Bối cảnh Bokeh + Nhân vật thật & Sản phẩm thật cân đối)
    if (thumbAbs && fs.existsSync(thumbAbs)) {
      execFileSync('ffmpeg', [
        '-y', '-v', 'error',
        '-i', thumbAbs,
        '-i', charAbs,
        '-i', prodAbs,
        '-filter_complex',
        `[0:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,boxblur=42:6,eq=${museStyle.ffmpegEq}[bg];` +
          `[bg]drawbox=x=44:y=320:w=476:h=760:color=#1E293B@0.88:t=fill,` +
          `drawbox=x=44:y=320:w=476:h=760:color=#FF5A1F@0.95:t=5,` +
          `drawbox=x=556:y=320:w=480:h=760:color=#FFFFFF@0.96:t=fill,` +
          `drawbox=x=556:y=320:w=480:h=760:color=#FF5A1F@0.95:t=5[bg2];` +
          `[1:v]scale=452:736:force_original_aspect_ratio=decrease,pad=452:736:(ow-iw)/2:(oh-ih)/2:color=#0F172A[ch];` +
          `[2:v]scale=448:728:force_original_aspect_ratio=decrease,pad=448:728:(ow-iw)/2:(oh-ih)/2:color=white[pr];` +
          `[bg2][ch]overlay=56:332[tmp1];` +
          `[tmp1][pr]overlay=572:336`,
        '-frames:v', '1',
        startAbs
      ]);
    } else {
      execFileSync('ffmpeg', [
        '-y', '-v', 'error',
        '-f', 'lavfi', '-i', 'color=c=#0F172A:s=1080x1920:d=1',
        '-i', charAbs,
        '-i', prodAbs,
        '-filter_complex',
        `[0:v]drawbox=x=44:y=320:w=476:h=760:color=#1E293B@0.95:t=fill,` +
          `drawbox=x=556:y=320:w=480:h=760:color=#FFFFFF@0.98:t=fill[bg];` +
          `[1:v]scale=452:736:force_original_aspect_ratio=decrease,pad=452:736:(ow-iw)/2:(oh-ih)/2:color=#0F172A[ch];` +
          `[2:v]scale=448:728:force_original_aspect_ratio=decrease,pad=448:728:(ow-iw)/2:(oh-ih)/2:color=white[pr];` +
          `[bg][ch]overlay=56:332[tmp1];` +
          `[tmp1][pr]overlay=572:336`,
        '-frames:v', '1',
        startAbs
      ]);
    }

    // 2. Tạo KHUNG HÌNH CUỐI (End Frame: Push-in Cận cảnh Sản phẩm thật 100% + Góc Nhân vật thật)
    if (thumbAbs && fs.existsSync(thumbAbs)) {
      execFileSync('ffmpeg', [
        '-y', '-v', 'error',
        '-i', thumbAbs,
        '-i', prodAbs,
        '-i', charAbs,
        '-filter_complex',
        `[0:v]scale=1160:2060:force_original_aspect_ratio=increase,crop=1080:1920,boxblur=45:6,eq=${museStyle.ffmpegEq}[bg];` +
          `[bg]drawbox=x=150:y=260:w=780:h=980:color=#FFFFFF@0.97:t=fill,` +
          `drawbox=x=150:y=260:w=780:h=980:color=#FF5A1F@0.95:t=6,` +
          `drawbox=x=64:y=156:w=276:h=366:color=#0F172A@0.95:t=fill,` +
          `drawbox=x=64:y=156:w=276:h=366:color=#38BDF8@0.95:t=4[bg2];` +
          `[1:v]scale=720:920:force_original_aspect_ratio=decrease,pad=720:920:(ow-iw)/2:(oh-ih)/2:color=white[pr];` +
          `[2:v]scale=260:350:force_original_aspect_ratio=decrease,pad=260:350:(ow-iw)/2:(oh-ih)/2:color=#0F172A[ch];` +
          `[bg2][pr]overlay=180:290[tmp1];` +
          `[tmp1][ch]overlay=72:164`,
        '-frames:v', '1',
        endAbs
      ]);
    } else {
      fs.copyFileSync(startAbs, endAbs);
    }

    // Đồng bộ file keyframe mặc định
    fs.copyFileSync(startAbs, defaultAbs);

    scene.keyframeSrc = defaultRel;
    scene.startKeyframeSrc = startRel;
    scene.endKeyframeSrc = endRel;
    scene.museStyle = museStyle.id;

    scenesPack.push({
      sceneNumber: i + 1,
      sceneId: scene.id,
      type: scene.type,
      durationSec: scene.durationSec || 4,
      dialogueVi: scene.subtitle || '',
      visualAction: scene.visualAction || '',
      museStyle: museStyle.id,
      museStyleLabel: museStyle.label,
      whisk3Slots: {
        slot1Subject: {
          characterImage: charRel,
          productImage: prodRel,
          description: `${character.name} + ${product.name} (Khóa cứng 100% chi tiết gốc)`
        },
        slot2Scene: {
          sceneReferenceImage: thumbRel,
          description: scene.setting || 'Studio Bokeh lấy từ nhịp ánh sáng Video Mẫu'
        },
        slot3Style: {
          styleId: museStyle.id,
          styleLabel: museStyle.label,
          stylePrompt: museStyle.stylePrompt
        }
      },
      keyframes: {
        startFrame: path.posix.join('campaigns', campaign.id, startRel),
        endFrame: path.posix.join('campaigns', campaign.id, endRel)
      },
      prompts: {
        whisk3SlotPrompt: built.whisk3SlotPrompt,
        veo3FramesToVideoPrompt: built.veo3Prompt,
        omniFlashPrompt: built.omniFlashR2VPrompt
      }
    });
  }

  fs.writeFileSync(campaignPath, JSON.stringify(campaign, null, 2) + '\n', 'utf8');

  const musePackPath = path.join(campaignDir, 'muse-ai-pack.json');
  const musePayload = {
    campaignId: campaign.id,
    generatedAt: new Date().toISOString(),
    methodology: 'Muse AI + Google Whisk 3-Slot (Subject + Scene + Style) + Veo 3.1 Start/End Frame Continuity',
    selectedStyle: MUSE_STYLE_PRESETS[styleId] || MUSE_STYLE_PRESETS['tvc-studio-luxury'],
    availableStyles: Object.values(MUSE_STYLE_PRESETS),
    scenes: scenesPack
  };
  fs.writeFileSync(musePackPath, JSON.stringify(musePayload, null, 2) + '\n', 'utf8');

  console.log(
    `OK [Muse AI + Whisk 3-Slot]: Đã tạo ${scenesPack.length * 2} ảnh Keyframe (Khung Đầu & Khung Cuối) và xuất ${path.relative(ROOT, musePackPath)}`
  );
  return musePayload;
}

if (
  import.meta.url === `file:///${process.argv[1]?.replace(/\\/g, '/')}` ||
  process.argv[1]?.endsWith('generate-muse-pack.mjs')
) {
  const arg = process.argv[2] || 'campaigns/sample-campaign/campaign.json';
  const styleArg = process.argv[3] || '';
  try {
    generateMuseKeyframesAndPack(arg, styleArg);
  } catch (err) {
    console.error('LỖI generate-muse-pack:', err.message);
    process.exit(1);
  }
}
