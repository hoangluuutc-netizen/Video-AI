import test from 'node:test';
import assert from 'node:assert/strict';
import { pickCharacterSheetMethod } from '../generate-character-sheet.mjs';

test('pickCharacterSheetMethod: mặc định FFmpeg $0 dù đã có GEMINI_API_KEY', () => {
  assert.equal(pickCharacterSheetMethod({ imageModel: 'ffmpeg-real-composite', hasKey: true }), 'ffmpeg-4panel');
  assert.equal(pickCharacterSheetMethod({ hasKey: true }), 'ffmpeg-4panel');
  assert.equal(pickCharacterSheetMethod({ imageModel: 'fal-flux-kontext', hasKey: true }), 'ffmpeg-4panel');
});

test('pickCharacterSheetMethod: chỉ gọi Gemini khi chọn mô hình gemini-* và có key', () => {
  assert.equal(pickCharacterSheetMethod({ imageModel: 'gemini-nano-banana-2.1', hasKey: true }), 'gemini-image');
  assert.equal(pickCharacterSheetMethod({ imageModel: 'gemini-3-pro-image', hasKey: false }), 'ffmpeg-4panel');
});
