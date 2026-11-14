import fs from 'node:fs';
import path from 'node:path';
import { readJson } from './lib/prompt-builder.mjs';
import { loadCatalog } from './lib/footage.mjs';

const ROOT = process.cwd();

function copyAssetToStudioPublic(srcPath, publicSubdir, publicRoot) {
  if (!srcPath) return undefined;
  const absSrc = path.isAbsolute(srcPath) ? srcPath : path.join(ROOT, srcPath);
  if (!fs.existsSync(absSrc)) return undefined;

  const fileName = path.basename(absSrc);
  const relDest = path.posix.join(publicSubdir, fileName);
  const absDest = path.join(publicRoot, relDest);
  fs.mkdirSync(path.dirname(absDest), { recursive: true });
  fs.copyFileSync(absSrc, absDest);
  return relDest;
}

function main() {
  const argPath = process.argv[2] || 'campaigns/sample-campaign/campaign.json';
  const campaignPath = path.isAbsolute(argPath) ? argPath : path.join(ROOT, argPath);
  if (!fs.existsSync(campaignPath)) {
    console.error(`Không tìm thấy file chiến dịch: ${campaignPath}`);
    process.exit(1);
  }

  const campaign = readJson(campaignPath);
  const campaignDir = path.dirname(campaignPath);
  const brand = readJson(path.join(ROOT, 'assets', 'brand-kit', 'brand.json'));
  const product = readJson(path.join(ROOT, 'assets', 'products', campaign.productId, 'product.json'));

  const studioPublic = path.join(ROOT, 'studio', 'public');
  const publicBase = path.posix.join('campaigns', campaign.id);

  const productRef = product.referenceImages?.cutoutPng || product.referenceImages?.front || '';
  const productImageSrc = copyAssetToStudioPublic(productRef, path.posix.join(publicBase, 'product'), studioPublic);

  const catalog = loadCatalog();

  const scenes = campaign.scenes.map((scene) => {
    const keyframeAbs = scene.keyframeSrc ? path.join(campaignDir, scene.keyframeSrc) : '';
    let videoAbs = scene.videoSrc ? path.join(campaignDir, scene.videoSrc) : '';
    if (scene.type === 'real-footage') {
      const clip = catalog.get(scene.footageId);
      if (clip) videoAbs = path.join(ROOT, clip.filePath);
      else console.warn(`Cảnh "${scene.id}": footageId "${scene.footageId || ''}" chưa có trong catalog — bỏ qua clip.`);
    }
    return {
      id: scene.id,
      type: scene.type,
      durationSec: scene.durationSec,
      subtitle: scene.subtitle,
      visualAction: scene.visualAction,
      setting: scene.setting,
      qcStatus: scene.qcStatus,
      trimStartSec: scene.trimStartSec,
      trimEndSec: scene.trimEndSec,
      keyframeSrc: copyAssetToStudioPublic(keyframeAbs, path.posix.join(publicBase, 'keyframes'), studioPublic),
      videoSrc: copyAssetToStudioPublic(videoAbs, path.posix.join(publicBase, 'clips'), studioPublic)
    };
  });

  const studioProps = {
    brandName: brand.brandName,
    primaryColor: brand.primaryColor,
    secondaryColor: brand.secondaryColor,
    accentColor: brand.accentColor || '#F59E0B',
    productName: product.name,
    sku: product.sku || product.id,
    price: product.price,
    salePrice: product.salePrice || product.price,
    discountBadge: product.discountBadge || '',
    highlights: product.highlights || [],
    hookText: campaign.hookText || '',
    ctaText: campaign.ctaText || '',
    productImageSrc,
    scenes
  };

  const outPath = path.join(ROOT, 'studio', 'src', 'activeCampaign.json');
  fs.writeFileSync(outPath, JSON.stringify(studioProps, null, 2) + '\n', 'utf8');
  console.log(`Đã đồng bộ chiến dịch "${campaign.id}" sang studio/src/activeCampaign.json`);
}

main();
