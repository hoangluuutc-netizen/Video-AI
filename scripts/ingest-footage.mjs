import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const ROOT = process.cwd();
const FOOTAGE_DIR = path.join(ROOT, 'assets', 'footage');
const CATALOG_PATH = path.join(FOOTAGE_DIR, 'catalog.json');
const VIDEO_EXT = new Set(['.mp4', '.mov', '.m4v']);

function probe(absPath) {
  const out = execFileSync(
    'ffprobe',
    ['-v', 'quiet', '-print_format', 'json', '-show_format', '-show_streams', absPath],
    { encoding: 'utf8' }
  );
  const info = JSON.parse(out);
  const v = (info.streams || []).find((s) => s.codec_type === 'video');
  const a = (info.streams || []).find((s) => s.codec_type === 'audio');
  if (!v) throw new Error('Không có luồng video');
  const [num, den] = String(v.avg_frame_rate || '30/1').split('/').map(Number);
  return {
    durationSec: Math.round(parseFloat(info.format.duration) * 100) / 100,
    width: v.width,
    height: v.height,
    fps: den ? Math.round((num / den) * 100) / 100 : 30,
    hasAudio: Boolean(a)
  };
}

function main() {
  fs.mkdirSync(FOOTAGE_DIR, { recursive: true });
  const catalog = fs.existsSync(CATALOG_PATH)
    ? JSON.parse(fs.readFileSync(CATALOG_PATH, 'utf8'))
    : { clips: [] };
  const existing = new Map((catalog.clips || []).map((c) => [c.filePath, c]));

  const files = fs
    .readdirSync(FOOTAGE_DIR)
    .filter((f) => VIDEO_EXT.has(path.extname(f).toLowerCase()));

  const clips = [];
  for (const file of files) {
    const rel = path.posix.join('assets', 'footage', file);
    const prev = existing.get(rel) || {};
    try {
      const meta = probe(path.join(FOOTAGE_DIR, file));
      clips.push({
        id: prev.id || path.basename(file, path.extname(file)).toLowerCase().replace(/[^a-z0-9]+/g, '-'),
        filePath: rel,
        productId: prev.productId || '',
        tags: prev.tags || [],
        description: prev.description || '',
        usedInCampaigns: prev.usedInCampaigns || [],
        ...meta
      });
      console.log(`OK: ${file} (${meta.durationSec}s, ${meta.width}x${meta.height}, audio=${meta.hasAudio})`);
    } catch (e) {
      console.error(`LỖI ffprobe ${file}: ${e.message}`);
    }
  }

  fs.writeFileSync(CATALOG_PATH, JSON.stringify({ clips }, null, 2) + '\n', 'utf8');
  console.log(`Đã cập nhật assets/footage/catalog.json (${clips.length} clip).`);
}

main();
