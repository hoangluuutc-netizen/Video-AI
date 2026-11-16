import test from 'node:test';
import assert from 'node:assert/strict';
import { detectVideoEncoder, hasFfmpegFilter } from '../lib/ffmpeg-encoder.mjs';

test('ép libx264 qua prefer', () => {
  const enc = detectVideoEncoder({ prefer: 'libx264' });
  assert.equal(enc.name, 'libx264');
  assert.ok(enc.args.includes('libx264'));
});

test('ffmpeg không tồn tại → fallback libx264', () => {
  const enc = detectVideoEncoder({ ffmpeg: 'khong-co-ffmpeg' });
  assert.equal(enc.name, 'libx264');
});

test('hasFfmpegFilter kiểm tra bộ lọc trên ffmpeg thật', () => {
  assert.equal(hasFfmpegFilter('khong-co-ffmpeg', { ffmpeg: 'khong-co-ffmpeg' }), false);
  assert.equal(hasFfmpegFilter('scale'), true);
});
