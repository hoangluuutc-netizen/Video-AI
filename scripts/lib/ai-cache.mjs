import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const DEFAULT_AI_CACHE_DIR = path.join(process.cwd(), 'assets', 'ai-cache');

export function aiCacheKey({ endpoint = '', payload = {}, imageHashes = [] } = {}) {
  const raw = JSON.stringify({ endpoint, payload, imageHashes });
  return crypto.createHash('sha256').update(raw, 'utf8').digest('hex');
}

export function getCachedAi(key, ext = 'mp4', { cacheDir = DEFAULT_AI_CACHE_DIR } = {}) {
  if (!key) return null;
  const cleanExt = String(ext || 'mp4').replace(/^\./, '');
  const target = path.join(cacheDir, `${key}.${cleanExt}`);
  return fs.existsSync(target) ? target : null;
}

export function putCachedAi(key, srcPath, ext = 'mp4', { cacheDir = DEFAULT_AI_CACHE_DIR } = {}) {
  fs.mkdirSync(cacheDir, { recursive: true });
  const cleanExt = String(ext || 'mp4').replace(/^\./, '');
  const target = path.join(cacheDir, `${key}.${cleanExt}`);
  const tmpPath = `${target}.tmp-${process.pid}-${Date.now()}`;
  fs.copyFileSync(srcPath, tmpPath);
  fs.renameSync(tmpPath, target);
  return target;
}
