// Bộ đo cắt cảnh thật & phân tích sóng âm / BPM bằng ffmpeg (chạy đồng bộ, tương thích pipeline hiện tại).
import { spawnSync } from 'node:child_process';

const FFMPEG = process.env.FFMPEG_PATH || 'ffmpeg';

function round(n, d = 2) {
  const f = 10 ** d;
  return Math.round(n * f) / f;
}

export function detectVideoCuts(absPath, { threshold = 0.22, minShotSec = 0.4, durationSec = 0 } = {}) {
  const run = (th) => {
    const r = spawnSync(
      FFMPEG,
      [
        '-hide_banner', '-nostats', '-i', absPath, '-an',
        '-vf', `scale=320:-2,select='gt(scene,${th})',showinfo`,
        '-f', 'null', '-'
      ],
      { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024, windowsHide: true }
    );
    return parseCutsFromStderr(r.stderr || '', minShotSec, durationSec);
  };
  let cuts = run(threshold);
  if (cuts.length === 0 && threshold > 0.16) cuts = run(0.16);
  return cuts;
}

function parseCutsFromStderr(stderr, minShotSec, durationSec) {
  const times = [];
  const re = /pts_time:\s*([0-9.]+)/g;
  let m;
  while ((m = re.exec(stderr))) times.push(Number(m[1]));
  const cuts = [];
  for (const t of times.sort((a, b) => a - b)) {
    const prev = cuts.length ? cuts[cuts.length - 1] : 0;
    if (t - prev >= minShotSec && (!durationSec || durationSec - t >= minShotSec * 0.5)) {
      cuts.push(round(t, 3));
    }
  }
  return cuts;
}

export function buildShots(cuts, durationSec) {
  const bounds = [0, ...cuts, durationSec];
  const shots = [];
  for (let i = 0; i < bounds.length - 1; i++) {
    const start = round(bounds[i], 3);
    const end = round(bounds[i + 1], 3);
    if (end - start <= 0.05) continue;
    shots.push({ index: shots.length + 1, start, end, duration: round(end - start, 2) });
  }
  return shots;
}

export function analyzeAudioSync(absPath, durationSec) {
  const maxSec = Math.min(durationSec || 180, 180);
  const r = spawnSync(
    FFMPEG,
    ['-hide_banner', '-loglevel', 'error', '-t', String(maxSec), '-i', absPath, '-vn', '-ac', '1', '-ar', '8000', '-f', 's16le', '-'],
    { maxBuffer: 32 * 1024 * 1024, windowsHide: true }
  );
  if (r.status !== 0 || !r.stdout?.length) return null;
  const buf = r.stdout;
  const samples = new Int16Array(buf.buffer, buf.byteOffset, Math.floor(buf.length / 2));
  const win = 400; // 50ms @ 8kHz
  const rms = [];
  for (let i = 0; i + win <= samples.length; i += win) {
    let sum = 0;
    for (let j = i; j < i + win; j++) sum += samples[j] * samples[j];
    rms.push(Math.sqrt(sum / win) / 32768);
  }
  if (!rms.length) return null;

  const hop = 0.05;
  const peak = Math.max(...rms) || 1e-9;
  const target = 160;
  const step = Math.max(1, Math.floor(rms.length / target));
  const waveform = [];
  for (let i = 0; i < rms.length; i += step) {
    let mx = 0;
    for (let j = i; j < Math.min(i + step, rms.length); j++) mx = Math.max(mx, rms[j]);
    waveform.push(round(mx / peak, 3));
  }
  const flux = rms.map((v, i) => (i ? Math.max(0, v - rms[i - 1]) : 0));
  const bpm = estimateBpm(flux, hop);
  const mean = rms.reduce((a, b) => a + b, 0) / rms.length;
  const silent = rms.filter((v) => v / peak < 0.06).length;
  return {
    bpm,
    silenceRatio: round(silent / rms.length, 3),
    meanDb: round(20 * Math.log10(mean || 1e-9), 1),
    hopSec: round((rms.length * hop) / waveform.length, 4),
    waveform
  };
}

function estimateBpm(flux, hop) {
  if (flux.length < 40) return null;
  const mean = flux.reduce((a, b) => a + b, 0) / flux.length;
  const x = flux.map((v) => v - mean);
  let energy = 0;
  for (const v of x) energy += v * v;
  if (!energy) return null;
  const minLag = Math.round(60 / 180 / hop);
  const maxLag = Math.round(60 / 70 / hop);
  let best = { lag: 0, score: 0 };
  for (let lag = minLag; lag <= maxLag; lag++) {
    let s = 0;
    for (let i = 0; i + lag < x.length; i++) s += x[i] * x[i + lag];
    if (s > best.score) best = { lag, score: s };
  }
  const confidence = best.score / energy;
  if (!best.lag || confidence < 0.08) return null;
  return { value: Math.round(60 / (best.lag * hop)), confidence: round(confidence, 2) };
}

export function pacingMetrics(shots, durationSec, cuts) {
  const n = shots.length || 1;
  const avg = durationSec / n;
  const cutsIn3s = cuts.filter((t) => t <= 3).length;
  let pace = 'Chậm (kể chuyện)';
  if (avg < 1.2) pace = 'Rất nhanh (viral Gen Z)';
  else if (avg < 2.2) pace = 'Nhanh (chuẩn TikTok bán hàng)';
  else if (avg < 4) pace = 'Vừa (cân bằng trình diễn & thoại)';
  return {
    shotCount: shots.length,
    avgShotSec: round(avg, 2),
    cutsPer10s: round(durationSec ? (cuts.length / durationSec) * 10 : 0, 1),
    cutsInFirst3s: cutsIn3s,
    hookStrength: cutsIn3s >= 2 ? 'Mạnh (≥2 lần cắt trong 3s đầu)' : cutsIn3s === 1 ? 'Trung bình' : 'Yếu (3s đầu không đổi cảnh)',
    pace
  };
}
