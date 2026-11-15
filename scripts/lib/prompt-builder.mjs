import fs from 'node:fs';
import { CATEGORY_PRESETS, STYLE_PRESETS } from './video-remake.mjs';

export { CATEGORY_PRESETS, STYLE_PRESETS };

export const DEFAULT_NEGATIVE =
  'warped logo, distorted brand text, altered product colors, melted packaging, extra fingers, missing fingers, unnatural grip, face morphing, plastic skin, blurry product edges, random text overlays';

export function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

export const CAMERA_PRESETS = {
  'hook-eye-level': 'Eye-level medium close-up shot, 50mm prime lens, f/1.8 shallow depth of field, subtle slow dolly-in to capture attention in the first 3 seconds',
  'ugc-handheld': 'Natural handheld UGC lifestyle shot, 35mm lens, gentle organic camera movement, warm sunlit indoor ambiance',
  'macro-product': 'Ultra-sharp macro close-up shot, 85mm f/2.8 lens, smooth slow pan across product surface texture and engraved logo, studio rim lighting',
  'split-comparison': 'Clean commercial studio framing, balanced two-shot composition showing character and product clearly, crisp commercial lighting',
  'cta-hero': 'Hero product showcase shot, dynamic slow push-in, warm golden studio backlight with clean negative space for price badge'
};

export const SFX_PRESETS = {
  'hook-eye-level': 'Crisp subtle studio whoosh transition, natural room tone, clear warm spoken voice',
  'ugc-handheld': 'Subtle tactile sound of hands holding the matte bottle, gentle click of the flip-top lid, warm acoustic background hum',
  'macro-product': 'Delicate metallic shimmer, crisp ice cubes clinking softly inside stainless steel, clean studio ambiance',
  'cta-hero': 'Upbeat modern commercial chime, confident spoken call-to-action, warm background music swell'
};

export const MUSE_STYLE_PRESETS = {
  'tvc-studio-luxury': {
    id: 'tvc-studio-luxury',
    label: '💎 TVC Studio Sang Trọng (Bokeh Vàng Ấm)',
    stylePrompt:
      'High-end commercial TVC lighting, warm golden rim light, ARRI Alexa / Sony Venice cinema color science, 85mm f/1.4 creamy bokeh, ultra-sharp product texture',
    ffmpegEq: 'brightness=-0.26:saturation=0.92:contrast=1.08'
  },
  'warm-lifestyle': {
    id: 'warm-lifestyle',
    label: '☀️ Lifestyle Đời Thường Tự Nhiên (Nắng Sớm)',
    stylePrompt:
      'Natural morning window sunlight, soft organic shadows, authentic UGC lifestyle color grade, Fujifilm Eterna warm film tone, realistic skin texture',
    ffmpegEq: 'brightness=-0.22:saturation=1.02:contrast=1.04'
  },
  'clean-shopee-mall': {
    id: 'clean-shopee-mall',
    label: '🛍️ Shopee Mall Sắc Nét (Sáng Rõ Chi Tiết)',
    stylePrompt:
      'Ultra-clean e-commerce studio softbox lighting, neutral 5600K daylight balance, crisp product edge definition, zero color cast on product label',
    ffmpegEq: 'brightness=-0.18:saturation=0.96:contrast=1.10'
  },
  'tiktok-viral-contrast': {
    id: 'tiktok-viral-contrast',
    label: '🔥 TikTok High-Retention (Tương Phản Ấn Tượng)',
    stylePrompt:
      'Punchy high-contrast social commercial look, dramatic studio key light with subtle teal-amber depth separation, razor-sharp subject focus',
    ffmpegEq: 'brightness=-0.28:saturation=1.10:contrast=1.14'
  }
};

export function inferCameraPreset(scene, idx = 0) {
  if (scene.cameraPreset && CAMERA_PRESETS[scene.cameraPreset]) {
    return CAMERA_PRESETS[scene.cameraPreset];
  }
  if (scene.type === 'real-product-closeup' || idx === 2) return CAMERA_PRESETS['macro-product'];
  if (scene.type === 'offer-cta' || idx === 3) return CAMERA_PRESETS['cta-hero'];
  if (idx === 1) return CAMERA_PRESETS['ugc-handheld'];
  return CAMERA_PRESETS['hook-eye-level'];
}

export function inferSfxPreset(scene, idx = 0) {
  if (scene.sfxPrompt) return scene.sfxPrompt;
  if (scene.type === 'real-product-closeup' || idx === 2) return SFX_PRESETS['macro-product'];
  if (scene.type === 'offer-cta' || idx === 3) return SFX_PRESETS['cta-hero'];
  if (idx === 1) return SFX_PRESETS['ugc-handheld'];
  return SFX_PRESETS['hook-eye-level'];
}

export function inferMuseStyle(scene, campaignStyleId = 'tvc-studio-luxury') {
  const key = scene.museStyle || campaignStyleId || 'tvc-studio-luxury';
  return MUSE_STYLE_PRESETS[key] || MUSE_STYLE_PRESETS['tvc-studio-luxury'];
}

export function buildScenePrompt(scene, product, character, idx = 0, campaignStyleId = 'tvc-studio-luxury') {
  const productLock = (product.immutableFeatures || []).join('; ');
  const forbidden = (product.forbiddenChanges || []).join('; ');
  const charLock = (character.immutableTraits || []).join('; ');
  const cameraSpec = inferCameraPreset(scene, idx);
  const sfxSpec = inferSfxPreset(scene, idx);
  const museStyle = inferMuseStyle(scene, campaignStyleId);
  const industryLabel = CATEGORY_PRESETS[scene.category || product.category] || '';
  const toneStyle = STYLE_PRESETS[scene.style || product.style] || null;
  const industryCue = industryLabel ? ` Category context: ${industryLabel}.` : '';
  const toneCue = toneStyle ? ` Visual style: ${toneStyle.prompt}.` : '';
  const dialogueVi = (scene.subtitle || '').trim();

  // 1. Prompt chuẩn Muse AI / Google Whisk 3-Slot (Subject + Scene + Style)
  const whisk3SlotPrompt = [
    `[MUSE AI / GOOGLE WHISK 3-SLOT REMIX — 9:16 VERTICAL]`,
    `• [SLOT 1 - SUBJECT (Chủ thể khóa cứng 100%)]: ${character.name} (${charLock}) holding/presenting ${product.name} (${productLock}). Preserve exact face and product geometry/logo.`,
    `• [SLOT 2 - SCENE (Bối cảnh & Hành động)]: ${scene.setting || 'Modern clean studio/lifestyle backdrop'}.${industryCue} Action: ${scene.visualAction}`,
    `• [SLOT 3 - STYLE (Ánh sáng & Màu phim)]: ${museStyle.stylePrompt}.${toneCue} Camera: ${cameraSpec}.`,
    `• [STRICT NEGATIVE]: ${DEFAULT_NEGATIVE}. ${forbidden}.`
  ].join('\n');

  const keyframePrompt = [
    `Commercial e-commerce photography, 4K photorealistic, ${museStyle.stylePrompt}.`,
    `Subject (CHARACTER LOCK - Reference Image 1): ${character.name} — ${charLock}.`,
    `Product (INGREDIENT LOCK - Reference Image 2): ${product.name} (${productLock}).`,
    `Camera & Framing: ${cameraSpec}.`,
    `Action & Composition: ${scene.visualAction}`,
    `Setting: ${scene.setting || 'Bright modern lifestyle studio setting'}.`,
    `Strict constraints: Preserve 100% exact product geometry, logo, label typography, and color finish from the product reference image. ${forbidden}.`,
    `Negative: ${DEFAULT_NEGATIVE}`
  ].join('\n');

  // 2. Prompt chuẩn Veo 3.1 (Ingredients-to-Video + First/Last Frame Continuity + Native Audio/Dialogue)
  const veo3Prompt = [
    `[VEO 3.1 + MUSE AI FRAMES-TO-VIDEO — 9:16 VERTICAL 1080p]`,
    `• Character Reference (Image 1): ${character.name} (${charLock}). Keep facial identity, hairstyle, and outfit 100% consistent across all scenes.`,
    `• Product Ingredient Reference (Image 2): ${product.name} (${productLock}). Preserve exact shape, proportions, surface finish, and logo without any distortion.`,
    `• Frame Continuity (Start Frame -> End Frame): Smoothly transition from Start Keyframe (medium hero shot) to End Keyframe (focused product emphasis) over ${scene.durationSec || 4}s.`,
    `• Camera & Lens: ${cameraSpec}.`,
    `• Style & Color Grade: ${museStyle.stylePrompt}.`,
    `• Scene Action (${scene.durationSec || 4}s): ${scene.visualAction}`,
    dialogueVi
      ? `• Native Audio & Lip-Sync Dialogue (Vietnamese): Character speaks naturally in Vietnamese with warm, clear delivery: "${dialogueVi}"`
      : `• Native Audio: No spoken dialogue.`,
    `• Sound Effects (SFX) & Ambience: ${sfxSpec}.`,
    `• Strict Negative Constraints: ${DEFAULT_NEGATIVE}. ${forbidden}.`
  ].join('\n');

  // 3. Prompt chuẩn Gemini Omni 1.2 Flash (Reference Image 1 + Reference Image 2 + Start/End Frame + 3s Motion Reference Video)
  const omniFlashR2VPrompt = [
    `In a single continuous commercial shot (${scene.durationSec || 4}s, 9:16 portrait, 1080p, ${museStyle.stylePrompt}):`,
    `The person from the first reference image (${character.name}, ${charLock}) holds and demonstrates the exact product from the second reference image (${product.name}, ${productLock}), following the camera framing and pacing of the 3-second reference video.`,
    `Transition smoothly from the starting keyframe pose to a close, clear showcase of the product at the ending frame.`,
    `Action: ${scene.visualAction}`,
    `Camera: ${cameraSpec}.`,
    dialogueVi ? `Audio & Dialogue: The character speaks clearly in Vietnamese: "${dialogueVi}".` : `Audio: Subtle studio ambience, no dialogue.`,
    `Sound design: ${sfxSpec}.`,
    `Use the given images as strict character and product references so the face, logo, and product geometry remain 100% unchanged. No warped text, no extra fingers.`
  ].join(' ');

  return {
    whisk3SlotPrompt,
    keyframePrompt,
    videoPrompt: veo3Prompt,
    veo3Prompt,
    omniFlashR2VPrompt,
    cameraSpec,
    sfxSpec,
    museStyle
  };
}
