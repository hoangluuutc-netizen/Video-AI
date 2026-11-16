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

// ===== Gói 7 — Task 12: X-Ray lời thoại video mẫu =====
// words: [{w,start,end}] (giây, theo video gốc). Hàm thuần — tính tốc độ nói, hook 3s đầu, lời theo từng cảnh cắt.
export function summarizeSpeech(words, shots, durationSec) {
  const ws = (words || []).filter((w) => w && w.w && Number.isFinite(w.start) && Number.isFinite(w.end));
  const join = (arr) => arr.map((w) => String(w.w).trim()).filter(Boolean).join(' ');
  if (!ws.length) {
    return { transcript: '', wordsPerSec: 0, hookText3s: '', speechCoverage: 0, perShot: (shots || []).map((s) => ({ index: s.index, text: '' })) };
  }
  const span = Math.max(0.1, ws[ws.length - 1].end - ws[0].start);
  const spoken = ws.reduce((acc, w) => acc + Math.max(0, w.end - w.start), 0);
  return {
    transcript: join(ws),
    wordsPerSec: round(ws.length / span, 2),
    hookText3s: join(ws.filter((w) => w.start < 3)),
    speechCoverage: round(Math.min(1, spoken / Math.max(0.1, durationSec || span)), 2),
    perShot: (shots || []).map((s) => ({ index: s.index, text: join(ws.filter((w) => w.start >= s.start && w.start < s.end)) }))
  };
}

function extractWav(absPath, outWav, { maxSec = 90, rate = 16000 } = {}) {
  const r = spawnSync(FFMPEG, ['-y', '-v', 'error', '-t', String(maxSec), '-i', absPath, '-vn', '-ac', '1', '-ar', String(rate), outWav], {
    windowsHide: true
  });
  return r.status === 0;
}

// 3 lựa chọn (aiCfg.xrayAudioModel): none | voicestudio-asr | demucs-faster-whisper-local.
// Thiếu công cụ → null kèm gợi ý; không bao giờ làm hỏng phân tích cũ.
export async function analyzeSpeechTrack(absPath, { durationSec, shots, model = 'none', root = process.cwd(), workDir, transcribe = null } = {}) {
  if (!model || model === 'none') return null;
  const { default: fs } = await import('node:fs');
  const { default: path } = await import('node:path');
  const dir = workDir || path.join(root, 'assets', 'footage', 'analysis', '_speech');
  fs.mkdirSync(dir, { recursive: true });

  try {
    if (model === 'voicestudio-asr') {
      const wav = path.join(dir, 'sample-16k.wav');
      if (!extractWav(absPath, wav)) throw new Error('Không trích được âm thanh từ video mẫu.');
      const fn = transcribe || (await import('./local-tts-client.mjs')).makeDefaultTranscriber();
      const r = await fn(wav);
      if (!r?.words?.length) throw new Error('VoiceStudio không trả về timestamp từng từ (words[]).');
      return { tool: model, ...summarizeSpeech(r.words, shots, durationSec), musicBpm: null, words: r.words };
    }
    if (model === 'demucs-faster-whisper-local') {
      const { findSpeechPython } = await import('./word-aligner.mjs');
      const py = findSpeechPython({ root });
      if (!py) throw new Error('Chưa có tools/speech/.venv (Task 0) — chưa chạy được Demucs + faster-whisper.');
      const r = spawnSync(py, ['-I', path.join(root, 'tools', 'speech', 'xray_speech.py'), '--video', absPath, '--out', dir, '--max-sec', '90'], {
        encoding: 'utf8',
        windowsHide: true,
        maxBuffer: 32 * 1024 * 1024
      });
      const speechPath = path.join(dir, 'speech.json');
      if (r.status !== 0 || !fs.existsSync(speechPath)) throw new Error(`xray_speech.py lỗi: ${String(r.stderr || '').slice(-300)}`);
      const speech = JSON.parse(fs.readFileSync(speechPath, 'utf8'));
      const noVocals = path.join(dir, 'no_vocals.wav');
      const music = fs.existsSync(noVocals) ? analyzeAudioSync(noVocals, durationSec) : null;
      return { tool: model, ...summarizeSpeech(speech.words, shots, durationSec), musicBpm: music?.bpm || null, words: speech.words };
    }
    throw new Error(`Lựa chọn X-Ray "${model}" không hợp lệ.`);
  } catch (e) {
    console.warn(`[X-Ray lời thoại] ${e.message}`);
    return null;
  }
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
