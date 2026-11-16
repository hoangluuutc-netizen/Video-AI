import { execFileSync, spawnSync, spawn } from 'node:child_process';

const encoderCache = new Map();
const filterCache = new Map();

export const QSV_ARGS = ['-c:v', 'h264_qsv', '-global_quality', '22', '-pix_fmt', 'nv12'];
export const X264_ARGS = ['-c:v', 'libx264', '-crf', '18', '-preset', 'veryfast', '-pix_fmt', 'yuv420p'];

export function detectVideoEncoder({ ffmpeg = 'ffmpeg', prefer = process.env.VIDEO_ENCODER } = {}) {
  const pref = String(prefer || '').trim().toLowerCase();
  if (pref === 'libx264') {
    return { name: 'libx264', args: [...X264_ARGS] };
  }

  const cacheKey = `${ffmpeg}:${pref || 'auto'}`;
  if (encoderCache.has(cacheKey)) {
    const cached = encoderCache.get(cacheKey);
    return { name: cached.name, args: [...cached.args] };
  }

  let chosen = { name: 'libx264', args: [...X264_ARGS] };
  try {
    const res = spawnSync(
      ffmpeg,
      ['-y', '-v', 'error', '-f', 'lavfi', '-i', 'color=c=black:s=128x128:d=0.1', '-frames:v', '1', '-c:v', 'h264_qsv', '-f', 'null', '-'],
      { encoding: 'utf8', timeout: 8000 }
    );
    if (res.status === 0) {
      chosen = { name: 'h264_qsv', args: [...QSV_ARGS] };
    }
  } catch {
    chosen = { name: 'libx264', args: [...X264_ARGS] };
  }

  encoderCache.set(cacheKey, chosen);
  return { name: chosen.name, args: [...chosen.args] };
}

export function hasFfmpegFilter(name, { ffmpeg = 'ffmpeg' } = {}) {
  const cacheKey = `${ffmpeg}:${name}`;
  if (filterCache.has(cacheKey)) return filterCache.get(cacheKey);

  let found = false;
  try {
    const out = execFileSync(ffmpeg, ['-hide_banner', '-filters'], { encoding: 'utf8', timeout: 5000 });
    found = new RegExp(`\\b${String(name).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`).test(out);
  } catch {
    found = false;
  }
  filterCache.set(cacheKey, found);
  return found;
}

export function execFfmpegAsync(args, { ffmpeg = 'ffmpeg' } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(ffmpeg, args, { stdio: 'inherit' });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg thoát với mã lỗi ${code}`));
    });
  });
}

export async function runWithConcurrency(items, worker, concurrency = 2) {
  const results = new Array(items.length);
  let nextIdx = 0;

  async function runWorker() {
    while (true) {
      const idx = nextIdx++;
      if (idx >= items.length) break;
      results[idx] = await worker(items[idx], idx);
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, Math.max(1, items.length)) }, () => runWorker());
  await Promise.all(workers);
  return results;
}
