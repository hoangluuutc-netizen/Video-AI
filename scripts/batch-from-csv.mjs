import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { ROOT } from './lib/footage.mjs';
import { readJson } from './lib/prompt-builder.mjs';

function parseCsvLine(line) {
  const out = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      out.push(cur.trim());
      cur = '';
    } else {
      cur += ch;
    }
  }
  out.push(cur.trim());
  return out;
}

function parseCsv(text) {
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) return [];
  const headers = parseCsvLine(lines[0]);
  return lines.slice(1).map((line) => {
    const vals = parseCsvLine(line);
    const row = {};
    headers.forEach((h, i) => {
      row[h] = vals[i] ?? '';
    });
    return row;
  });
}

function main() {
  const args = process.argv.slice(2);
  const autoRun = args.includes('--run');
  const csvArg = args.find((a) => !a.startsWith('--')) || 'assets/products/batch-template.csv';
  const csvAbs = path.isAbsolute(csvArg) ? csvArg : path.join(ROOT, csvArg);

  if (!fs.existsSync(csvAbs)) {
    console.error(`Không tìm thấy file CSV: ${csvAbs}`);
    process.exit(1);
  }

  const rows = parseCsv(fs.readFileSync(csvAbs, 'utf8'));
  const sampleCamp = readJson(path.join(ROOT, 'campaigns', 'sample-campaign', 'campaign.json'));
  const created = [];

  for (const row of rows) {
    const id = (row.id || '').toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-|-$/g, '');
    if (!id || !row.name) continue;

    const prodDir = path.join(ROOT, 'assets', 'products', id);
    fs.mkdirSync(prodDir, { recursive: true });
    const productObj = {
      id,
      name: row.name,
      sku: row.sku || id.toUpperCase(),
      category: row.category || 'home',
      price: row.price || '299.000đ',
      salePrice: row.salePrice || row.price || '199.000đ',
      discountBadge: row.discountBadge || 'ƯU ĐÃI HÔM NAY',
      highlights: (row.highlights || '').split('|').map((s) => s.trim()).filter(Boolean),
      immutableFeatures: (row.immutableFeatures || row.name).split('|').map((s) => s.trim()).filter(Boolean),
      forbiddenChanges: ['Do not alter product shape, colors, or brand logo'],
      referenceImages: {
        front: row.imagePath || `assets/products/${id}/front.png`
      }
    };
    fs.writeFileSync(path.join(prodDir, 'product.json'), JSON.stringify(productObj, null, 2) + '\n', 'utf8');

    const campId = `batch-${id}`;
    const campDir = path.join(ROOT, 'campaigns', campId);
    fs.mkdirSync(campDir, { recursive: true });
    const campObj = JSON.parse(JSON.stringify(sampleCamp));
    campObj.id = campId;
    campObj.title = `Chiến dịch ${row.name}`;
    campObj.productId = id;
    campObj.hookText = `Đừng mua ${row.name} nếu bạn chưa xem 3 chi tiết này!`;
    campObj.ctaText = `Chỉ ${productObj.salePrice} hôm nay — Đặt ngay!`;
    const campPath = path.join(campDir, 'campaign.json');
    fs.writeFileSync(campPath, JSON.stringify(campObj, null, 2) + '\n', 'utf8');

    execFileSync('node', [path.join(ROOT, 'scripts', 'generate-prompts.mjs'), campPath], { stdio: 'inherit' });
    if (autoRun) {
      execFileSync('node', [path.join(ROOT, 'scripts', 'run-optimal-pipeline.mjs'), campPath], { stdio: 'inherit' });
    }
    created.push({ id, campId });
  }

  console.log(`OK: Đã xử lý ${created.length} SKU từ CSV (${created.map((c) => c.campId).join(', ')}).`);
}

main();
