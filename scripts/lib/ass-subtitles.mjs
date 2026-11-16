import fs from 'node:fs';

function fmtAssTime(sec) {
  const totalCs = Math.max(0, Math.round(sec * 100));
  const h = Math.floor(totalCs / 360000);
  const m = Math.floor((totalCs % 360000) / 6000);
  const s = Math.floor((totalCs % 6000) / 100);
  const cs = totalCs % 100;
  return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(cs).padStart(2, '0')}`;
}

function fmtSrtTime(sec) {
  const msTotal = Math.max(0, Math.round(sec * 1000));
  const h = Math.floor(msTotal / 3600000);
  const m = Math.floor((msTotal % 3600000) / 60000);
  const s = Math.floor((msTotal % 60000) / 1000);
  const ms = msTotal % 1000;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')},${String(ms).padStart(3, '0')}`;
}

const KW_PATTERN = /^(\d+[%đkK]?|\d+[.,]\d+[đkK]?|24h|304|360|flash|sale|ngay|giảm|chính|hãng|miễn|phí|đừng|kiểm|tra|inox)$/i;
const isKeyword = (tok) => KW_PATTERN.test(String(tok).replace(/[.,!?:;"'()—-]/g, ''));
const assSafe = (s) => String(s || '').replace(/[{}\\]/g, '');

// Highlight các từ khóa giá trị cao (số, %, giá tiền, từ khóa chuyển đổi) kiểu TikTok/CapCut
function highlightKeywordsAss(text) {
  const clean = String(text || '').replace(/\r?\n/g, ' ').trim();
  const tokens = clean.split(/\s+/).filter(Boolean);
  return tokens
    .map((tok) => (isKeyword(tok) ? `{\\c&H00D4FF&\\b1}${tok}{\\c&HFFFFFF&\\b1}` : tok))
    .join(' ');
}

function assHeader(width, height) {
  return [
    '[Script Info]',
    'ScriptType: v4.00+',
    `PlayResX: ${width}`,
    `PlayResY: ${height}`,
    'WrapStyle: 1',
    'ScaledBorderAndShadow: yes',
    '',
    '[V4+ Styles]',
    'Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding',
    'Style: TikTokHighlight,Segoe UI,54,&H00FFFFFF,&H0000D4FF,&H00111111,&H80000000,-1,0,0,0,100,100,0,0,1,4,2,2,56,56,145,1',
    'Style: TikTokWord,Segoe UI,64,&H00FFFFFF,&H0000D4FF,&H00111111,&H96000000,-1,0,0,0,100,100,0,0,1,5,2,2,70,70,360,1',
    '',
    '[Events]',
    'Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text'
  ];
}

// Gom từ thành cụm ngắn kiểu TikTok: tối đa maxWords từ, không dài quá maxSec, ngắt sau dấu câu
export function chunkWords(words, { maxWords = 3, maxSec = 1.4 } = {}) {
  const chunks = [];
  let cur = null;
  for (const w of words || []) {
    const startNew =
      !cur ||
      cur.words.length >= maxWords ||
      w.end - cur.start > maxSec ||
      /[.,!?;:…]$/.test(cur.words[cur.words.length - 1].display);
    if (startNew) {
      cur = { start: w.start, end: w.end, words: [w] };
      chunks.push(cur);
    } else {
      cur.words.push(w);
      cur.end = w.end;
    }
  }
  return chunks;
}

// Mỗi từ 1 Dialogue: hiện cả cụm, từ đang đọc tô vàng + phóng 115%, từ khóa còn lại tô cam
function wordEvents(words, offset) {
  const events = [];
  for (const chunk of chunkWords(words)) {
    chunk.words.forEach((w, i) => {
      const start = offset + w.start;
      const end = offset + (i + 1 < chunk.words.length ? chunk.words[i + 1].start : chunk.end);
      const text = chunk.words
        .map((x, k) => {
          const d = assSafe(x.display);
          if (k === i) return `{\\c&H00D4FF&\\fscx115\\fscy115}${d}{\\r}`;
          return isKeyword(d) ? `{\\c&H1F5AFF&}${d}{\\r}` : d;
        })
        .join(' ');
      events.push(`Dialogue: 0,${fmtAssTime(start)},${fmtAssTime(Math.max(end, start + 0.05))},TikTokWord,,0,0,0,,${text}`);
    });
  }
  return events;
}

// wordsByScene: { [sceneId]: [{display,start,end}] } (thời gian tương đối theo cảnh). Không có → hành vi cũ.
export function generateAssSubtitles(scenes, outAssPath, { width = 1080, height = 1920, wordsByScene = null } = {}) {
  let offset = 0;
  const events = [];
  for (const sc of scenes) {
    const dur = Math.max(1, Number(sc.durationSec || 4));
    const words = wordsByScene?.[sc.id];
    if (words?.length) {
      events.push(...wordEvents(words, offset));
    } else {
      const txt = (sc.subtitle || '').trim();
      if (txt) {
        events.push(`Dialogue: 0,${fmtAssTime(offset)},${fmtAssTime(offset + dur)},TikTokHighlight,,0,0,0,,${highlightKeywordsAss(assSafe(txt))}`);
      }
    }
    offset += dur;
  }
  fs.writeFileSync(outAssPath, assHeader(width, height).concat(events).join('\n') + '\n', 'utf8');
  return outAssPath;
}

// ASS của riêng 1 cảnh (thời gian bắt đầu từ 0) để burn-in ngay trong lượt encode cảnh đó
export function generateSceneAss(scene, words, outPath, { width = 1080, height = 1920 } = {}) {
  fs.writeFileSync(outPath, assHeader(width, height).concat(wordEvents(words || [], 0)).join('\n') + '\n', 'utf8');
  return outPath;
}

// SRT theo cụm từ (thời gian thật) thay cho 1 dòng phủ cả cảnh
export function buildSrtFromWords(scenes, wordsByScene) {
  let offset = 0;
  let n = 0;
  const lines = [];
  for (const sc of scenes) {
    const dur = Math.max(1, Number(sc.durationSec || 4));
    const words = wordsByScene?.[sc.id];
    if (words?.length) {
      for (const c of chunkWords(words)) {
        n++;
        lines.push(`${n}\n${fmtSrtTime(offset + c.start)} --> ${fmtSrtTime(offset + c.end)}\n${c.words.map((w) => w.display).join(' ')}\n`);
      }
    } else if ((sc.subtitle || '').trim()) {
      n++;
      lines.push(`${n}\n${fmtSrtTime(offset)} --> ${fmtSrtTime(offset + dur)}\n${sc.subtitle.trim()}\n`);
    }
    offset += dur;
  }
  return lines.join('\n');
}
