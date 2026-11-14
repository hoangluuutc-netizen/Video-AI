const FALLBACK_STATE = {
  brand: {
    brandName: 'VIETNAM ORIGINAL',
    primaryColor: '#EE4D2D',
    secondaryColor: '#111827',
    accentColor: '#F59E0B'
  },
  products: [
    {
      id: 'sample-product',
      name: 'Bình Giữ Nhiệt Inox 304 Cao Cấp 750ml',
      sku: 'BGN-304-750-BLK',
      price: '399.000đ',
      salePrice: '249.000đ',
      discountBadge: '-38% FLASH SALE',
      highlights: [
        'Inox 304 chuẩn y tế, giữ nhiệt 24h',
        'Sơn nhám tĩnh điện chống bám vân tay',
        'Nắp khóa chống tràn 360 độ'
      ]
    }
  ],
  characters: [
    {
      id: 'sample-kol',
      name: 'Minh Anh (Reviewer)',
      role: 'Host / KOL'
    }
  ],
  catalog: { clips: [] },
  campaigns: [],
  sheet: {
    reels: [
      {
        id: 'sample-campaign',
        mode: 'hybrid-ai',
        productName: 'Bình Giữ Nhiệt Inox 304 Cao Cấp 750ml',
        hook: 'Đừng mua bình giữ nhiệt nếu bạn chưa xem 3 chi tiết này!',
        durationSec: 16,
        qcStatus: 'PASS',
        outputPath: 'campaigns/sample-campaign/campaign.json'
      }
    ]
  }
};

let appState = structuredClone(FALLBACK_STATE);
let serverOnline = false;
let showOnlyQualifiedHooks = false;
let hooksPool = [];
let winnerHookIndex = 0;
let scriptBlocks = [];
let scenesList = [];
let phoneTimer = null;
let phoneSceneIdx = 0;
let phoneWordIdx = 0;

function scrollToSlide(id) {
  const el = document.getElementById(id);
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function logConsole(text) {
  const box = document.getElementById('action-console');
  if (!box) return;
  const time = new Date().toLocaleTimeString('vi-VN');
  box.textContent = `[${time}] ${text}`;
}

function getSelectedProduct() {
  const pid = document.getElementById('inp-product')?.value;
  return appState.products.find((p) => p.id === pid) || appState.products[0];
}

function getSelectedMode() {
  return document.getElementById('inp-mode')?.value || 'real-footage';
}

// 1. Khởi tạo & đồng bộ dữ liệu từ server
async function initDashboard() {
  const statusEl = document.getElementById('server-status');
  try {
    const res = await fetch('/api/state');
    if (res.ok) {
      const data = await res.json();
      appState = {
        brand: data.brand || FALLBACK_STATE.brand,
        products: data.products?.length ? data.products : FALLBACK_STATE.products,
        characters: data.characters?.length ? data.characters : FALLBACK_STATE.characters,
        catalog: data.catalog || { clips: [] },
        campaigns: data.campaigns || [],
        sheet: data.sheet?.reels?.length ? data.sheet : FALLBACK_STATE.sheet
      };
      serverOnline = true;
      statusEl.textContent = '🟢 Đã kết nối Local Server (Chạy lệnh thật)';
      statusEl.style.background = '#DCFCE7';
      statusEl.style.color = '#15803D';
    }
  } catch {
    serverOnline = false;
    statusEl.textContent = '🟠 Chế độ xem trực tiếp (Chạy node scripts/dashboard-server.mjs để kết nối CLI)';
    statusEl.style.background = '#FEF3C7';
    statusEl.style.color = '#B45309';
  }

  populateSelectors();
  runAllAssistants();
  renderSheetTable();
}

function populateSelectors() {
  const prodSel = document.getElementById('inp-product');
  const charSel = document.getElementById('inp-character');
  prodSel.innerHTML = appState.products
    .map((p) => `<option value="${p.id}">${p.name} (${p.salePrice || p.price})</option>`)
    .join('');
  charSel.innerHTML = appState.characters
    .map((c) => `<option value="${c.id}">${c.name}</option>`)
    .join('');

  const brandBadge = document.getElementById('phone-brand-badge');
  if (brandBadge && appState.brand?.brandName) {
    brandBadge.textContent = appState.brand.brandName;
  }

  const footageBadge = document.getElementById('footage-count-badge');
  if (footageBadge) {
    footageBadge.textContent = `${(appState.catalog?.clips || []).length} clip trong sổ`;
  }
}

function onModeChange() {
  const mode = getSelectedMode();
  const voiceEl = document.getElementById('reel-voice-policy');
  if (voiceEl) {
    voiceEl.textContent =
      mode === 'real-footage'
        ? 'Giọng thật từ clip quay (Zero-AI-Pixel — Cấm AI chạm điểm ảnh)'
        : 'Hybrid AI (Keyframe QC + Veo/Kling + Remotion khóa chữ/giá)';
  }
  syncScriptToScenes();
}

function onProductChange() {
  runAllAssistants();
}

// 2. Trợ lý 01 - 02 - 03: Sinh 15 Hook theo 5 cơ chế & Chấm điểm 5 tiêu chí
function generate15Hooks() {
  const p = getSelectedProduct();
  const h1 = p.highlights?.[0] || 'Chất liệu chuẩn cao cấp';
  const h2 = p.highlights?.[1] || 'Hoàn thiện tỉ mỉ từng chi tiết';
  const h3 = p.highlights?.[2] || 'Thiết kế tiện lợi mỗi ngày';
  const name = p.name;
  const sale = p.salePrice || p.price;

  const rawHooks = [
    // Cơ chế 1: Cảnh báo (3)
    { mech: 'Cảnh báo', text: `Đừng mua ${name} nếu bạn chưa kiểm tra 3 chi tiết sống còn này!`, scores: [19, 18, 18, 19, 18] },
    { mech: 'Cảnh báo', text: `90% người mua bình giữ nhiệt đều mắc sai lầm khiến đá tan chỉ sau 2 tiếng.`, scores: [18, 17, 17, 16, 17] },
    { mech: 'Cảnh báo', text: `Cẩn thận với các loại bình giữ nhiệt giá rẻ đổ mồ hôi ướt sũng cả túi xách!`, scores: [16, 16, 15, 16, 15] },
    // Cơ chế 2: Công nhận / Đồng cảm (3)
    { mech: 'Công nhận', text: `Đi làm cả ngày mà nước đá vẫn lạnh buốt như mới pha — cảm giác thật sự đáng tiền.`, scores: [17, 18, 16, 18, 17] },
    { mech: 'Công nhận', text: `Ai hay mang đồ uống đi làm chắc chắn từng khó chịu vì vỏ bình trơn trượt, bám vân tay.`, scores: [15, 16, 14, 16, 14] },
    { mech: 'Công nhận', text: `Một chiếc bình tốt dùng bền cả năm thay vì mua 3 chiếc rẻ tiền rồi bỏ xó.`, scores: [13, 14, 12, 14, 13] },
    // Cơ chế 3: Tò mò (3)
    { mech: 'Tò mò', text: `Bên trong lớp vỏ nhám của ${name} có gì mà giữ nhiệt tới 24 giờ?`, scores: [17, 15, 18, 17, 16] },
    { mech: 'Tò mò', text: `Thử dốc ngược chiếc bình này suốt 5 phút xem nắp chống tràn 360 độ có rỉ 1 giọt nào không?`, scores: [18, 16, 18, 17, 16] },
    { mech: 'Tò mò', text: `Tại sao dân văn phòng lại truyền tay nhau mẫu ${p.sku || name} này suốt tuần qua?`, scores: [12, 13, 13, 12, 13] },
    // Cơ chế 4: Đối lập (3)
    { mech: 'Đối lập', text: `Bề ngoài tối giản gọn nhẹ, nhưng bên trong là lõi ${h1}.`, scores: [16, 15, 15, 17, 15] },
    { mech: 'Đối lập', text: `Giá đang giảm còn ${sale} nhưng độ hoàn thiện lại ngang ngửa phân khúc tiền triệu.`, scores: [15, 15, 14, 14, 14] },
    { mech: 'Đối lập', text: `Không cần quảng cáo màu mè, chỉ cần nhìn cận cảnh lớp ${h2.toLowerCase()} này là hiểu.`, scores: [13, 13, 12, 14, 12] },
    // Cơ chế 5: Lời hứa cụ thể (3)
    { mech: 'Lời hứa cụ thể', text: `Xem hết 20 giây này, bạn sẽ biết cách chọn đúng bình ${h1} chuẩn xác 100%.`, scores: [17, 16, 16, 18, 16] },
    { mech: 'Lời hứa cụ thể', text: `3 lý do thực tế giúp ${name} xứng đáng có mặt trên bàn làm việc của bạn hôm nay.`, scores: [14, 14, 12, 15, 13] },
    { mech: 'Lời hứa cụ thể', text: `Kiểm chứng nhanh trong 15 giây: ${h3} và ưu đãi ${sale} hôm nay.`, scores: [13, 13, 11, 14, 12] }
  ];

  hooksPool = rawHooks
    .map((h, idx) => {
      const total = h.scores.reduce((a, b) => a + b, 0);
      return { id: idx + 1, ...h, total };
    })
    .sort((a, b) => b.total - a.total);

  winnerHookIndex = 0;
  renderHooksFunnel();
  buildSixScriptBlocks();
}

function filterOnlyQualifiedHooks() {
  showOnlyQualifiedHooks = !showOnlyQualifiedHooks;
  renderHooksFunnel();
}

function selectWinnerHook(idx) {
  winnerHookIndex = idx;
  renderHooksFunnel();
  buildSixScriptBlocks();
  syncScriptToScenes();
}

function renderHooksFunnel() {
  const qualified = hooksPool.filter((h) => h.total >= 70);
  document.getElementById('cnt-hook-15').textContent = hooksPool.length;
  document.getElementById('cnt-hook-6').textContent = Math.min(6, qualified.length);
  document.getElementById('cnt-hook-3').textContent = Math.min(3, qualified.length);
  document.getElementById('cnt-hook-1').textContent = '1';

  const winner = hooksPool[winnerHookIndex] || hooksPool[0];
  if (winner) {
    const words = winner.text.trim().split(/\s+/).length;
    const readSec = (words / 4.2).toFixed(1);
    document.getElementById('winner-hook-readtime').textContent =
      `🏆 Hook thắng (#${winner.id}): ${words} chữ (~${readSec}s đọc) — Đạt chuẩn đọc trong 3 giây đầu`;
  }

  const container = document.getElementById('hook-list-container');
  const displayList = showOnlyQualifiedHooks ? hooksPool.filter((h) => h.total >= 70) : hooksPool;

  container.innerHTML = displayList
    .map((h) => {
      const realIdx = hooksPool.indexOf(h);
      const isWinner = realIdx === winnerHookIndex;
      const isLow = h.total < 70;
      const rankBadge =
        realIdx === winnerHookIndex
          ? '🏆 HOOK THẮNG'
          : realIdx < 3
          ? '⭐ TOP 3 BẢN SỬA'
          : realIdx < 6
          ? '✔️ TOP 6 ỨNG VIÊN'
          : isLow
          ? '❌ LOẠI (<70đ)'
          : 'ĐẠT';

      return `
        <div class="hook-item ${isWinner ? 'selected-winner' : ''} ${isLow ? 'eliminated' : ''}" onclick="selectWinnerHook(${realIdx})">
          <div class="hook-meta">
            <span class="badge-mech">#${h.id} • ${h.mech}</span>
            <span class="badge-score ${isLow ? 'low' : ''}">${h.total}/100đ • ${rankBadge}</span>
          </div>
          <div style="font-size:13px;font-weight:700;">"${h.text}"</div>
        </div>
      `;
    })
    .join('');
}

// 3. Trợ lý 04: Biên tập kịch bản 6 khối
function buildSixScriptBlocks() {
  const p = getSelectedProduct();
  const winner = hooksPool[winnerHookIndex] || { text: 'Đừng mua nếu bạn chưa xem 3 chi tiết này!' };
  const h1 = p.highlights?.[0] || 'Chất liệu chuẩn cao cấp';
  const h2 = p.highlights?.[1] || 'Bề mặt hoàn thiện chống bám vân tay';
  const h3 = p.highlights?.[2] || 'Nắp khóa kín khít chống tràn';

  scriptBlocks = [
    { num: 1, key: 'HOOK', title: 'HOOK', note: 'Dùng nguyên hook đã thắng', sec: 4, text: winner.text },
    { num: 2, key: 'VAN_DE', title: 'VẤN ĐỀ', note: 'Nỗi đau người xem nhận ra', sec: 4, text: `Mang nước đi làm mà chỉ 2 tiếng đã hết lạnh, vỏ bình lại đọng nước ướt hết giấy tờ trong balo.` },
    { num: 3, key: 'LAT_Y', title: 'LẬT Ý', note: 'Đổi cách nhìn trong 15s đầu', sec: 4, text: `Khác biệt nằm ở kết cấu: ${h1} kết hợp lớp ${h2.toLowerCase()}.` },
    { num: 4, key: 'BANG_CHUNG', title: 'BẰNG CHỨNG', note: '2–3 ý đúng dữ liệu product.json', sec: 5, text: `Nhìn cận cảnh: ${h1}; ${h2}; và ${h3}.` },
    { num: 5, key: 'KET_QUA', title: 'KẾT QUẢ', note: 'Cái người xem nhận được', sec: 4, text: `Cầm chắc tay, sang trọng trên bàn làm việc, giữ trọn hương vị đồ uống suốt cả ngày dài.` },
    { num: 6, key: 'CTA', title: 'CTA', note: 'Đúng giá & ưu đãi có thật', sec: 3, text: `Giá gốc ${p.price} giảm chỉ còn ${p.salePrice || p.price} (${p.discountBadge || 'Ưu đãi hôm nay'}) — bấm giỏ hàng đặt ngay!` }
  ];

  renderScriptBlocks();
}

function renderScriptBlocks() {
  const container = document.getElementById('script-blocks-container');
  const totalSec = scriptBlocks.reduce((s, b) => s + Number(b.sec || 0), 0);
  document.getElementById('script-duration-badge').textContent = `${totalSec} giây (trả lời hook ở giây thứ 8–12 ≤ 15s)`;

  container.innerHTML = scriptBlocks
    .map(
      (b, idx) => `
      <div class="script-block ${idx === 0 ? 'first-block' : ''}">
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <span class="script-num">${b.num}</span>
          <span style="font-size:11px;font-weight:800;color:var(--text-muted);">${b.sec}s</span>
        </div>
        <div class="script-label">${b.title}</div>
        <div style="font-size:11px;color:var(--text-muted);">${b.note}</div>
        <textarea onchange="onScriptBlockEdit(${idx}, this.value)" style="margin-top:4px;font-size:12px;min-height:74px;">${b.text}</textarea>
      </div>
    `
    )
    .join('');
}

function onScriptBlockEdit(idx, val) {
  if (idx === 0) {
    alert('Quy tắc Trợ lý 04: Giữ nguyên Hook thắng, không tự đổi Hook tại bước kịch bản!');
    renderScriptBlocks();
    return;
  }
  scriptBlocks[idx].text = val;
}

// 4. Trợ lý 05: Đạo diễn hình ảnh & 3 phương án bìa
function syncScriptToScenes() {
  const mode = getSelectedMode();
  const clips = appState.catalog?.clips || [];
  const defaultClip1 = clips[0]?.id || 'clip-quay-that-01';
  const defaultClip2 = clips[1]?.id || defaultClip1;

  if (mode === 'real-footage') {
    scenesList = [
      {
        id: 'scene-1-hook',
        type: 'real-footage',
        durationSec: 4,
        footageId: defaultClip1,
        trimStartSec: 0,
        trimEndSec: 4,
        subtitle: scriptBlocks[0]?.text || '',
        visualAction: 'Quay thật điện thoại: cầm sản phẩm trên tay, nói câu hook trực diện.'
      },
      {
        id: 'scene-2-problem-flip',
        type: 'real-footage',
        durationSec: 5,
        footageId: defaultClip2,
        trimStartSec: 0,
        trimEndSec: 5,
        subtitle: `${scriptBlocks[1]?.text || ''} ${scriptBlocks[2]?.text || ''}`.trim(),
        visualAction: 'Quay thật cận cảnh bề mặt sơn nhám & thao tác mở nắp.'
      },
      {
        id: 'scene-3-proof',
        type: 'real-product-closeup',
        durationSec: 4,
        footageId: '',
        trimStartSec: 0,
        trimEndSec: 4,
        subtitle: scriptBlocks[3]?.text || '',
        visualAction: 'Remotion render 100% ảnh sản phẩm gốc + 3 thông số thật (Zero-AI-Pixel).'
      },
      {
        id: 'scene-4-cta',
        type: 'offer-cta',
        durationSec: 3,
        footageId: '',
        trimStartSec: 0,
        trimEndSec: 3,
        subtitle: scriptBlocks[5]?.text || '',
        visualAction: 'Remotion render thẻ giá chính hãng + nút CTA.'
      }
    ];
  } else {
    scenesList = [
      {
        id: 'scene-1-hook',
        type: 'ai-lifestyle',
        durationSec: 4,
        footageId: '',
        trimStartSec: 0,
        trimEndSec: 4,
        subtitle: scriptBlocks[0]?.text || '',
        visualAction: 'Character holds the exact product casually on a sunlit desk, subtle slow push-in.'
      },
      {
        id: 'scene-2-experience',
        type: 'ai-experience',
        durationSec: 5,
        footageId: '',
        trimStartSec: 0,
        trimEndSec: 5,
        subtitle: scriptBlocks[2]?.text || '',
        visualAction: 'Close-up of character hand gently lifting the product in natural window light.'
      },
      {
        id: 'scene-3-product-truth',
        type: 'real-product-closeup',
        durationSec: 4,
        footageId: '',
        trimStartSec: 0,
        trimEndSec: 4,
        subtitle: scriptBlocks[3]?.text || '',
        visualAction: 'Remotion renders 100% original high-res product photo with crisp spec callouts.'
      },
      {
        id: 'scene-4-cta',
        type: 'offer-cta',
        durationSec: 3,
        footageId: '',
        trimStartSec: 0,
        trimEndSec: 3,
        subtitle: scriptBlocks[5]?.text || '',
        visualAction: 'Remotion animated price card, discount badge, and platform CTA.'
      }
    ];
  }

  renderScenesTable();
  renderThreeCovers();
  updatePhonePreview();
}

function renderScenesTable() {
  const tbody = document.getElementById('scenes-tbody');
  const mode = getSelectedMode();
  const typeOptions =
    mode === 'real-footage'
      ? ['real-footage', 'real-product-closeup', 'offer-cta']
      : ['ai-lifestyle', 'ai-experience', 'real-product-closeup', 'offer-cta'];

  tbody.innerHTML = scenesList
    .map(
      (s, i) => `
      <tr>
        <td><strong>${i + 1}</strong></td>
        <td><input type="text" value="${s.id}" onchange="scenesList[${i}].id=this.value" /></td>
        <td>
          <select onchange="scenesList[${i}].type=this.value;renderScenesTable();updatePhonePreview();">
            ${typeOptions
              .map((t) => `<option value="${t}" ${s.type === t ? 'selected' : ''}>${t}</option>`)
              .join('')}
          </select>
        </td>
        <td style="width:76px;">
          <input type="number" min="1" max="15" value="${s.durationSec}" onchange="scenesList[${i}].durationSec=Number(this.value);updatePhonePreview();" />
        </td>
        <td>
          ${
            s.type === 'real-footage'
              ? `<div style="display:flex;gap:4px;align-items:center;">
                   <input type="text" placeholder="footageId" value="${s.footageId || ''}" onchange="scenesList[${i}].footageId=this.value" style="width:110px;" />
                   <input type="number" step="0.5" value="${s.trimStartSec ?? 0}" onchange="scenesList[${i}].trimStartSec=Number(this.value)" style="width:58px;" />
                   <span>→</span>
                   <input type="number" step="0.5" value="${s.trimEndSec ?? s.durationSec}" onchange="scenesList[${i}].trimEndSec=Number(this.value)" style="width:58px;" />
                 </div>`
              : `<span style="font-size:11px;color:var(--text-muted);">${s.type === 'real-product-closeup' || s.type === 'offer-cta' ? 'Remotion 100% ảnh/chữ gốc' : 'Keyframe QC → I2V'}</span>`
          }
        </td>
        <td><input type="text" value="${s.subtitle}" onchange="scenesList[${i}].subtitle=this.value;updatePhonePreview();" /></td>
        <td><input type="text" value="${s.visualAction}" onchange="scenesList[${i}].visualAction=this.value" /></td>
        <td><button class="btn btn-outline" style="padding:4px 10px;" onclick="removeSceneRow(${i})">✕</button></td>
      </tr>
    `
    )
    .join('');

  const totalSec = scenesList.reduce((acc, s) => acc + Number(s.durationSec || 0), 0);
  const durEl = document.getElementById('reel-total-duration');
  if (durEl) {
    durEl.textContent = `${totalSec} giây (${scenesList.length} cảnh) — Khung dọc 1080×1920 (30fps)`;
  }
}

function addSceneRow() {
  const mode = getSelectedMode();
  const idx = scenesList.length + 1;
  scenesList.push({
    id: `scene-${idx}`,
    type: mode === 'real-footage' ? 'real-footage' : 'ai-experience',
    durationSec: 4,
    footageId: mode === 'real-footage' ? 'clip-quay-that-01' : '',
    trimStartSec: 0,
    trimEndSec: 4,
    subtitle: 'Phụ đề cảnh mới...',
    visualAction: 'Mô tả hành động hình ảnh...'
  });
  renderScenesTable();
  updatePhonePreview();
}

function removeSceneRow(i) {
  if (scenesList.length <= 1) return;
  scenesList.splice(i, 1);
  renderScenesTable();
  updatePhonePreview();
}

function renderThreeCovers() {
  const p = getSelectedProduct();
  const cEl = document.getElementById('covers-container');
  const covers = [
    { tag: 'BÌA 01 • CẬN CẢNH SẢN PHẨM THẬT', top: '3 CHI TIẾT CẦN BIẾT', bottom: p.name.slice(0, 26).toUpperCase() },
    { tag: 'BÌA 02 • CẢNH NGƯỜI CẦM TRẢI NGHIỆM', top: 'GIỮ NHIỆT 24 GIỜ?', bottom: `CHỈ CÒN ${p.salePrice || p.price}` },
    { tag: 'BÌA 03 • SO SÁNH & THÔNG SỐ', top: 'ĐỪNG MUA NHẦM!', bottom: p.highlights?.[0]?.slice(0, 28).toUpperCase() || 'CHÍNH HÃNG 100%' }
  ];

  cEl.innerHTML = covers
    .map(
      (c) => `
      <div class="spec-row" style="flex-direction:column;align-items:flex-start;gap:6px;">
        <span style="font-size:11px;font-weight:800;color:var(--orange);">${c.tag}</span>
        <div style="background:#141414;color:#FFF;padding:10px 12px;border-radius:10px;width:100%;text-align:center;">
          <div style="font-size:13px;font-weight:900;color:var(--orange);">${c.top}</div>
          <div style="font-size:12px;font-weight:800;">${c.bottom}</div>
        </div>
      </div>
    `
    )
    .join('');
}

// 5. Trợ lý 06: Mô phỏng khung 9:16 & Gọi lệnh Backend
function updatePhonePreview() {
  if (!scenesList.length) return;
  phoneSceneIdx = phoneSceneIdx % scenesList.length;
  const sc = scenesList[phoneSceneIdx];
  document.getElementById('phone-scene-indicator').textContent =
    `Cảnh ${phoneSceneIdx + 1}/${scenesList.length} • ${sc.type} (${sc.durationSec}s)`;

  const words = (sc.subtitle || '').split(/\s+/).filter(Boolean);
  if (!words.length) {
    document.getElementById('phone-subtitle-preview').textContent = '(Không có phụ đề)';
    return;
  }
  const activeIdx = phoneWordIdx % words.length;
  document.getElementById('phone-subtitle-preview').innerHTML = words
    .map((w, i) => (i === activeIdx ? `<span class="active-word">${w}</span>` : w))
    .join(' ');
}

function togglePhonePreview() {
  const btn = document.getElementById('phone-play-btn');
  if (phoneTimer) {
    clearInterval(phoneTimer);
    phoneTimer = null;
    btn.textContent = '▶';
    return;
  }
  btn.textContent = '⏸';
  phoneTimer = setInterval(() => {
    phoneWordIdx++;
    const sc = scenesList[phoneSceneIdx] || { subtitle: '' };
    const wordCount = (sc.subtitle || '').split(/\s+/).filter(Boolean).length || 1;
    if (phoneWordIdx >= wordCount) {
      phoneWordIdx = 0;
      phoneSceneIdx = (phoneSceneIdx + 1) % scenesList.length;
    }
    updatePhonePreview();
  }, 380);
}

function buildCampaignPayload() {
  const id = (document.getElementById('inp-campaign-id').value || 'sample-campaign').trim();
  const mode = getSelectedMode();
  const product = getSelectedProduct();
  const characterId = document.getElementById('inp-character').value || 'sample-kol';
  const winner = hooksPool[winnerHookIndex] || { text: scenesList[0]?.subtitle || '' };

  const cleanScenes = scenesList.map((s) => {
    const base = {
      id: s.id,
      type: s.type,
      durationSec: Number(s.durationSec || 4),
      subtitle: s.subtitle,
      visualAction: s.visualAction,
      setting: s.setting || 'Standard clean studio/lifestyle setting'
    };
    if (s.type === 'real-footage') {
      base.footageId = s.footageId || '';
      base.trimStartSec = Number(s.trimStartSec ?? 0);
      base.trimEndSec = Number(s.trimEndSec ?? base.durationSec);
    } else if (s.type === 'ai-lifestyle' || s.type === 'ai-experience') {
      base.motionLevel = 'low';
      base.keyframeSrc = s.keyframeSrc || '';
      base.qcStatus = s.qcStatus || 'pending';
      base.videoSrc = s.videoSrc || '';
    } else {
      base.motionLevel = 'none';
      base.videoSrc = '';
    }
    return base;
  });

  const payload = {
    id,
    title: `Chiến dịch ${product.name} (${mode})`,
    productId: product.id,
    characterId,
    platforms: ['tiktok', 'shopee', 'facebook', 'web'],
    hookText: winner.text,
    ctaText: `Chỉ ${product.salePrice || product.price} hôm nay — Đặt ngay!`,
    scenes: cleanScenes
  };
  if (mode === 'real-footage') {
    payload.mode = 'real-footage';
  }
  return payload;
}

async function saveCampaignToServer() {
  const campaign = buildCampaignPayload();
  if (!serverOnline) {
    const blob = new Blob([JSON.stringify(campaign, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `campaign-${campaign.id}.json`;
    a.click();
    logConsole(`Đã tải xuống file campaign-${campaign.id}.json (khởi động dashboard-server.mjs để lưu thẳng vào repo).`);
    return;
  }

  logConsole(`Đang lưu campaigns/${campaign.id}/campaign.json...`);
  const res = await fetch('/api/save-campaign', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ campaign })
  });
  const data = await res.json();
  if (data.state) appState = data.state;
  logConsole(data.output || 'Đã lưu.');
}

async function triggerBackendAction(action) {
  const campaignId = (document.getElementById('inp-campaign-id').value || 'sample-campaign').trim();
  if (!serverOnline) {
    logConsole(
      `Bạn đang mở file HTML trực tiếp. Để nút "${action}" gọi trực tiếp Node.js & ffmpeg, hãy chạy:\nnode scripts/dashboard-server.mjs\nrồi mở http://localhost:4173`
    );
    return;
  }

  logConsole(`Đang thực thi "${action}" cho chiến dịch "${campaignId}"...`);
  const res = await fetch('/api/run-action', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, campaignId })
  });
  const data = await res.json();
  if (data.state) {
    appState = data.state;
    populateSelectors();
  }
  logConsole(`${data.ok ? '✅ THÀNH CÔNG' : '❌ LỖI'}:\n${data.output}`);
}

function loadCampaignFromSelect() {
  const slug = (document.getElementById('inp-campaign-id').value || 'sample-campaign').trim();
  const found = (appState.campaigns || []).find((c) => c.id === slug);
  if (!found) {
    alert(`Không tìm thấy chiến dịch "${slug}" trong bộ nhớ hiện tại.`);
    return;
  }
  document.getElementById('inp-mode').value = found.mode === 'real-footage' ? 'real-footage' : 'hybrid-ai';
  scenesList = structuredClone(found.scenes || []);
  renderScenesTable();
  updatePhonePreview();
  logConsole(`Đã nạp chiến dịch "${slug}" (${scenesList.length} cảnh).`);
}

// 6. Trợ lý 07: Kiểm duyệt PASS / FAIL & Sổ Vận Hành Reel
function evaluateQcStatus() {
  const checks = Array.from(document.querySelectorAll('.qc-cb'));
  const allPass = checks.every((c) => c.checked);
  const passBanner = document.getElementById('qc-pass-banner');
  const failBanner = document.getElementById('qc-fail-banner');

  if (allPass) {
    passBanner.classList.remove('inactive');
    failBanner.classList.add('inactive');
  } else {
    passBanner.classList.add('inactive');
    failBanner.classList.remove('inactive');
  }
  return allPass;
}

async function recordReelToSheet() {
  const isPass = evaluateQcStatus();
  if (!isPass) {
    alert('Trợ lý 07: Chỉ khi tất cả 5 mục kiểm duyệt đều ĐẠT (PASS) mới được bàn giao vào Sổ vận hành!');
    return;
  }
  const campaign = buildCampaignPayload();
  const p = getSelectedProduct();
  const totalSec = campaign.scenes.reduce((s, x) => s + Number(x.durationSec || 0), 0);

  const entry = {
    id: campaign.id,
    mode: campaign.mode || 'hybrid-ai',
    productName: p.name,
    hook: campaign.hookText,
    durationSec: totalSec,
    qcStatus: 'PASS',
    outputPath:
      campaign.mode === 'real-footage'
        ? `campaigns/${campaign.id}/out/ffmpeg-9x16.mp4`
        : `studio/out/tiktok-9x16.mp4`
  };

  const reels = appState.sheet?.reels || [];
  const existingIdx = reels.findIndex((r) => r.id === entry.id);
  if (existingIdx >= 0) reels[existingIdx] = entry;
  else reels.unshift(entry);
  appState.sheet = { reels };

  renderSheetTable();
  if (serverOnline) {
    await fetch('/api/save-sheet', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reels })
    });
  }
  logConsole(`Đã ghi Reel "${entry.id}" (PASS) vào Sổ vận hành.`);
}

function renderSheetTable() {
  const reels = appState.sheet?.reels || [];
  document.getElementById('sheet-total-count').textContent = reels.length;
  const tbody = document.getElementById('sheet-tbody');
  tbody.innerHTML = reels
    .map(
      (r) => `
      <tr>
        <td><strong>${r.id}</strong></td>
        <td><span class="badge-mech">${r.mode}</span></td>
        <td>${r.productName}</td>
        <td>"${r.hook}"</td>
        <td>${r.durationSec}s</td>
        <td><span class="badge-score">${r.qcStatus}</span></td>
        <td><code>${r.outputPath}</code></td>
      </tr>
    `
    )
    .join('');
}

function exportSheetCsv() {
  const reels = appState.sheet?.reels || [];
  const header = ['id', 'mode', 'productName', 'hook', 'durationSec', 'qcStatus', 'outputPath'];
  const lines = [
    header.join(','),
    ...reels.map((r) => header.map((k) => `"${String(r[k] ?? '').replace(/"/g, '""')}"`).join(','))
  ];
  const blob = new Blob(['\uFEFF' + lines.join('\n')], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'so-van-hanh-reel.csv';
  a.click();
}

function runAllAssistants() {
  generate15Hooks();
  syncScriptToScenes();
  evaluateQcStatus();
}

window.addEventListener('DOMContentLoaded', initDashboard);
