import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { slugifyProductId, saveProductRecord } from '../lib/product-store.mjs';

test('slugifyProductId chuyển tiếng Việt có dấu thành slug chuẩn', () => {
  assert.equal(slugifyProductId('Đèn Ngủ Cảm Biến 360°'), 'den-ngu-cam-bien-360');
});

test('saveProductRecord báo lỗi khi thiếu tên hoặc giá', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'prod-save-'));
  assert.throws(() => saveProductRecord({ price: '199.000đ' }, { root: dir }), /Tên sản phẩm/);
  assert.throws(() => saveProductRecord({ name: 'Son Lì' }, { root: dir }), /Giá sản phẩm/);
});

test('saveProductRecord ghi product.json hợp lệ chuẩn schema validate-assets', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'prod-ok-'));
  const res = saveProductRecord({
    name: 'Kem Chống Nắng Nâng Tone 50ml',
    price: '299.000đ',
    salePrice: '199.000đ',
    category: 'beauty',
    highlights: 'Kiềm dầu 8h|Không vệt trắng',
    immutableFeatures: 'White tube with orange cap|SPF50+ PA++++ print'
  }, { root: dir });

  assert.equal(res.ok, true);
  assert.equal(res.product.id, 'kem-chong-nang-nang-tone-50ml');
  assert.equal(res.product.highlights.length, 2);
  assert.equal(res.product.immutableFeatures.length, 2);
  assert.ok(fs.existsSync(path.join(dir, 'assets', 'products', res.product.id, 'product.json')));
});
