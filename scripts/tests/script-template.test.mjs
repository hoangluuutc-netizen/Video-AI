// Mẫu kịch bản mặc định (dashboard/script-template.js — script trình duyệt, nạp bằng vm để test).
// Yêu cầu: video mặc định ≤ 30s khi ĐỌC TRỌN CÂU, chỉ nói điều có trong product.json,
// không viết cứng cho bình giữ nhiệt, không bịa số liệu / chứng thực.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { normalizeViForTts } from '../lib/vi-text-normalize.mjs';

const ctx = {};
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(process.cwd(), 'dashboard', 'script-template.js'), 'utf8'), ctx);
const T = ctx.ScriptTemplate;

const thermos = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'assets', 'products', 'sample-product', 'product.json'), 'utf8'));
const shirt = {
  name: 'Áo Thun Nam Cotton 100% Form Rộng',
  highlights: ['Cotton 100% thoáng mát, thấm hút tốt', 'Đường may kép chắc chắn', 'Form rộng dễ phối đồ'],
  price: '199.000đ',
  salePrice: '149.000đ',
  discountBadge: '-25%'
};
const minhAnh = { name: 'Minh Anh (Đại sứ thương hiệu)' };
const spokenCount = (text) => normalizeViForTts(text).spoken.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;

test('estimateSpokenSyllables khớp bộ chuẩn hóa TTS thật (số, giá, đơn vị)', () => {
  for (const t of [
    '399.000đ',
    'Giá ưu đãi 249.000đ, bấm giỏ hàng ngay!',
    'Inox 304 chuẩn y tế, giữ nhiệt 24h',
    'Bình Giữ Nhiệt Inox 304 Cao Cấp 750ml',
    'Nắp khóa chống tràn 360 độ',
    'Cotton 100% thoáng mát',
    'Xem trong 20 giây'
  ]) {
    assert.equal(T.estimateSpokenSyllables(t), spokenCount(t), t);
  }
});

test('shortProductName: bỏ phần thông số, tối đa 4 chữ; ưu tiên shortName nếu có', () => {
  assert.equal(T.shortProductName(thermos), 'Bình Giữ Nhiệt Inox');
  assert.equal(T.shortProductName(shirt), 'Áo Thun Nam Cotton');
  assert.equal(T.shortProductName({ name: 'Xe đạp thể thao' }), 'Xe đạp thể thao');
  assert.equal(T.shortProductName({ name: 'X', shortName: 'Bình 750' }), 'Bình 750');
});

for (const [label, product] of [['bình giữ nhiệt', thermos], ['áo thun', shirt]]) {
  test(`${label}: kịch bản mặc định đọc trọn câu ≤ 30s (ở nhịp đo thật ~3 âm tiết/giây)`, () => {
    const hooks = T.buildHookTemplates(product);
    const winner = [...hooks].sort((a, b) => b.scores.reduce((x, y) => x + y) - a.scores.reduce((x, y) => x + y))[0];
    const blocks = T.buildScriptBlocks(product, minhAnh, { ...winner, angleMode: 'same-as-sample' });
    const videoSec = T.estimateVideoSec(blocks, 'real-footage');
    assert.ok(videoSec <= 30, `video ước tính ${videoSec}s`);
    // mỗi khối đủ thời gian để đọc ở nhịp tự nhiên (không phải tăng tốc)
    for (const b of blocks) assert.ok(b.sec >= T.estimateSpokenSyllables(b.text) / 3.0, `${b.key}: ${b.sec}s cho "${b.text}"`);
  });

  test(`${label}: 15 hook ngắn (≤ 18 âm tiết đọc ra)`, () => {
    const hooks = T.buildHookTemplates(product);
    assert.equal(hooks.length, 15);
    for (const h of hooks) assert.ok(T.estimateSpokenSyllables(h.text) <= 18, h.text);
  });
}

test('áo thun: không câu nào nói nội dung riêng của bình giữ nhiệt', () => {
  const hooks = T.buildHookTemplates(shirt);
  const angles = ['same-as-sample', 'new-pain-point', 'live-test-proof', 'flash-deal-first', 'reverse-shock'];
  const texts = [
    ...hooks.map((h) => h.text),
    ...angles.flatMap((a) => T.buildScriptBlocks(shirt, minhAnh, { ...hooks[0], angleMode: a }).map((b) => b.text)),
    ...angles.map((a) => T.buildAngleHookText(shirt, a))
  ];
  for (const t of texts) assert.doesNotMatch(t, /bình|giữ nhiệt|nước đá|đá tan|đồ uống|vân tay|chống tràn|túi xách|24 giờ/i, t);
});

test('không bịa số liệu / chứng thực / cam kết không có trong product.json', () => {
  const hooks = T.buildHookTemplates(thermos);
  const texts = [...hooks.map((h) => h.text), ...T.buildScriptBlocks(thermos, minhAnh, hooks[0]).map((b) => b.text)];
  for (const t of texts) {
    assert.doesNotMatch(t, /\d+\s*%\s*người|truyền tay|ai cũng|số 1|tốt nhất|duy nhất|tiền triệu|100%/i, t);
  }
});

test('CTA chỉ nói giá có thật; thiếu giá giảm thì dùng giá gốc', () => {
  const cta = (p) => T.buildScriptBlocks(p, minhAnh, { text: 'x', angleMode: 'same-as-sample' }).find((b) => b.key === 'CTA').text;
  assert.match(cta(thermos), /249\.000đ/);
  assert.match(cta({ ...shirt, salePrice: '' }), /199\.000đ/);
});

test('scenePlan: quay thật gộp VẤN ĐỀ + LẬT Ý vào cảnh 2; thời lượng cảnh = tổng các khối', () => {
  const blocks = T.buildScriptBlocks(thermos, minhAnh, { text: 'Hook ngắn.', angleMode: 'same-as-sample' });
  const plan = T.scenePlan(blocks, 'real-footage');
  assert.equal(plan.length, 4);
  assert.equal(plan[1].id, 'scene-2-problem-flip');
  assert.equal(plan[1].subtitle, `${blocks[1].text} ${blocks[2].text}`);
  assert.equal(plan[1].durationSec, blocks[1].sec + blocks[2].sec);
  assert.equal(plan[3].subtitle, blocks[5].text);
  const hybrid = T.scenePlan(blocks, 'hybrid-ai');
  assert.equal(hybrid[1].id, 'scene-2-experience');
  assert.equal(hybrid[1].subtitle, blocks[2].text);
});
