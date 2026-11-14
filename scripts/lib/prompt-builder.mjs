import fs from 'node:fs';

export const DEFAULT_NEGATIVE =
  'warped logo, distorted brand text, altered product colors, melted packaging, extra fingers, missing fingers, unnatural grip, face morphing, plastic skin, blurry product edges, random text overlays';

export function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

export function buildScenePrompt(scene, product, character) {
  const productLock = (product.immutableFeatures || []).join('; ');
  const forbidden = (product.forbiddenChanges || []).join('; ');
  const charLock = (character.immutableTraits || []).join('; ');

  const keyframePrompt = [
    `Commercial e-commerce photography, ultra-sharp, realistic natural lighting.`,
    `Subject: ${charLock}.`,
    `Product (LOCKED TO REFERENCE IMAGE): ${product.name} (${productLock}).`,
    `Action & Composition: ${scene.visualAction}`,
    `Setting: ${scene.setting}.`,
    `Strict constraints: Preserve exact product geometry, logo, label typography, and color finish from the product reference image. ${forbidden}.`,
    `Negative: ${DEFAULT_NEGATIVE}`
  ].join('\n');

  const videoPrompt = [
    `Image-to-Video from approved Keyframe. Motion level: ${scene.motionLevel || 'low'}.`,
    `Action: ${scene.visualAction}`,
    `Lock rule: Keep product shape, logo, surface texture, and character facial identity 100% consistent with the first frame. No rapid rotation, no text generation.`,
    `Negative: ${DEFAULT_NEGATIVE}`
  ].join('\n');

  return { keyframePrompt, videoPrompt };
}
