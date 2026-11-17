// Mẫu kịch bản mặc định cho Video Ad Studio (script trình duyệt thường — nạp TRƯỚC app.js).
// Nguyên tắc:
//  - Chỉ nói điều có trong product.json (tên, highlights, giá) — không bịa số liệu, chứng thực, cam kết.
//  - Không viết cứng cho 1 loại sản phẩm (bản cũ nói "bình giữ nhiệt / đá tan" cho mọi SKU).
//  - Đủ ngắn để video đọc trọn câu ≤ 30s. Đo thật giọng Google: ~3 âm tiết/giây (chưa tăng tốc).
// Test: scripts/tests/script-template.test.mjs
// eslint-disable-next-line no-var -- biến toàn cục của script thường, app.js dùng trực tiếp
var ScriptTemplate = (function () {
  const SYLLABLES_PER_SEC = 3.0;
  const TAIL_SEC = 0.4;

  // ---- Ước lượng số âm tiết ĐỌC RA (khớp scripts/lib/vi-text-normalize.mjs: "399.000đ" = 7 âm tiết) ----
  function threeDigitsCount(num, full) {
    const hundreds = Math.floor(num / 100);
    const tens = Math.floor((num % 100) / 10);
    const ones = num % 10;
    let n = 0;
    if (hundreds > 0 || full) n += 2;
    if (tens > 1) n += 2 + (ones > 0 ? 1 : 0);
    else if (tens === 1) n += 1 + (ones > 0 ? 1 : 0);
    else if (ones > 0) n += (hundreds > 0 || full ? 1 : 0) + 1;
    return n;
  }

  function numberSyllables(intStr) {
    const clean = String(intStr).replace(/^0+/, '') || '0';
    if (clean === '0') return 1;
    const groups = [];
    for (let i = clean.length; i > 0; i -= 3) groups.unshift(parseInt(clean.slice(Math.max(0, i - 3), i), 10));
    const scaleWords = [0, 1, 1, 1, 2, 2]; // nghìn | triệu | tỷ | nghìn tỷ | triệu tỷ
    let n = 0;
    groups.forEach((val, idx) => {
      if (val === 0) return;
      n += threeDigitsCount(val, idx > 0) + scaleWords[groups.length - 1 - idx];
    });
    return n;
  }

  const UNIT_SYLLABLES = { đ: 1, vnđ: 1, vnd: 1, k: 1, '%': 2, h: 1, g: 1, kg: 3, ml: 3, l: 1, s: 1 };
  const HAS_WORD = /[0-9A-Za-zÀ-ỹđĐ]/;

  function estimateSpokenSyllables(text) {
    let total = 0;
    for (const tok of String(text || '').trim().split(/\s+/).filter(Boolean)) {
      const m = /^([^0-9]*)(\d+(?:[.,]\d+)*)(đ|vnđ|vnd|k|%|h|kg|ml|g|l|s)?([^0-9a-zA-ZÀ-ỹ]*)$/i.exec(tok);
      if (!m) {
        if (HAS_WORD.test(tok)) total += 1;
        continue;
      }
      const [, prefix, numPart, unitPart = ''] = m;
      if (prefix && HAS_WORD.test(prefix)) total += 1;
      if (/^\d{1,3}(\.\d{3})+$/.test(numPart)) total += numberSyllables(numPart.replace(/\./g, ''));
      else if (/[.,]/.test(numPart)) {
        const [a, b] = numPart.split(/[.,]/);
        total += numberSyllables(a) + 1 + numberSyllables(b);
      } else total += numberSyllables(numPart);
      if (unitPart) total += UNIT_SYLLABLES[unitPart.toLowerCase()] || 1;
    }
    return total;
  }

  // Thời lượng đủ đọc ở nhịp tự nhiên, làm tròn lên 0,5s
  function estimateSpeechSec(text, minSec = 2.5) {
    const raw = estimateSpokenSyllables(text) / SYLLABLES_PER_SEC + TAIL_SEC;
    return Math.max(minSec, Math.ceil(raw * 2) / 2);
  }

  // ---- Rút gọn dữ liệu thật để đọc (không thêm chữ nào ngoài product.json) ----
  function shortProductName(p = {}) {
    if (p.shortName) return String(p.shortName).trim();
    const words = String(p.name || 'Sản phẩm').trim().split(/\s+/);
    const cut = words.findIndex((w) => /\d/.test(w));
    return words.slice(0, Math.min(cut === -1 ? words.length : cut, 4)).join(' ') || words[0];
  }

  // Ý chính của 1 highlight = phần trước dấu phẩy / chấm phẩy đầu tiên
  function shortHighlight(h, fallback = '') {
    return String(h || fallback).split(/[,;]/)[0].trim();
  }

  function shortCharacterName(c = {}) {
    return String(c.name || '').split(' (')[0].trim() || 'Mình';
  }

  function productFacts(p = {}) {
    const hl = Array.isArray(p.highlights) ? p.highlights : [];
    return {
      short: shortProductName(p),
      h1: shortHighlight(hl[0], 'chất liệu'),
      h2: shortHighlight(hl[1], 'đường hoàn thiện'),
      h3: shortHighlight(hl[2], 'thiết kế'),
      price: p.price || '',
      sale: p.salePrice || '',
      offer: p.salePrice || p.price || ''
    };
  }

  // ---- 15 hook (5 cơ chế × 3) — giữ nguyên điểm xếp hạng của bộ cũ ----
  function buildHookTemplates(p = {}) {
    const f = productFacts(p);
    const priceHook = f.offer ? `Chỉ ${f.offer}, xem có đáng không nhé!` : `${f.short} có đáng tiền không? Xem nhé!`;
    return [
      { mech: 'Cảnh báo', text: `Đừng mua ${f.short} nếu chưa xem 3 điều này!`, scores: [19, 18, 18, 19, 18] },
      { mech: 'Cảnh báo', text: `Mua ${f.short} mà bỏ qua điều này là phí tiền.`, scores: [18, 17, 17, 16, 17] },
      { mech: 'Cảnh báo', text: `Khoan chốt đơn ${f.short} khi chưa xem video này!`, scores: [16, 16, 15, 16, 15] },

      { mech: 'Công nhận', text: `Ai đang tìm ${f.short} thì xem kỹ nhé.`, scores: [17, 18, 16, 18, 17] },
      { mech: 'Công nhận', text: `Bạn cũng đang phân vân chọn ${f.short}?`, scores: [15, 16, 14, 16, 14] },
      { mech: 'Công nhận', text: `Chọn ${f.short} đừng chỉ nhìn giá, hãy nhìn chi tiết.`, scores: [13, 14, 12, 14, 13] },

      { mech: 'Tò mò', text: `${f.short} này có gì khác? Xem cận cảnh nhé.`, scores: [17, 15, 18, 17, 16] },
      { mech: 'Tò mò', text: `Điều đầu tiên nên kiểm tra khi mua ${f.short}?`, scores: [18, 16, 18, 17, 16] },
      { mech: 'Tò mò', text: `Bí mật của ${f.short} nằm ở chi tiết này.`, scores: [12, 13, 13, 12, 13] },

      { mech: 'Đối lập', text: `Nhìn thì đơn giản, nhưng có ${f.h1}.`, scores: [16, 15, 15, 17, 15] },
      { mech: 'Đối lập', text: priceHook, scores: [15, 15, 14, 14, 14] },
      { mech: 'Đối lập', text: `Không cần nói nhiều, nhìn ${f.h2} là hiểu.`, scores: [13, 13, 12, 14, 12] },

      { mech: 'Lời hứa cụ thể', text: `20 giây để biết ${f.short} có đáng mua không.`, scores: [17, 16, 16, 18, 16] },
      { mech: 'Lời hứa cụ thể', text: `3 lý do nên chọn ${f.short} hôm nay.`, scores: [14, 14, 12, 15, 13] },
      { mech: 'Lời hứa cụ thể', text: `Xem ${f.short} trong 20 giây trước khi chốt đơn.`, scores: [13, 13, 11, 14, 12] }
    ];
  }

  // Hook viết lại theo hướng "làm khác video mẫu"
  function buildAngleHookText(p = {}, angleMode = 'same-as-sample', idea = '') {
    const f = productFacts(p);
    switch (angleMode) {
      case 'new-pain-point':
        return `Sợ mua nhầm hàng kém? Xem ${f.short} này.`;
      case 'reverse-shock':
        return `Đừng vội tin, nhìn tận mắt ${f.h1}.`;
      case 'live-test-proof':
        return `Test thật trong 3 giây: ${f.h3}.`;
      case 'flash-deal-first':
        return f.sale ? `${f.short} đang giảm còn ${f.sale}!` : `${f.short} giá chỉ ${f.offer}!`;
      case 'custom-idea':
        return idea ? `${f.short}: ${idea}` : '';
      default:
        return '';
    }
  }

  // ---- 6 khối kịch bản ----
  function buildScriptBlocks(p = {}, c = {}, winner = {}) {
    const f = productFacts(p);
    const angle = winner.angleMode || 'same-as-sample';
    const isDiff = angle !== 'same-as-sample';
    const hookText = winner.text || `Đừng mua ${f.short} nếu chưa xem 3 điều này!`;

    const vanDe =
      angle === 'new-pain-point'
        ? 'Mua phải hàng kém vừa tốn tiền vừa bực.'
        : angle === 'live-test-proof'
          ? 'Đừng tin lời quảng cáo, cùng test thật nhé.'
          : angle === 'flash-deal-first' && f.sale
            ? 'Hàng tốt thường giá cao, nhưng đang có ưu đãi.'
            : `Chọn ${f.short} dễ nhầm nếu chỉ nhìn ảnh.`;
    const latY = isDiff ? `${shortCharacterName(c)} kiểm chứng ngay: ${f.h1}.` : `Bí quyết là ${f.h1}.`;
    const cta = f.sale ? `Giá ưu đãi ${f.sale}, bấm giỏ hàng ngay!` : `Giá ${f.offer}, bấm giỏ hàng ngay!`;

    const blocks = [
      { num: 1, key: 'HOOK', title: 'HOOK', note: isDiff ? '✨ Theo ý tưởng Hook đã đổi khác mẫu' : '🎯 Theo nhịp mở đầu Video Mẫu', text: hookText },
      { num: 2, key: 'VAN_DE', title: 'VẤN ĐỀ', note: 'Nỗi đau người xem nhận ra', text: vanDe },
      { num: 3, key: 'LAT_Y', title: 'LẬT Ý', note: 'Đổi cách nhìn — đúng highlight thật', text: latY },
      { num: 4, key: 'BANG_CHUNG', title: 'BẰNG CHỨNG', note: '2 ý đúng dữ liệu product.json', text: `Cận cảnh: ${f.h2}, ${f.h3}.` },
      { num: 5, key: 'KET_QUA', title: 'KẾT QUẢ', note: 'Nhắc lại điểm mạnh thật (không dùng trong video 4 cảnh)', text: `Đúng như mô tả: ${f.h1}.` },
      { num: 6, key: 'CTA', title: 'CTA', note: 'Đúng giá có thật', text: cta }
    ];
    return blocks.map((b) => ({ ...b, sec: estimateSpeechSec(b.text) }));
  }

  // Khối nào vào cảnh nào (khớp syncScriptToScenes): quay thật gộp VẤN ĐỀ + LẬT Ý vào cảnh 2
  const SCENE_BLOCKS = {
    'real-footage': [[0], [1, 2], [3], [5]],
    'hybrid-ai': [[0], [2], [3], [5]]
  };
  const SCENE_IDS = {
    'real-footage': ['scene-1-hook', 'scene-2-problem-flip', 'scene-3-proof', 'scene-4-cta'],
    'hybrid-ai': ['scene-1-hook', 'scene-2-experience', 'scene-3-product-truth', 'scene-4-cta']
  };

  // Phụ đề (= lời đọc) + thời lượng của 4 cảnh, suy ra từ 6 khối kịch bản
  function scenePlan(blocks, mode) {
    const key = mode === 'real-footage' ? 'real-footage' : 'hybrid-ai';
    return SCENE_BLOCKS[key].map((idxs, i) => ({
      id: SCENE_IDS[key][i],
      subtitle: idxs.map((b) => blocks[b]?.text || '').join(' ').trim(),
      durationSec: idxs.reduce((s, b) => s + Number(blocks[b]?.sec || 0), 0)
    }));
  }

  function sceneDurations(blocks, mode) {
    return scenePlan(blocks, mode).map((s) => s.durationSec);
  }

  function estimateVideoSec(blocks, mode) {
    return sceneDurations(blocks, mode).reduce((a, b) => a + b, 0);
  }

  return {
    SYLLABLES_PER_SEC,
    estimateSpokenSyllables,
    estimateSpeechSec,
    shortProductName,
    shortHighlight,
    shortCharacterName,
    buildHookTemplates,
    buildAngleHookText,
    buildScriptBlocks,
    scenePlan,
    sceneDurations,
    estimateVideoSec
  };
})();
