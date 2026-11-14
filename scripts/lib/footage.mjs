import fs from 'node:fs';
import path from 'node:path';

export const ROOT = process.cwd();
export const VERTICAL_FILTER =
  'scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,setsar=1,fps=30';

export function loadCatalog() {
  const p = path.join(ROOT, 'assets', 'footage', 'catalog.json');
  if (!fs.existsSync(p)) return new Map();
  const data = JSON.parse(fs.readFileSync(p, 'utf8'));
  return new Map((data.clips || []).map((c) => [c.id, c]));
}

// Trả về các cảnh quay thật kèm clip gốc đã tra từ catalog.
export function resolveFootageScenes(campaign, catalog) {
  const errors = [];
  const items = [];
  for (const scene of campaign.scenes) {
    if (scene.type !== 'real-footage') continue;
    const clip = catalog.get(scene.footageId);
    if (!clip) {
      errors.push(`Cảnh "${scene.id}": footageId "${scene.footageId || ''}" không có trong assets/footage/catalog.json`);
      continue;
    }
    const start = Number(scene.trimStartSec ?? 0);
    const end = Number(scene.trimEndSec ?? scene.durationSec);
    if (!(end > start)) {
      errors.push(`Cảnh "${scene.id}": trimEndSec phải lớn hơn trimStartSec`);
      continue;
    }
    if (end > clip.durationSec + 0.05) {
      errors.push(`Cảnh "${scene.id}": trimEndSec (${end}s) vượt thời lượng clip (${clip.durationSec}s)`);
      continue;
    }
    items.push({ scene, clip, start, end, dur: end - start, absPath: path.join(ROOT, clip.filePath) });
  }
  return { items, errors };
}
