const DIGITS = ['không', 'một', 'hai', 'ba', 'bốn', 'năm', 'sáu', 'bảy', 'tám', 'chín'];
const SCALES = ['', 'nghìn', 'triệu', 'tỷ', 'nghìn tỷ', 'triệu tỷ'];

function readThreeDigits(num, full) {
  const hundreds = Math.floor(num / 100);
  const tens = Math.floor((num % 100) / 10);
  const ones = num % 10;
  const parts = [];

  if (hundreds > 0 || full) {
    parts.push(DIGITS[hundreds], 'trăm');
  }

  if (tens > 1) {
    parts.push(DIGITS[tens], 'mươi');
    if (ones === 1) parts.push('mốt');
    else if (ones === 5) parts.push('lăm');
    else if (ones > 0) parts.push(DIGITS[ones]);
  } else if (tens === 1) {
    parts.push('mười');
    if (ones === 5) parts.push('lăm');
    else if (ones > 0) parts.push(DIGITS[ones]);
  } else {
    if (ones > 0) {
      if (hundreds > 0 || full) parts.push('linh');
      parts.push(DIGITS[ones]);
    }
  }
  return parts;
}

export function numberToViWords(rawIntStr) {
  const clean = String(rawIntStr).replace(/^0+/, '') || '0';
  if (clean === '0') return ['không'];

  const groups = [];
  for (let i = clean.length; i > 0; i -= 3) {
    groups.unshift(parseInt(clean.slice(Math.max(0, i - 3), i), 10));
  }

  const out = [];
  for (let idx = 0; idx < groups.length; idx++) {
    const val = groups[idx];
    const scaleIdx = groups.length - 1 - idx;
    if (val === 0) continue;
    const isFull = idx > 0;
    out.push(...readThreeDigits(val, isFull));
    if (SCALES[scaleIdx]) {
      out.push(...SCALES[scaleIdx].split(' '));
    }
  }
  return out;
}

const UNIT_MAP = {
  đ: ['đồng'],
  vnd: ['đồng'],
  vnđ: ['đồng'],
  k: ['nghìn'],
  '%': ['phần', 'trăm'],
  h: ['giờ'],
  g: ['gam'],
  kg: ['ki', 'lô', 'gam'],
  ml: ['mi', 'li', 'lít'],
  l: ['lít'],
  s: ['giây']
};

export function normalizeViForTts(text) {
  const rawTokens = String(text || '').trim().split(/\s+/).filter(Boolean);
  const tokens = [];
  const allSpoken = [];

  for (const tok of rawTokens) {
    const m = /^([^0-9]*)(\d+(?:[.,]\d+)*)(đ|vnđ|vnd|k|%|h|kg|ml|g|l|s)?([^0-9a-zA-ZÀ-ỹ]*)$/i.exec(tok);
    if (!m) {
      tokens.push({ display: tok, spoken: [tok] });
      allSpoken.push(tok);
      continue;
    }

    const [, prefix, numPart, unitPart = '', suffix = ''] = m;
    const spokenWords = [];
    if (prefix) spokenWords.push(prefix);

    // Nếu dấu chấm/phẩy theo nhóm 3 chữ số (vd 199.000, 1.000.000) -> gộp thành số nguyên
    const isGroupedThousands = /^\d{1,3}(\.\d{3})+$/.test(numPart);
    if (isGroupedThousands) {
      spokenWords.push(...numberToViWords(numPart.replace(/\./g, '')));
    } else if (/[.,]/.test(numPart)) {
      const [intPart, decPart] = numPart.split(/[.,]/);
      spokenWords.push(...numberToViWords(intPart), 'phẩy', ...numberToViWords(decPart));
    } else {
      spokenWords.push(...numberToViWords(numPart));
    }

    const unitWords = UNIT_MAP[unitPart.toLowerCase()];
    if (unitWords) {
      spokenWords.push(...unitWords);
    } else if (unitPart) {
      spokenWords.push(unitPart);
    }
    if (suffix) spokenWords.push(suffix);

    tokens.push({ display: tok, spoken: spokenWords });
    allSpoken.push(...spokenWords);
  }

  return {
    spoken: allSpoken.join(' ').trim(),
    tokens
  };
}
