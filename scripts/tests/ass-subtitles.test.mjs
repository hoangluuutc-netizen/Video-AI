import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { generateAssSubtitles, generateSceneAss, chunkWords, buildSrtFromWords } from '../lib/ass-subtitles.mjs';

const countDialogue = (s) => (s.match(/^Dialogue:/gm) || []).length;
const tmpFile = (name) => path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'ass-')), name);

const scenes = [
  { id: 's1', durationSec: 4, subtitle: 'Chính hãng giá tốt' },
  { id: 's2', durationSec: 3, subtitle: 'Đặt ngay hôm nay' }
];
const w = (display, start, end) => ({ display, start, end, source: 'heuristic' });
const wordsByScene = {
  s1: [w('Chính', 0.2, 0.6), w('hãng', 0.6, 1.0), w('giá', 1.0, 1.4), w('tốt', 1.4, 1.9)],
  s2: [w('Đặt', 0.1, 0.5), w('ngay', 0.5, 0.9), w('hôm', 0.9, 1.2), w('nay', 1.2, 1.6)]
};

test('không có words thì giữ 1 Dialogue mỗi cảnh (hành vi cũ)', () => {
  const out = tmpFile('legacy.ass');
  generateAssSubtitles(scenes, out, { width: 1080, height: 1920 });
  assert.equal(countDialogue(fs.readFileSync(out, 'utf8')), 2);
});

test('word-highlight: số Dialogue = số từ, thời gian tăng dần', () => {
  const out = tmpFile('words.ass');
  generateAssSubtitles(scenes, out, { width: 1080, height: 1920, wordsByScene });
  const text = fs.readFileSync(out, 'utf8');
  assert.equal(countDialogue(text), 8);
  const starts = [...text.matchAll(/^Dialogue: 0,(\d+):(\d\d):(\d\d)\.(\d\d)/gm)].map((m) => +m[1] * 3600 + +m[2] * 60 + +m[3] + +m[4] / 100);
  assert.ok(starts.every((s, i) => i === 0 || s >= starts[i - 1]));
});

test('từ active tô vàng + phóng 115%, giữ dấu tiếng Việt', () => {
  const out = tmpFile('active.ass');
  generateAssSubtitles(scenes, out, { width: 1080, height: 1920, wordsByScene });
  const text = fs.readFileSync(out, 'utf8');
  assert.match(text, /\{\\c&H00D4FF&\\fscx115\\fscy115\}hãng\{\\r\}/);
  assert.match(text, /Chính/);
});

test('ASS tổng cộng offset theo cảnh (cảnh 2 bắt đầu sau 4s)', () => {
  const out = tmpFile('offset.ass');
  generateAssSubtitles(scenes, out, { width: 1080, height: 1920, wordsByScene });
  assert.match(fs.readFileSync(out, 'utf8'), /Dialogue: 0,0:00:04\.10/);
});

test('generateSceneAss dùng thời gian tương đối theo cảnh', () => {
  const out = tmpFile('scene.ass');
  generateSceneAss(scenes[1], wordsByScene.s2, out, { width: 1080, height: 1920 });
  const text = fs.readFileSync(out, 'utf8');
  assert.equal(countDialogue(text), 4);
  assert.match(text, /Dialogue: 0,0:00:00\.10/);
});

test('chunkWords tách cụm tối đa 3 từ và ngắt sau dấu câu', () => {
  const words = [w('Chỉ', 0, 0.2), w('199.000đ,', 0.2, 1.4), w('chính', 1.5, 1.8), w('hãng', 1.8, 2.1), w('giá', 2.1, 2.3), w('tốt', 2.3, 2.6)];
  const chunks = chunkWords(words, { maxWords: 3, maxSec: 1.4 });
  assert.deepEqual(chunks.map((c) => c.words.map((x) => x.display)), [['Chỉ', '199.000đ,'], ['chính', 'hãng', 'giá'], ['tốt']]);
  assert.equal(chunks[0].start, 0);
  assert.equal(chunks[0].end, 1.4);
});

test('buildSrtFromWords đánh số và cộng offset cảnh', () => {
  const srt = buildSrtFromWords(scenes, wordsByScene);
  assert.match(srt, /^1\n00:00:00,200 --> /);
  assert.match(srt, /00:00:04,100 --> /);
});
