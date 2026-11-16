import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeViForTts } from '../lib/vi-text-normalize.mjs';

test('đọc giá', () => {
  const r = normalizeViForTts('Chỉ 199.000đ');
  assert.equal(r.spoken, 'Chỉ một trăm chín mươi chín nghìn đồng');
  assert.deepEqual(r.tokens[1], {
    display: '199.000đ',
    spoken: ['một', 'trăm', 'chín', 'mươi', 'chín', 'nghìn', 'đồng']
  });
});

test('quy tắc đọc số', () => {
  const cases = [
    ['21', 'hai mươi mốt'],
    ['15', 'mười lăm'],
    ['105', 'một trăm linh năm'],
    ['1.000.000', 'một triệu'],
    ['50%', 'năm mươi phần trăm'],
    ['24h', 'hai mươi bốn giờ']
  ];
  for (const [n, s] of cases) {
    assert.equal(normalizeViForTts(n).spoken, s);
  }
});

test('giữ nguyên chữ có dấu', () => {
  assert.equal(normalizeViForTts('Chính hãng').tokens.length, 2);
});
