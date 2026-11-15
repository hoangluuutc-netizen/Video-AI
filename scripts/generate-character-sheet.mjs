import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { ROOT } from './lib/footage.mjs';
import { readJson } from './lib/prompt-builder.mjs';

function loadAiKey() {
  const cfgPath = path.join(ROOT, 'assets', 'brand-kit', 'ai-config.json');
  if (fs.existsSync(cfgPath)) {
    const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
    if (cfg.geminiApiKey) return cfg.geminiApiKey;
  }
  return process.env.GEMINI_API_KEY || '';
}

async function tryGeminiCharacterSheet(apiKey, portraitAbs, character, outPng) {
  const mime = portraitAbs.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg';
  const b64 = fs.readFileSync(portraitAbs).toString('base64');
  const traits = (character.immutableTraits || []).join('; ');
  const prompt = `Create a clean 2x2 character turnaround reference sheet on neutral light gray studio background for the exact person in the reference image (${traits}). Top-left: front portrait; Top-right: 3/4 left angle; Bottom-left: 3/4 right angle; Bottom-right: waist-up commercial presenter pose. Keep facial identity, hair, skin tone, and outfit 100% consistent across all 4 panels.`;

  const res = await fetch(
    'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }, { inline_data: { mime_type: mime, data: b64 } }] }],
        generationConfig: { responseModalities: ['IMAGE'] }
      })
    }
  );
  if (!res.ok) throw new Error(`Gemini Image HTTP ${res.status}`);
  const data = await res.json();
  const imgPart = data?.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.data || p.inline_data?.data);
  const raw = imgPart?.inlineData?.data || imgPart?.inline_data?.data;
  if (!raw) throw new Error('Gemini không trả về dữ liệu ảnh.');
  fs.writeFileSync(outPng, Buffer.from(raw, 'base64'));
}

function buildLocalFfmpegSheet(portraitAbs, outPng) {
  execFileSync('ffmpeg', [
    '-y', '-v', 'error',
    '-i', portraitAbs,
    '-filter_complex',
    '[0:v]scale=480:540:force_original_aspect_ratio=increase,crop=480:540[p1];' +
    '[0:v]crop=iw*0.75:ih*0.75:iw*0.125:ih*0.05,scale=480:540:force_original_aspect_ratio=increase,crop=480:540[p2];' +
    '[0:v]hflip,crop=iw*0.8:ih*0.8:iw*0.1:ih*0.05,scale=480:540:force_original_aspect_ratio=increase,crop=480:540[p3];' +
    '[0:v]scale=480:540:force_original_aspect_ratio=increase,crop=480:540,eq=contrast=1.05:brightness=0.02[p4];' +
    '[p1][p2]hstack=inputs=2[top];[p3][p4]hstack=inputs=2[bot];[top][bot]vstack=inputs=2',
    '-frames:v', '1',
    outPng
  ]);
}

export async function generateCharacterSheet(characterId = 'sample-kol') {
  const charDir = path.join(ROOT, 'assets', 'characters', characterId);
  const charPath = path.join(charDir, 'character.json');
  if (!fs.existsSync(charPath)) throw new Error(`Không tìm thấy character.json cho "${characterId}"`);

  const character = readJson(charPath);
  const refs = Object.values(character.referenceImages || {})
    .map((p) => (path.isAbsolute(p) ? p : path.join(ROOT, p)))
    .filter((p) => fs.existsSync(p));
  if (refs.length === 0) throw new Error(`Nhân vật "${characterId}" chưa có ảnh chân dung gốc.`);

  const outPng = path.join(charDir, 'character-sheet-4angles.png');
  const apiKey = loadAiKey();
  let method = 'ffmpeg-4panel';

  if (apiKey) {
    try {
      await tryGeminiCharacterSheet(apiKey, refs[0], character, outPng);
      method = 'gemini-image';
    } catch (e) {
      console.warn(`[Character Sheet fallback] ${e.message}`);
      buildLocalFfmpegSheet(refs[0], outPng);
    }
  } else {
    buildLocalFfmpegSheet(refs[0], outPng);
  }

  character.referenceImages = character.referenceImages || {};
  character.referenceImages.sheet4Angles = path.posix.join('assets', 'characters', characterId, 'character-sheet-4angles.png');
  fs.writeFileSync(charPath, JSON.stringify(character, null, 2) + '\n', 'utf8');
  console.log(`OK [${method}]: Đã tạo Bộ Ảnh Nhân Vật 4 Góc tại ${character.referenceImages.sheet4Angles}`);
  return { outPng, relPath: character.referenceImages.sheet4Angles, method };
}

if (process.argv[1]?.endsWith('generate-character-sheet.mjs')) {
  const charId = process.argv[2] || 'sample-kol';
  generateCharacterSheet(charId).catch((e) => {
    console.error('LỖI tạo Character Sheet:', e.message);
    process.exit(1);
  });
}
