import fs from 'node:fs';
import path from 'node:path';
import { buildScenePrompt, readJson } from './lib/prompt-builder.mjs';

const ROOT = process.cwd();

function main() {
  const argPath = process.argv[2] || 'campaigns/sample-campaign/campaign.json';
  const campaignPath = path.isAbsolute(argPath) ? argPath : path.join(ROOT, argPath);

  if (!fs.existsSync(campaignPath)) {
    console.error(`Không tìm thấy file chiến dịch: ${campaignPath}`);
    process.exit(1);
  }

  const campaign = readJson(campaignPath);
  const productPath = path.join(ROOT, 'assets', 'products', campaign.productId, 'product.json');
  const charPath = path.join(ROOT, 'assets', 'characters', campaign.characterId, 'character.json');

  const product = readJson(productPath);
  const character = readJson(charPath);

  const lines = [
    `# Bộ Prompt Khóa Sản Phẩm & Nhân Vật — ${campaign.title}`,
    ``,
    `- **Sản phẩm:** ${product.name} (\`${product.sku || product.id}\`)`,
    `- **Nhân vật cố định:** ${character.name}`,
    `- **Ảnh tham chiếu sản phẩm:** ${Object.values(product.referenceImages || {}).join(', ')}`,
    `- **Ảnh tham chiếu nhân vật:** ${Object.values(character.referenceImages || {}).join(', ')}`,
    ``,
    `> **Quy tắc bắt buộc:** Luôn tạo & kiểm duyệt (QC) **Keyframe** trước. Chỉ khi logo, màu sắc, kiểu dáng sản phẩm và khuôn mặt khớp 100% mới đưa vào **Image-to-Video**.`,
    ``
  ];

  for (const scene of campaign.scenes) {
    lines.push(`---`);
    lines.push(`## Cảnh \`${scene.id}\` (${scene.type}, ${scene.durationSec}s)`);
    lines.push(`**Phụ đề tiếng Việt:** "${scene.subtitle}"`);
    lines.push(``);

    if (scene.type === 'real-product-closeup' || scene.type === 'offer-cta') {
      lines.push(
        `*Cảnh này được render trực tiếp bằng **Remotion (\`studio/\`)** sử dụng ảnh sản phẩm gốc và chữ tiếng Việt chuẩn — KHÔNG dùng AI tạo video để tránh sai lệch chi tiết.*`
      );
      lines.push(``);
      continue;
    }

    const { keyframePrompt, videoPrompt } = buildScenePrompt(scene, product, character);
    lines.push(`### 1. Prompt Tạo Ảnh Keyframe (FLUX Kontext / Gemini Image / ComfyUI)`);
    lines.push('```text');
    lines.push(keyframePrompt);
    lines.push('```');
    lines.push(``);
    lines.push(`### 2. Prompt Tạo Video Image-to-Video (Kling / Veo / Wan 2.1)`);
    lines.push('```text');
    lines.push(videoPrompt);
    lines.push('```');
    lines.push(``);
  }

  const outPath = path.join(path.dirname(campaignPath), 'prompts.md');
  fs.writeFileSync(outPath, lines.join('\n'), 'utf8');
  console.log(`Đã xuất bộ prompt tại: ${path.relative(ROOT, outPath)}`);
}

main();
