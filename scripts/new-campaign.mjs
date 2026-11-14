import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const TEMPLATES_DIR = path.join(ROOT, 'templates', 'storyboards');

function listTemplates() {
  if (!fs.existsSync(TEMPLATES_DIR)) return [];
  return fs
    .readdirSync(TEMPLATES_DIR)
    .filter((f) => f.endsWith('.json'))
    .map((f) => f.replace(/\.json$/, ''));
}

function parseArgs(argv) {
  let slug = '';
  let templateName = '';
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--template' && argv[i + 1]) {
      templateName = argv[i + 1];
      i++;
    } else if (!argv[i].startsWith('--') && !slug) {
      slug = argv[i];
    }
  }
  return { slug, templateName };
}

function main() {
  const { slug, templateName } = parseArgs(process.argv.slice(2));
  const available = listTemplates();

  if (!slug || !/^[a-z0-9-]+$/.test(slug)) {
    console.error('Cách dùng: node scripts/new-campaign.mjs <ten-chien-dich-khong-dau> [--template <ten-mau>]');
    console.error('Ví dụ:   node scripts/new-campaign.mjs sale-thang-11 --template tiktok-flash-sale');
    if (available.length > 0) {
      console.error(`Mẫu có sẵn: ${available.join(', ')}`);
    }
    process.exit(1);
  }

  const targetDir = path.join(ROOT, 'campaigns', slug);
  if (fs.existsSync(targetDir)) {
    console.error(`Chiến dịch "${slug}" đã tồn tại tại ${targetDir}`);
    process.exit(1);
  }

  const samplePath = path.join(ROOT, 'campaigns', 'sample-campaign', 'campaign.json');
  const campaign = JSON.parse(fs.readFileSync(samplePath, 'utf8'));

  if (templateName) {
    const tplPath = path.join(TEMPLATES_DIR, `${templateName}.json`);
    if (!fs.existsSync(tplPath)) {
      console.error(`Không tìm thấy template "${templateName}" trong templates/storyboards/`);
      if (available.length > 0) {
        console.error(`Mẫu có sẵn: ${available.join(', ')}`);
      }
      process.exit(1);
    }
    const tpl = JSON.parse(fs.readFileSync(tplPath, 'utf8'));
    if (Array.isArray(tpl.platforms)) campaign.platforms = tpl.platforms;
    if (Array.isArray(tpl.scenes)) campaign.scenes = tpl.scenes;
    if (tpl.mode) campaign.mode = tpl.mode;
    else delete campaign.mode;
  }

  campaign.id = slug;
  campaign.title = `Chiến dịch ${slug}`;

  fs.mkdirSync(targetDir, { recursive: true });
  fs.writeFileSync(
    path.join(targetDir, 'campaign.json'),
    JSON.stringify(campaign, null, 2) + '\n',
    'utf8'
  );

  console.log(`Đã tạo chiến dịch mới tại: campaigns/${slug}/campaign.json`);
  if (templateName) {
    console.log(`Áp dụng template: ${templateName}`);
  }
  console.log(`Bước tiếp theo:`);
  console.log(`  1. Chỉnh sửa productId, characterId và kịch bản trong campaigns/${slug}/campaign.json`);
  console.log(`  2. Chạy: node scripts/generate-prompts.mjs campaigns/${slug}/campaign.json`);
}

main();
