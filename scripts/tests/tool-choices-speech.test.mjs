import test from 'node:test';
import assert from 'node:assert/strict';
import { TOOL_CHOICES, normalizeToolChoices } from '../lib/tool-choices.mjs';
import { summarizeSpeech } from '../lib/video-analyzer.mjs';

test('mỗi danh sách lựa chọn có giá trị $0 mặc định đứng đầu', () => {
  assert.equal(TOOL_CHOICES.subtitleAlignModel[0], 'heuristic-silence');
  assert.equal(TOOL_CHOICES.subtitleStyle[0], 'box');
  assert.equal(TOOL_CHOICES.xrayAudioModel[0], 'none');
});

test('normalizeToolChoices nhận giá trị hợp lệ, bỏ giá trị lạ và giữ cấu hình cũ', () => {
  const current = { subtitleAlignModel: 'faster-whisper-local', subtitleStyle: 'box', xrayAudioModel: 'none' };
  assert.deepEqual(
    normalizeToolChoices({ subtitleAlignModel: 'voicestudio-whisperx', subtitleStyle: 'hack', xrayAudioModel: undefined }, current),
    { subtitleAlignModel: 'voicestudio-whisperx', subtitleStyle: 'box', xrayAudioModel: 'none' }
  );
  assert.deepEqual(normalizeToolChoices({}, {}), { subtitleAlignModel: 'heuristic-silence', subtitleStyle: 'box', xrayAudioModel: 'none' });
});

const words10in4s = 'Đừng mua nồi này khi chưa xem ba chi tiết'
  .split(' ')
  .map((w, i) => ({ w, start: i * 0.4, end: i * 0.4 + 0.4 }));
const shots = [
  { index: 1, start: 0, end: 2.0 },
  { index: 2, start: 2.0, end: 4.0 }
];

test('summarizeSpeech: wordsPerSec, hookText3s, transcript', () => {
  const s = summarizeSpeech(words10in4s, shots, 4);
  assert.equal(s.wordsPerSec, 2.5);
  assert.equal(s.hookText3s, 'Đừng mua nồi này khi chưa xem ba'); // "ba" bắt đầu ở 2.8s < 3s
  assert.equal(s.transcript, 'Đừng mua nồi này khi chưa xem ba chi tiết');
  assert.equal(s.speechCoverage, 1);
});

test('summarizeSpeech: perShot gán từ theo thời gian cảnh cắt', () => {
  const s = summarizeSpeech(words10in4s, shots, 4);
  assert.deepEqual(s.perShot.map((p) => p.index), [1, 2]);
  assert.equal(s.perShot[0].text, 'Đừng mua nồi này khi');
  assert.equal(s.perShot[1].text, 'chưa xem ba chi tiết');
});

test('summarizeSpeech: không có lời thoại', () => {
  const s = summarizeSpeech([], shots, 4);
  assert.equal(s.transcript, '');
  assert.equal(s.wordsPerSec, 0);
});
