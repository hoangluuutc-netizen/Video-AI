import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const DEFAULT_CACHE_DIR = path.join(process.cwd(), 'assets', 'voice-cache');

function writeAtomic(targetPath, data) {
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  const tmpPath = `${targetPath}.tmp-${process.pid}-${Date.now()}`;
  fs.writeFileSync(tmpPath, data);
  fs.renameSync(tmpPath, targetPath);
}

function readIndex(cacheDir) {
  const idxPath = path.join(cacheDir, 'index.json');
  if (!fs.existsSync(idxPath)) return [];
  try {
    const parsed = JSON.parse(fs.readFileSync(idxPath, 'utf8'));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function voiceCacheKey({ engine = '', model = '', voiceId = '', text = '', refAudioHash = '' } = {}) {
  const payload = JSON.stringify({ engine, model, voiceId, text, refAudioHash });
  return crypto.createHash('sha256').update(payload, 'utf8').digest('hex');
}

export function getCachedVoice(key, { cacheDir = DEFAULT_CACHE_DIR } = {}) {
  if (!key) return null;
  const filePath = path.join(cacheDir, `${key}.wav`);
  return fs.existsSync(filePath) ? filePath : null;
}

// meta: dữ liệu phụ đi kèm (vd. { speechStart, speechEnd, speechSec }) để lần trúng cache vẫn căn từ chính xác
export function getCachedVoiceMeta(key, { cacheDir = DEFAULT_CACHE_DIR } = {}) {
  return readIndex(cacheDir).find((e) => e.key === key)?.meta || null;
}

export function putCachedVoice(key, buffer, { cacheDir = DEFAULT_CACHE_DIR, characterId = '', meta = null } = {}) {
  fs.mkdirSync(cacheDir, { recursive: true });
  const filePath = path.join(cacheDir, `${key}.wav`);
  writeAtomic(filePath, buffer);

  const entries = readIndex(cacheDir).filter((e) => e.key !== key);
  entries.push(meta ? { key, characterId: characterId || '', meta } : { key, characterId: characterId || '' });
  writeAtomic(path.join(cacheDir, 'index.json'), JSON.stringify(entries, null, 2) + '\n');
  return filePath;
}

export function purgeVoiceCache(characterId, { cacheDir = DEFAULT_CACHE_DIR } = {}) {
  if (!characterId || !fs.existsSync(cacheDir)) return 0;
  const entries = readIndex(cacheDir);
  let removed = 0;
  const kept = [];

  for (const entry of entries) {
    if (entry.characterId === characterId) {
      const f = path.join(cacheDir, `${entry.key}.wav`);
      if (fs.existsSync(f)) {
        fs.rmSync(f, { force: true });
        removed++;
      }
    } else {
      kept.push(entry);
    }
  }

  writeAtomic(path.join(cacheDir, 'index.json'), JSON.stringify(kept, null, 2) + '\n');
  return removed;
}
