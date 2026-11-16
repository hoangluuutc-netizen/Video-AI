import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeViForTts } from '../lib/vi-text-normalize.mjs';
import {
  syllableKey,
  heuristicWordTimes,
  mapAsrToScript,
  parseSilenceDetect,
  boundsFromRaw
} from '../lib/word-aligner.mjs';

const asr = (pairs) => pairs.map(([w, start, end]) => ({ w, start, end }));

test('syllableKey bỏ dấu câu, giữ dấu thanh, chữ thường', () => {
  assert.equal(syllableKey('Hãng!'), 'hãng');
  assert.equal(syllableKey(','), '');
  assert.notEqual(syllableKey('hãng'), syllableKey('hàng'));
});

test('giữ chữ 199.000đ, lấy thời gian từ 7 từ đọc', () => {
  const tokens = normalizeViForTts('Chỉ 199.000đ').tokens;
  const words = asr([
    ['chỉ', 0.1, 0.3], ['một', 0.35, 0.5], ['trăm', 0.5, 0.7], ['chín', 0.7, 0.85],
    ['mươi', 0.85, 1.0], ['chín', 1.0, 1.15], ['nghìn', 1.15, 1.35], ['đồng', 1.35, 1.6]
  ]);
  const r = mapAsrToScript(tokens, words);
  assert.equal(r.length, 2);
  assert.equal(r[1].display, '199.000đ');
  assert.equal(r[1].start, 0.35);
  assert.equal(r[1].end, 1.6);
  assert.equal(r[1].source, 'asr');
});

test('ASR nghe sai 1 từ thì nội suy, vẫn giữ chữ gốc có dấu', () => {
  const tokens = normalizeViForTts('Chính hãng giá tốt').tokens;
  const r = mapAsrToScript(tokens, asr([['chính', 0, 0.3], ['hàng', 0.3, 0.6], ['giá', 0.6, 0.9], ['tốt', 0.9, 1.2]]));
  const hang = r.find((x) => x.display === 'hãng');
  assert.equal(hang.source, 'interp');
  assert.equal(hang.start, 0.3);
  assert.equal(hang.end, 0.6);
  assert.deepEqual(r.map((x) => x.display), ['Chính', 'hãng', 'giá', 'tốt']);
});

test('mapAsrToScript không có từ ASR nào thì trả null để rơi về heuristic', () => {
  assert.equal(mapAsrToScript(normalizeViForTts('Xin chào').tokens, []), null);
});

test('heuristic phủ kín [start,end] và tăng dần', () => {
  const tokens = normalizeViForTts('Chỉ 199.000đ, chính hãng!').tokens;
  const r = heuristicWordTimes(tokens, { speechStart: 0.2, speechEnd: 3.0 });
  assert.equal(r.length, 4);
  assert.equal(r[0].start, 0.2);
  assert.equal(r.at(-1).end, 3.0);
  assert.ok(r.every((w, i) => w.end > w.start && (i === 0 || w.start >= r[i - 1].end - 1e-9)));
  // token số đọc 7 âm tiết phải dài hơn token 1 âm tiết
  assert.ok(r[1].end - r[1].start > r[0].end - r[0].start);
});

test('parseSilenceDetect: lặng đầu và cuối', () => {
  const stderr = [
    '[silencedetect @ 0x1] silence_start: 0',
    '[silencedetect @ 0x1] silence_end: 0.214 | silence_duration: 0.214',
    '[silencedetect @ 0x1] silence_start: 1.1',
    '[silencedetect @ 0x1] silence_end: 1.3 | silence_duration: 0.2',
    '[silencedetect @ 0x1] silence_start: 2.95'
  ].join('\n');
  assert.deepEqual(parseSilenceDetect(stderr, 3.2), { speechStart: 0.214, speechEnd: 2.95 });
});

test('parseSilenceDetect: không có khoảng lặng thì lấy toàn bộ', () => {
  assert.deepEqual(parseSilenceDetect('', 4), { speechStart: 0, speechEnd: 4 });
});

test('boundsFromRaw quy đổi theo tempo và kẹp trong thời lượng cảnh', () => {
  assert.deepEqual(boundsFromRaw({ speechStart: 0.23, speechEnd: 4.6 }, 1.15, 4), { speechStart: 0.2, speechEnd: 4 });
  assert.deepEqual(boundsFromRaw({ speechStart: 0.1, speechEnd: 2.5 }, 1, 4), { speechStart: 0.1, speechEnd: 2.5 });
});
