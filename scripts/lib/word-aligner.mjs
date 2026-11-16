// Căn thời gian từng từ cho phụ đề (Gói 7 — Task 10).
// Ta đã biết chính xác lời thoại → mọi công cụ đều: lấy thời gian từ nhận dạng (nếu có) rồi ghép về CHỮ GỐC có dấu.
// 3 lựa chọn (aiCfg.subtitleAlignModel): heuristic-silence (Node thuần, mặc định) | faster-whisper-local | voicestudio-whisperx
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const FFMPEG = process.env.FFMPEG_PATH || 'ffmpeg';
const round3 = (n) => Math.round(n * 1000) / 1000;
const PAUSE_RE = /[.,!?;:…]["')\]]*$/;

export function syllableKey(s) {
  return String(s || '').normalize('NFC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');
}

function spokenKeys(token) {
  return (token.spoken?.length ? token.spoken : [token.display]).map(syllableKey).filter(Boolean);
}

// Chia [speechStart, speechEnd] theo số âm tiết của từng token (tiếng Việt: 1 chữ viết = 1 âm tiết),
// cộng một nhịp ngắt sau dấu câu. Luôn phủ kín và tăng dần.
export function heuristicWordTimes(tokens, { speechStart = 0, speechEnd = 1 } = {}) {
  if (!tokens?.length) return [];
  const parts = tokens.map((t, i) => ({
    syl: spokenKeys(t).length || 1,
    pause: i < tokens.length - 1 && PAUSE_RE.test(t.display) ? 0.35 : 0
  }));
  const total = parts.reduce((s, p) => s + p.syl + p.pause, 0);
  const span = Math.max(0.05, speechEnd - speechStart);
  let cur = speechStart;
  const out = tokens.map((t, i) => {
    const start = cur;
    const end = cur + (span * parts[i].syl) / total;
    cur = end + (span * parts[i].pause) / total;
    return { display: t.display, start: round3(start), end: round3(end), source: 'heuristic' };
  });
  out[out.length - 1].end = round3(speechEnd);
  return out;
}

// Ghép từ nhận dạng (asrWords: [{w,start,end}]) về token kịch bản bằng quy hoạch động (Levenshtein theo âm tiết).
// Token khớp ít nhất 1 âm tiết → 'asr'; token không khớp → nội suy giữa 2 token khớp gần nhất → 'interp'.
// Trả null nếu không khớp được gì (để gọi heuristic).
export function mapAsrToScript(tokens, asrWords) {
  if (!tokens?.length || !asrWords?.length) return null;
  const units = [];
  tokens.forEach((t, ti) => spokenKeys(t).forEach((key) => units.push({ ti, key })));
  const asr = asrWords
    .map((w) => ({ key: syllableKey(w.w ?? w.word), start: Number(w.start), end: Number(w.end) }))
    .filter((w) => w.key && Number.isFinite(w.start) && Number.isFinite(w.end));
  if (!units.length || !asr.length) return null;

  const m = units.length;
  const n = asr.length;
  const dp = Array.from({ length: m + 1 }, (_, i) => {
    const row = new Uint32Array(n + 1);
    row[0] = i;
    return row;
  });
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const sub = dp[i - 1][j - 1] + (units[i - 1].key === asr[j - 1].key ? 0 : 1);
      dp[i][j] = Math.min(sub, dp[i - 1][j] + 1, dp[i][j - 1] + 1);
    }
  }
  const hits = new Map(); // ti -> [asr word...]
  for (let i = m, j = n; i > 0 && j > 0; ) {
    const eq = units[i - 1].key === asr[j - 1].key;
    if (dp[i][j] === dp[i - 1][j - 1] + (eq ? 0 : 1)) {
      if (eq) {
        const ti = units[i - 1].ti;
        if (!hits.has(ti)) hits.set(ti, []);
        hits.get(ti).push(asr[j - 1]);
      }
      i--;
      j--;
    } else if (dp[i][j] === dp[i - 1][j] + 1) i--;
    else j--;
  }
  if (!hits.size) return null;

  const out = tokens.map((t, ti) => {
    const h = hits.get(ti);
    return h
      ? { display: t.display, start: round3(Math.min(...h.map((x) => x.start))), end: round3(Math.max(...h.map((x) => x.end))), source: 'asr' }
      : { display: t.display, start: null, end: null, source: 'interp' };
  });

  // Nội suy từng đoạn token chưa khớp, chia theo số âm tiết
  for (let i = 0; i < out.length; ) {
    if (out[i].source !== 'interp') {
      i++;
      continue;
    }
    let k = i;
    while (k < out.length && out[k].source === 'interp') k++;
    const left = i > 0 ? out[i - 1].end : asr[0].start;
    const right = k < out.length ? out[k].start : asr[n - 1].end;
    const lo = Math.min(left, right);
    const hi = Math.max(left, right, lo + 0.04 * (k - i));
    const seg = heuristicWordTimes(tokens.slice(i, k), { speechStart: lo, speechEnd: hi });
    seg.forEach((s, idx) => Object.assign(out[i + idx], { start: s.start, end: s.end }));
    i = k;
  }
  return out;
}

// Đọc stderr của silencedetect → vùng có tiếng nói
export function parseSilenceDetect(stderr, totalSec) {
  const starts = [...String(stderr).matchAll(/silence_start:\s*(-?[\d.]+)/g)].map((x) => Number(x[1]));
  const ends = [...String(stderr).matchAll(/silence_end:\s*([\d.]+)/g)].map((x) => Number(x[1]));
  let speechStart = 0;
  let speechEnd = totalSec;
  if (starts.length && starts[0] <= 0.05 && ends.length) speechStart = ends[0];
  const lastStart = starts.at(-1);
  const trailingOpen = starts.length > ends.length;
  const trailingAtEof = ends.length && ends.at(-1) >= totalSec - 0.05 && starts.length === ends.length && starts.length > 1;
  if (lastStart !== undefined && lastStart > speechStart && (trailingOpen || trailingAtEof)) speechEnd = lastStart;
  if (!(speechEnd > speechStart)) return { speechStart: 0, speechEnd: totalSec };
  return { speechStart: round3(speechStart), speechEnd: round3(Math.min(speechEnd, totalSec)) };
}

// Vùng tiếng nói đo trên file thô → quy đổi sang dòng thời gian sau atempo, kẹp trong thời lượng cảnh
export function boundsFromRaw({ speechStart, speechEnd }, tempo = 1, durSec = Infinity) {
  const t = Math.max(1, Number(tempo) || 1);
  return { speechStart: round3(Math.min(durSec, speechStart / t)), speechEnd: round3(Math.min(durSec, speechEnd / t)) };
}

export function probeDurationSec(mediaPath) {
  const r = spawnSync('ffprobe', ['-v', 'quiet', '-show_entries', 'format=duration', '-of', 'csv=p=0', mediaPath], {
    encoding: 'utf8',
    windowsHide: true
  });
  return parseFloat(r.stdout) || 0;
}

// Đo trên FILE THÔ (trước khi trộn âm nền sine ≈ −32 dBFS, vốn to hơn ngưỡng −35 dB và che mất khoảng lặng)
export function detectSpeechBounds(wavPath, { noiseDb = -35, minSilence = 0.15, totalSec } = {}) {
  const total = totalSec || probeDurationSec(wavPath) || 1;
  const r = spawnSync(FFMPEG, ['-hide_banner', '-nostats', '-i', wavPath, '-af', `silencedetect=noise=${noiseDb}dB:d=${minSilence}`, '-f', 'null', '-'], {
    encoding: 'utf8',
    windowsHide: true,
    maxBuffer: 8 * 1024 * 1024
  });
  return parseSilenceDetect(r.stderr || '', total);
}

export function findSpeechPython({ root = process.cwd() } = {}) {
  const candidates = [
    process.env.SPEECH_PYTHON,
    path.join(root, 'tools', 'speech', '.venv', 'Scripts', 'python.exe'),
    path.join(root, 'tools', 'speech', '.venv', 'bin', 'python')
  ].filter(Boolean);
  return candidates.find((p) => fs.existsSync(p)) || null;
}

function runFasterWhisper(manifestPath, campaignDir, { root = process.cwd(), model = 'small' } = {}) {
  const py = findSpeechPython({ root });
  if (!py) {
    console.warn('[Căn từ] Chưa có tools/speech/.venv (Task 0) — dùng heuristic.');
    return null;
  }
  const outPath = path.join(campaignDir, 'media', 'audio', 'asr-words.json');
  const r = spawnSync(py, ['-I', path.join(root, 'tools', 'speech', 'align_words.py'), '--manifest', manifestPath, '--base', campaignDir, '--out', outPath, '--model', model], {
    encoding: 'utf8',
    windowsHide: true,
    maxBuffer: 16 * 1024 * 1024
  });
  if (r.status !== 0 || !fs.existsSync(outPath)) {
    console.warn(`[Căn từ] faster-whisper lỗi — dùng heuristic. ${String(r.stderr || '').slice(-300)}`);
    return null;
  }
  const rows = JSON.parse(fs.readFileSync(outPath, 'utf8'));
  return Object.fromEntries(rows.map((x) => [x.sceneId, x.words]));
}

// Điều phối: đọc voice-manifest.json → words.json [{sceneId, source, words:[{display,start,end,source}]}]
export async function alignCampaignWords(campaignDir, { model = 'heuristic-silence', transcribe = null, root = process.cwd() } = {}) {
  const audioDir = path.join(campaignDir, 'media', 'audio');
  const manifestPath = path.join(audioDir, 'voice-manifest.json');
  if (!fs.existsSync(manifestPath)) return [];
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

  let asrByScene = null;
  if (model === 'faster-whisper-local') {
    asrByScene = runFasterWhisper(manifestPath, campaignDir, { root });
  } else if (model === 'voicestudio-whisperx') {
    try {
      const fn = transcribe || (await import('./local-tts-client.mjs')).makeDefaultTranscriber();
      asrByScene = {};
      for (const e of manifest) {
        const r = await fn(path.join(campaignDir, e.wav));
        asrByScene[e.sceneId] = r?.words || null;
      }
    } catch (err) {
      console.warn(`[Căn từ] VoiceStudio · WhisperX lỗi — dùng heuristic. ${err.message}`);
      asrByScene = null;
    }
  }

  const result = manifest.map((e) => {
    let words = asrByScene?.[e.sceneId]?.length ? mapAsrToScript(e.tokens, asrByScene[e.sceneId]) : null;
    let source = words ? model : 'heuristic-silence';
    if (!words) {
      const bounds = Number.isFinite(e.speechStart) && Number.isFinite(e.speechEnd)
        ? { speechStart: e.speechStart, speechEnd: e.speechEnd }
        : detectSpeechBounds(path.join(campaignDir, e.wav), { totalSec: e.speechSec });
      words = heuristicWordTimes(e.tokens, bounds);
    }
    return { sceneId: e.sceneId, source, words };
  });

  const outPath = path.join(audioDir, 'words.json');
  const tmp = `${outPath}.tmp-${process.pid}`;
  fs.writeFileSync(tmp, JSON.stringify(result, null, 2) + '\n', 'utf8');
  fs.renameSync(tmp, outPath);
  return result;
}
