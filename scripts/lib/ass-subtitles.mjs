import fs from 'node:fs';

function fmtAssTime(sec) {
  const totalCs = Math.max(0, Math.round(sec * 100));
  const h = Math.floor(totalCs / 360000);
  const m = Math.floor((totalCs % 360000) / 6000);
  const s = Math.floor((totalCs % 6000) / 100);
  const cs = totalCs % 100;
  return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(cs).padStart(2, '0')}`;
}

// Highlight các từ khóa giá trị cao (số, %, giá tiền, từ khóa chuyển đổi) kiểu TikTok/CapCut
function highlightKeywordsAss(text) {
  const clean = String(text || '').replace(/\r?\n/g, ' ').trim();
  const tokens = clean.split(/\s+/).filter(Boolean);
  const kwPattern = /^(\d+[%đkK]?|\d+[.,]\d+[đkK]?|24h|304|360|flash|sale|ngay|giảm|chính|hãng|miễn|phí|đừng|kiểm|tra|inox)$/i;

  return tokens
    .map((tok) => {
      const bare = tok.replace(/[.,!?:;"'()—-]/g, '');
      if (kwPattern.test(bare)) {
        // Màu vàng rực (#00D4FF trong hệ BGR của ASS) + phóng nhẹ
        return `{\\c&H00D4FF&\\b1}${tok}{\\c&HFFFFFF&\\b1}`;
      }
      return tok;
    })
    .join(' ');
}

export function generateAssSubtitles(scenes, outAssPath, { width = 1080, height = 1920 } = {}) {
  const header = [
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
    '',
    '[Events]',
    'Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text'
  ];

  let offset = 0;
  const events = [];
  for (const sc of scenes) {
    const dur = Math.max(1, Number(sc.durationSec || 4));
    const txt = (sc.subtitle || '').trim();
    if (txt) {
      const styled = highlightKeywordsAss(txt);
      events.push(`Dialogue: 0,${fmtAssTime(offset)},${fmtAssTime(offset + dur)},TikTokHighlight,,0,0,0,,${styled}`);
    }
    offset += dur;
  }

  fs.writeFileSync(outAssPath, header.concat(events).join('\n') + '\n', 'utf8');
  return outAssPath;
}
