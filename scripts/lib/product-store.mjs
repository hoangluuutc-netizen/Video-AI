import fs from 'node:fs';
import path from 'node:path';

export function slugifyProductId(raw) {
  return String(raw || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
}

function toList(val, fallback = []) {
  if (Array.isArray(val)) {
    const cleaned = val.map((x) => String(x).trim()).filter(Boolean);
    return cleaned.length ? cleaned : fallback;
  }
  const cleaned = String(val || '')
    .split(/\r?\n|\|/)
    .map((x) => x.trim())
    .filter(Boolean);
  return cleaned.length ? cleaned : fallback;
}

export function saveProductRecord(payload = {}, { root = process.cwd() } = {}) {
  const name = String(payload.name || '').trim();
  if (!name) throw new Error('Tên sản phẩm không được để trống.');

  const price = String(payload.price || '').trim();
  if (!price) throw new Error('Giá sản phẩm không được để trống.');

  const id = slugifyProductId(payload.id || name);
  if (!id || !/^[a-z0-9-]+$/.test(id)) {
    throw new Error('Mã sản phẩm (ID) không hợp lệ.');
  }

  const prodDir = path.join(root, 'assets', 'products', id);
  fs.mkdirSync(prodDir, { recursive: true });
  const prodPath = path.join(prodDir, 'product.json');
  const existing = fs.existsSync(prodPath) ? JSON.parse(fs.readFileSync(prodPath, 'utf8')) : {};

  const highlights = toList(payload.highlights, existing.highlights || [`Chất lượng nổi bật: ${name}`]);
  const immutableFeatures = toList(
    payload.immutableFeatures,
    existing.immutableFeatures || ['Exact original packaging, logo, and proportions']
  );

  const record = {
    ...existing,
    id,
    name,
    sku: String(payload.sku || existing.sku || id.toUpperCase()).trim(),
    category: String(payload.category || existing.category || 'general').trim(),
    price,
    salePrice: String(payload.salePrice || existing.salePrice || price).trim(),
    discountBadge: String(payload.discountBadge || existing.discountBadge || '').trim(),
    highlights,
    immutableFeatures,
    referenceImages: existing.referenceImages || {}
  };

  fs.writeFileSync(prodPath, JSON.stringify(record, null, 2) + '\n', 'utf8');
  return {
    ok: true,
    product: record,
    relPath: path.posix.join('assets', 'products', id, 'product.json')
  };
}
