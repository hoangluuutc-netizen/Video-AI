import fs from 'node:fs';
import path from 'node:path';
import { validateVoiceProfile } from './lib/kol-consent.mjs';

const ROOT = process.cwd();
const VALID_SCENE_TYPES = new Set([
  'ai-lifestyle',
  'ai-experience',
  'real-product-closeup',
  'offer-cta',
  'real-footage'
]);
const AI_SCENE_TYPES = new Set(['ai-lifestyle', 'ai-experience']);
const VALID_QC_STATUSES = new Set(['pending', 'approved', 'rejected']);

function readJson(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  return JSON.parse(raw);
}

function assertFields(obj, fields, label, errors) {
  for (const field of fields) {
    if (obj[field] === undefined || obj[field] === null || obj[field] === '') {
      errors.push(`[${label}] Thiếu trường bắt buộc: "${field}"`);
    }
  }
}

function listSubdirs(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);
}

function validateScenes(scenes, label, errors, mode, warnings) {
  if (!Array.isArray(scenes) || scenes.length === 0) {
    errors.push(`[${label}] "scenes" phải có ít nhất 1 cảnh.`);
    return;
  }
  for (const scene of scenes) {
    if (mode === 'real-footage' && AI_SCENE_TYPES.has(scene.type)) {
      errors.push(`[${label} -> ${scene.id}] Chế độ real-footage (Zero-AI-Pixel) không được chứa cảnh AI "${scene.type}".`);
    }
    if (scene.type === 'real-footage') {
      const hasStart = typeof scene.trimStartSec === 'number';
      const hasEnd = typeof scene.trimEndSec === 'number';
      if (hasStart && hasEnd && scene.trimStartSec >= scene.trimEndSec) {
        errors.push(`[${label} -> ${scene.id}] trimStartSec phải nhỏ hơn trimEndSec.`);
      }
      if (!scene.footageId && warnings) {
        warnings.push(`[${label} -> ${scene.id}] Chưa gán footageId (clip quay thật trong assets/footage/catalog.json).`);
      }
    }
    const sLabel = `${label} -> ${scene.id || 'unknown-scene'}`;
    assertFields(scene, ['id', 'type', 'durationSec'], sLabel, errors);
    if (scene.type && !VALID_SCENE_TYPES.has(scene.type)) {
      errors.push(`[${sLabel}] type "${scene.type}" không hợp lệ.`);
    }
    if (typeof scene.durationSec !== 'number' || scene.durationSec <= 0) {
      errors.push(`[${sLabel}] durationSec phải là số dương (> 0).`);
    }
    if (scene.qcStatus !== undefined && scene.qcStatus !== '' && !VALID_QC_STATUSES.has(scene.qcStatus)) {
      errors.push(`[${sLabel}] qcStatus "${scene.qcStatus}" phải là pending | approved | rejected.`);
    }
  }
}

function main() {
  const errors = [];
  const warnings = [];

  // 1. Validate brand-kit
  const brandPath = path.join(ROOT, 'assets', 'brand-kit', 'brand.json');
  if (!fs.existsSync(brandPath)) {
    errors.push('Không tìm thấy assets/brand-kit/brand.json');
  } else {
    const brand = readJson(brandPath);
    assertFields(brand, ['brandName', 'primaryColor', 'secondaryColor'], 'brand.json', errors);
  }

  // 2. Validate products
  const productsDir = path.join(ROOT, 'assets', 'products');
  const productIds = new Set();
  for (const dir of listSubdirs(productsDir)) {
    const pFile = path.join(productsDir, dir, 'product.json');
    if (!fs.existsSync(pFile)) {
      errors.push(`[products/${dir}] Thiếu product.json`);
      continue;
    }
    const p = readJson(pFile);
    assertFields(p, ['id', 'name', 'price', 'highlights', 'immutableFeatures'], `products/${dir}`, errors);
    if (!Array.isArray(p.immutableFeatures) || p.immutableFeatures.length === 0) {
      errors.push(`[products/${dir}] "immutableFeatures" phải có ít nhất 1 mô tả khóa chi tiết sản phẩm.`);
    }
    productIds.add(p.id);
  }

  // 3. Validate characters
  const charsDir = path.join(ROOT, 'assets', 'characters');
  const charIds = new Set();
  for (const dir of listSubdirs(charsDir)) {
    const cFile = path.join(charsDir, dir, 'character.json');
    if (!fs.existsSync(cFile)) {
      errors.push(`[characters/${dir}] Thiếu character.json`);
      continue;
    }
    const c = readJson(cFile);
    assertFields(c, ['id', 'name', 'immutableTraits'], `characters/${dir}`, errors);
    if (!Array.isArray(c.immutableTraits) || c.immutableTraits.length === 0) {
      errors.push(`[characters/${dir}] "immutableTraits" phải có ít nhất 1 mô tả khóa nhân vật.`);
    }
    // Gói 7 — Task 8: hồ sơ giọng KOL (engine được phép, đồng ý khi clone, giọng mẫu người thật chỉ ở assets/private/)
    const vr = validateVoiceProfile(c.voiceProfile, `characters/${dir}`, { root: ROOT });
    errors.push(...vr.errors);
    warnings.push(...vr.warnings);
    charIds.add(c.id);
  }

  // 4. Validate storyboard templates (if present)
  const templatesDir = path.join(ROOT, 'templates', 'storyboards');
  let templateCount = 0;
  if (fs.existsSync(templatesDir)) {
    const tplFiles = fs.readdirSync(templatesDir).filter((f) => f.endsWith('.json'));
    templateCount = tplFiles.length;
    for (const file of tplFiles) {
      const tpl = readJson(path.join(templatesDir, file));
      assertFields(tpl, ['templateId', 'name', 'scenes'], `templates/storyboards/${file}`, errors);
      validateScenes(tpl.scenes, `templates/storyboards/${file}`, errors, tpl.mode, null);
    }
  }

  // 5. Validate campaigns
  const campaignsDir = path.join(ROOT, 'campaigns');
  for (const dir of listSubdirs(campaignsDir)) {
    const campFile = path.join(campaignsDir, dir, 'campaign.json');
    if (!fs.existsSync(campFile)) {
      errors.push(`[campaigns/${dir}] Thiếu campaign.json`);
      continue;
    }
    const camp = readJson(campFile);
    assertFields(camp, ['id', 'title', 'productId', 'characterId', 'scenes'], `campaigns/${dir}`, errors);
    if (camp.productId && !productIds.has(camp.productId)) {
      errors.push(`[campaigns/${dir}] productId "${camp.productId}" không tồn tại trong assets/products/`);
    }
    if (camp.characterId && !charIds.has(camp.characterId)) {
      errors.push(`[campaigns/${dir}] characterId "${camp.characterId}" không tồn tại trong assets/characters/`);
    }
    validateScenes(camp.scenes, `campaigns/${dir}`, errors, camp.mode, warnings);
  }

  if (warnings.length > 0) {
    console.warn('CẢNH BÁO:');
    for (const w of warnings) console.warn(' - ' + w);
  }

  if (errors.length > 0) {
    console.error('KIỂM TRA THẤT BẠI:');
    for (const err of errors) console.error(' - ' + err);
    process.exit(1);
  }

  console.log(
    `OK: Đã kiểm tra ${productIds.size} sản phẩm, ${charIds.size} nhân vật, ${templateCount} templates và ${listSubdirs(campaignsDir).length} chiến dịch. Tất cả hợp lệ!`
  );
}

main();
