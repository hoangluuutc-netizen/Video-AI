import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  listInstalledSkills,
  saveKolCharacter,
  generateKolPersona,
  generateKolScript
} from '../lib/kol-studio.mjs';

test('listInstalledSkills đọc được các skill KOL AI trong .agents/skills', () => {
  const skills = listInstalledSkills();
  const ids = skills.map((s) => s.id);
  assert.ok(ids.includes('kol-persona-architect'));
  assert.ok(ids.includes('kol-visual-consistency'));
  assert.ok(ids.includes('kol-voice-lipsync'));
});

test('saveKolCharacter chuẩn hóa slug ID, bắt buộc immutableTraits và ghi file JSON hợp lệ', () => {
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'kol-save-'));
  assert.throws(() => saveKolCharacter({ name: 'Test', immutableTraits: [] }, { root: tmpRoot }), /immutableTraits/);

  const res = saveKolCharacter({
    name: 'Hà My Review',
    role: 'Skincare KOL',
    immutableTraits: ['Vietnamese woman, 24 years old', 'Warm smile']
  }, { root: tmpRoot });

  assert.equal(res.ok, true);
  assert.equal(res.character.id, 'ha-my-review');
  const savedPath = path.join(tmpRoot, 'assets', 'characters', 'ha-my-review', 'character.json');
  assert.ok(fs.existsSync(savedPath));
});

test('generateKolPersona fallback nội bộ $0 trả về đủ trường bắt buộc', async () => {
  const p = await generateKolPersona({ idea: 'Minh Thư Tech', niche: 'tech' });
  assert.equal(p.engine, 'local-kol-architect ($0)');
  assert.ok(Array.isArray(p.immutableTraits) && p.immutableTraits.length >= 3);
  assert.ok(p.catchphrase.length > 5);
});

test('generateKolScript giữ nhịp thoại hợp lý và sinh veoLipSyncPrompt 60fps', async () => {
  const s = await generateKolScript({
    character: { name: 'Linh Đan', immutableTraits: ['Vietnamese woman, 23yo'], catchphrase: 'Test thật nè!' },
    product: { name: 'Áo Blazer', highlights: ['Form chuẩn', 'Vải mát'] },
    durationSec: 25
  });
  assert.ok(s.wordCount > 10);
  assert.match(s.veoLipSyncPrompt, /60fps/);
  assert.match(s.veoLipSyncPrompt, /Vietnamese woman, 23yo/);
});
