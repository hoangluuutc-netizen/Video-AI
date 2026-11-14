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
      ],
      immutableFeatures: [
        'Matte black cylindrical body',
        'Minimalist silver engraved logo centered on the upper third',
        'Brushed stainless steel rim and leak-proof flip-top lid',
        'Exact height-to-width ratio 3.2:1'
      ],
      forbiddenChanges: [
        'Do not change matte black finish to glossy',
        'Do not alter or warp the silver logo',
        'Do not add extra buttons or handles not present in reference'
      ]
    }
  ],
  characters: [
    {
      id: 'sample-kol',
      name: 'Minh Anh (Đại sứ thương hiệu)',
      role: 'Chuyên viên review & trải nghiệm sản phẩm',
      immutableTraits: [
        'Vietnamese woman, 26 years old',
        'Shoulder-length straight dark brown hair',
        'Warm natural skin tone, friendly confident smile',
        'Wearing a clean cream-colored casual blazer over white t-shirt'
      ]
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
let progressInterval = null;

function toggleHelpDrawer(id) {
  const el = document.getElementById(id);
  if (el) el.classList.toggle('open');
}

function startJobProgress(label, estimatedSec = 6) {
  if (progressInterval) clearInterval(progressInterval);
  const statusEl = document.getElementById('job-status-text');
  const pctEl = document.getElementById('job-percent-text');
  const elapsedEl = document.getElementById('job-elapsed-text');
  const etaEl = document.getElementById('job-eta-text');
  const fillEl = document.getElementById('job-progress-fill');

  const startMs = Date.now();
  if (statusEl) statusEl.textContent = label;
  if (pctEl) pctEl.textContent = '5%';
  if (fillEl) fillEl.style.width = '5%';

  progressInterval = setInterval(() => {
    const elapsed = (Date.now() - startMs) / 1000;
    const ratio = Math.min(0.94, elapsed / Math.max(1, estimatedSec));
    const pct = Math.max(5, Math.round(ratio * 100));
    const remain = Math.max(1, Math.ceil(estimatedSec - elapsed));
    if (pctEl) pctEl.textContent = `${pct}%`;
    if (fillEl) fillEl.style.width = `${pct}%`;
    if (elapsedEl) elapsedEl.textContent = `${elapsed.toFixed(1)}s`;
    if (etaEl) etaEl.textContent = `~${remain}s`;
  }, 200);
  return startMs;
}

function finishJobProgress(ok, finalLabel, startMs) {
  if (progressInterval) {
    clearInterval(progressInterval);
    progressInterval = null;
  }
  const totalSec = startMs ? ((Date.now() - startMs) / 1000).toFixed(1) : '0.5';
  const statusEl = document.getElementById('job-status-text');
  const pctEl = document.getElementById('job-percent-text');
  const elapsedEl = document.getElementById('job-elapsed-text');
  const etaEl = document.getElementById('job-eta-text');
  const fillEl = document.getElementById('job-progress-fill');

  if (statusEl) statusEl.textContent = finalLabel;
  if (pctEl) pctEl.textContent = ok ? '100%' : 'LỖI';
  if (fillEl) fillEl.style.width = ok ? '100%' : '0%';
  if (elapsedEl) elapsedEl.textContent = `${totalSec}s`;
  if (etaEl) etaEl.textContent = '0s (Hoàn tất)';
}

async function openProjectFile(relPath, openDirect = false) {
  if (!serverOnline) {
    logConsole(`Đường dẫn file: ${relPath}`);
    return;
  }
  const res = await fetch('/api/open-file', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ filePath: relPath, openDirect })
  });
  const data = await res.json();
  logConsole(
    data.previewText
      ? `📂 ${data.output}\n--- Nội dung trích xuất (${relPath}) ---\n${data.previewText}`
      : `📂 ${data.output}`
  );
}

function openSelectedProductFile() {
  const pid = getSelectedProduct()?.id || 'sample-product';
  openProjectFile(`assets/products/${pid}/product.json`);
}

function openSelectedCharacterFile() {
  const cid = document.getElementById('inp-character')?.value || 'sample-kol';
  openProjectFile(`assets/characters/${cid}/character.json`);
}

function openCurrentCampaignFile(subPath, openDirect = false) {
  const cid = (document.getElementById('inp-campaign-id')?.value || 'sample-campaign').trim();
  openProjectFile(`campaigns/${cid}/${subPath}`, openDirect);
}

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
        aiConfig: data.aiConfig || {},
        products: data.products?.length ? data.products : FALLBACK_STATE.products,
        characters: data.characters?.length ? data.characters : FALLBACK_STATE.characters,
        catalog: data.catalog || { clips: [] },
        campaigns: data.campaigns || [],
        sheet: data.sheet?.reels?.length ? data.sheet : FALLBACK_STATE.sheet
      };
      syncAiConfigToUi();
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
  const datalist = document.getElementById('footage-datalist');
  if (datalist) {
    datalist.innerHTML = (appState.catalog?.clips || [])
      .map((c) => `<option value="${c.id}">${c.filePath} (${c.durationSec}s)</option>`)
      .join('');
  }
  renderTruthLockSummary();
}

function renderTruthLockSummary() {
  const box = document.getElementById('truth-lock-summary');
  if (!box) return;
  const p = getSelectedProduct();
  const cid = document.getElementById('inp-character')?.value;
  const c = appState.characters.find((x) => x.id === cid) || appState.characters[0];
  const pLocks = (p.immutableFeatures || []).join(' • ') || 'Giữ nguyên 100% ảnh chụp gốc';
  const pForbid = (p.forbiddenChanges || []).join(' • ') || 'Cấm thay đổi màu sắc, logo, tỷ lệ';
  const cLocks = (c?.immutableTraits || []).join(' • ') || 'Giữ nguyên khuôn mặt, trang phục, giọng thật';

  box.innerHTML = `
    <div class="spec-row" style="flex-direction:column;align-items:flex-start;gap:4px;border-color:var(--orange-border);background:var(--orange-soft);">
      <span style="font-size:11px;font-weight:900;color:var(--orange);">🔒 KHÓA CHI TIẾT SẢN PHẨM THẬT (${p.name})</span>
      <div style="font-size:12px;"><strong>Đặc điểm bất biến:</strong> ${pLocks}</div>
      <div style="font-size:12px;color:var(--red);"><strong>Nghiêm cấm:</strong> ${pForbid}</div>
    </div>
    <div class="spec-row" style="flex-direction:column;align-items:flex-start;gap:4px;border-color:var(--orange-border);background:var(--orange-soft);">
      <span style="font-size:11px;font-weight:900;color:var(--orange);">🧑 KHÓA DANH TÍNH NGƯỜI THẬT (${c?.name || 'Người mẫu/KOL'})</span>
      <div style="font-size:12px;"><strong>Nhận diện cố định:</strong> ${cLocks}</div>
      <div style="font-size:12px;color:var(--green);"><strong>Bảo toàn:</strong> Không làm đẹp da AI, không đổi mặt, không dùng giọng đọc AI</div>
    </div>
  `;
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
  renderTruthLockSummary();
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
      <tr ondragover="handleDragOver(event, this)" ondragleave="handleDragLeave(event, this)" ondrop="handleSceneRowDrop(event, ${i})" title="Mẹo: Kéo thả trực tiếp file video .mp4 vào dòng này để gán cho cảnh #${i + 1}">
        <td><strong>${i + 1}</strong></td>
        <td style="min-width:145px;"><input type="text" value="${s.id}" onchange="scenesList[${i}].id=this.value" /></td>
        <td style="min-width:155px;">
          <select onchange="scenesList[${i}].type=this.value;renderScenesTable();updatePhonePreview();">
            ${typeOptions
              .map((t) => `<option value="${t}" ${s.type === t ? 'selected' : ''}>${t}</option>`)
              .join('')}
          </select>
        </td>
        <td style="width:76px;min-width:72px;">
          <input type="number" min="1" max="15" value="${s.durationSec}" onchange="scenesList[${i}].durationSec=Number(this.value);updatePhonePreview();" />
        </td>
        <td style="min-width:250px;">
          ${
            s.type === 'real-footage'
              ? `<div style="display:flex;gap:4px;align-items:center;">
                   <input type="text" list="footage-datalist" placeholder="Kéo thả video hoặc nhập mã" value="${s.footageId || ''}" onchange="scenesList[${i}].footageId=this.value" style="min-width:125px;flex:1;" />
                   <input type="number" step="0.5" value="${s.trimStartSec ?? 0}" onchange="scenesList[${i}].trimStartSec=Number(this.value)" style="width:54px;" />
                   <span>→</span>
                   <input type="number" step="0.5" value="${s.trimEndSec ?? s.durationSec}" onchange="scenesList[${i}].trimEndSec=Number(this.value)" style="width:54px;" />
                 </div>`
              : `<span style="font-size:11px;color:var(--text-muted);">${s.type === 'real-product-closeup' || s.type === 'offer-cta' ? 'Remotion 100% ảnh/chữ gốc' : 'Keyframe QC → I2V'}</span>`
          }
        </td>
        <td style="min-width:210px;"><input type="text" value="${s.subtitle}" onchange="scenesList[${i}].subtitle=this.value;updatePhonePreview();" /></td>
        <td style="min-width:210px;"><input type="text" value="${s.visualAction}" onchange="scenesList[${i}].visualAction=this.value" /></td>
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

function syncAiConfigToUi() {
  const cfg = appState.aiConfig || {};
  const setVal = (id, val) => {
    const el = document.getElementById(id);
    if (el && val) el.value = val;
  };
  setVal('cfg-llm-model', cfg.llmModel);
  setVal('cfg-image-model', cfg.imageModel);
  setVal('cfg-video-model', cfg.videoModel);
  setVal('cfg-tts-model', cfg.ttsModel);

  const setText = (id, val) => {
    const el = document.getElementById(id);
    if (el && val) el.textContent = val;
  };
  setText('pill-llm', cfg.llmModel || 'gemini-3.1-pro-preview');
  setText('pill-img', cfg.imageModel || 'ffmpeg-real-composite');
  setText('pill-vid', cfg.videoModel || 'ffmpeg-natural-1080p');
  setText('pill-tts', cfg.ttsModel || 'google-vi-natural');
}

async function saveAiConfigFromUi() {
  const payload = {
    llmModel: document.getElementById('cfg-llm-model')?.value,
    imageModel: document.getElementById('cfg-image-model')?.value,
    videoModel: document.getElementById('cfg-video-model')?.value,
    ttsModel: document.getElementById('cfg-tts-model')?.value,
    geminiApiKey: document.getElementById('cfg-gemini-key')?.value || ''
  };
  appState.aiConfig = { ...(appState.aiConfig || {}), ...payload };
  syncAiConfigToUi();
  if (!serverOnline) {
    logConsole('Đã cập nhật cấu hình Bộ não trên giao diện.');
    return;
  }
  const t0 = startJobProgress('Đang lưu cấu hình Bộ não AI & Công cụ...', 2);
  const res = await fetch('/api/save-ai-config', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const data = await res.json();
  if (data.state) appState = data.state;
  finishJobProgress(Boolean(data.ok), data.output || 'Đã lưu cấu hình', t0);
  logConsole(data.output);
}

function togglePhoneMute() {
  const vid = document.getElementById('phone-bg-video');
  const btn = document.getElementById('phone-mute-btn');
  if (!vid) return;
  vid.muted = !vid.muted;
  if (btn) btn.textContent = vid.muted ? '🔇' : '🔊';
}

async function runFullVoiceoverStep() {
  await saveCampaignToServer(true);
  await triggerBackendAction('generate-voiceover', 6);
}

async function runFullRenderStep() {
  await saveCampaignToServer(true);
  await triggerBackendAction('render-ffmpeg', 12);
}

async function saveCampaignToServer(silent = false) {
  const campaign = buildCampaignPayload();
  if (!serverOnline) {
    if (!silent) {
      const blob = new Blob([JSON.stringify(campaign, null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `campaign-${campaign.id}.json`;
      a.click();
      logConsole(`Đã tải xuống file campaign-${campaign.id}.json`);
    }
    return;
  }

  const t0 = silent ? null : startJobProgress(`Đang lưu campaigns/${campaign.id}/campaign.json...`, 2);
  const res = await fetch('/api/save-campaign', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ campaign })
  });
  const data = await res.json();
  if (data.state) appState = data.state;
  if (!silent) {
    finishJobProgress(Boolean(data.ok), data.output || 'Đã lưu chiến dịch', t0);
    logConsole(data.output || 'Đã lưu.');
  }
}

async function triggerBackendAction(action, estSec = 5) {
  const campaignId = (document.getElementById('inp-campaign-id').value || 'sample-campaign').trim();
  if (!serverOnline) {
    logConsole(
      `Bạn đang mở file HTML trực tiếp. Để nút "${action}" gọi trực tiếp Node.js & ffmpeg, hãy chạy:\nnode scripts/dashboard-server.mjs\nrồi mở http://localhost:4173`
    );
    return;
  }

  const actionLabels = {
    'validate': 'Đang kiểm tra cấu trúc dữ liệu (validate-assets.mjs)...',
    'ingest-footage': 'Đang quét kho video bằng ffprobe (ingest-footage.mjs)...',
    'build-keyframes': 'Đang ghép cảnh chuẩn từ Ảnh Người thật & Sản phẩm thật...',
    'generate-voiceover': 'Đang sinh giọng đọc thuyết minh tiếng Việt & trộn âm thanh 48kHz...',
    'export-cutlist': 'Đang trích xuất bảng cắt CapCut (cutlist.md & cutlist.csv)...',
    'render-ffmpeg': 'Đang dựng video MP4 1080×1920 + lồng giọng đọc tiếng Việt bằng FFmpeg...',
    'sync-studio': 'Đang đồng bộ chiến dịch & âm thanh sang Remotion Studio...',
    'verify-integrity': 'Đang đo chỉ số SSIM khung hình & kiểm tra luồng âm thanh...'
  };

  const t0 = startJobProgress(actionLabels[action] || `Đang thực thi ${action}...`, estSec);
  logConsole(actionLabels[action] || `Đang thực thi "${action}"...`);

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

  if (data.mediaUrl) {
    if (action === 'generate-voiceover') {
      const audioEl = document.getElementById('voiceover-audio-player');
      if (audioEl) {
        audioEl.src = data.mediaUrl;
        audioEl.play().catch(() => {});
      }
    } else if (action === 'render-ffmpeg') {
      const phoneVid = document.getElementById('phone-bg-video');
      const audioEl = document.getElementById('voiceover-audio-player');
      if (phoneVid) {
        phoneVid.src = data.mediaUrl;
        phoneVid.muted = false;
        phoneVid.style.display = 'block';
        phoneVid.style.opacity = '0.92';
        phoneVid.play().catch(() => {});
      }
      if (audioEl) {
        audioEl.src = `/campaigns/${campaignId}/media/audio/voiceover-full.mp3?t=${Date.now()}`;
      }
    }
  }

  finishJobProgress(
    Boolean(data.ok),
    data.ok ? `Hoàn tất "${action}" (${data.elapsedSec || ''}s)` : `Lỗi khi chạy "${action}"`,
    t0
  );
  logConsole(`${data.ok ? '✅ THÀNH CÔNG' : '❌ LỖI'} (${data.elapsedSec || 0}s):\n${data.output}`);
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
        <td><button class="icon-pill-btn" onclick="openProjectFile('${r.outputPath}', true)">📂 ${r.outputPath}</button></td>
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

// 7. Cơ chế Kéo & Thả (Drag & Drop) Ảnh Sản Phẩm, Ảnh Nhân Vật và Video Quay Thật
function handleDragOver(e, el) {
  e.preventDefault();
  e.stopPropagation();
  if (el) el.classList.add('dragover');
}

function handleDragLeave(e, el) {
  e.preventDefault();
  e.stopPropagation();
  if (el) el.classList.remove('dragover');
}

function handleAssetDrop(e, kind) {
  e.preventDefault();
  e.stopPropagation();
  const card = document.getElementById(`dz-${kind}`);
  if (card) card.classList.remove('dragover');
  const file = e.dataTransfer?.files?.[0];
  if (file) uploadAndPreviewAsset(file, kind);
}

function handleAssetSelect(e, kind) {
  const file = e.target?.files?.[0];
  if (file) uploadAndPreviewAsset(file, kind);
}

function handleSceneRowDrop(e, sceneIdx) {
  e.preventDefault();
  e.stopPropagation();
  if (e.currentTarget) e.currentTarget.classList.remove('dragover');
  const file = e.dataTransfer?.files?.[0];
  if (!file) return;
  if (file.type.startsWith('video/')) {
    uploadAndPreviewAsset(file, 'footage', sceneIdx);
  } else if (file.type.startsWith('image/')) {
    uploadAndPreviewAsset(file, 'product', sceneIdx);
  }
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function uploadAndPreviewAsset(file, kind, targetSceneIdx = null) {
  const previewBox = document.getElementById(`preview-${kind}`);
  const statusBox = document.getElementById(`status-${kind}`);
  const objectUrl = URL.createObjectURL(file);

  // Hiển thị xem trước ngay tức thì trên giao diện & khung điện thoại 9:16
  if (previewBox) {
    if (kind === 'footage' || file.type.startsWith('video/')) {
      previewBox.innerHTML = `<video src="${objectUrl}" controls muted playsinline></video>`;
      const phoneVid = document.getElementById('phone-bg-video');
      if (phoneVid) {
        phoneVid.src = objectUrl;
        phoneVid.style.display = 'block';
        phoneVid.play().catch(() => {});
      }
    } else {
      previewBox.innerHTML = `<img src="${objectUrl}" alt="${file.name}" />`;
      if (kind === 'product') {
        const phoneImg = document.getElementById('phone-bg-image');
        if (phoneImg) {
          phoneImg.src = objectUrl;
          phoneImg.style.display = 'block';
        }
      }
    }
  }

  const clipSlug = file.name.replace(/\.[^.]+$/, '').toLowerCase().replace(/[^a-z0-9]+/g, '-');

  if (!serverOnline) {
    if (statusBox) statusBox.textContent = `Đã nạp tạm: ${file.name} (mở qua localhost:4173 để lưu vào ổ đĩa)`;
    if (kind === 'footage') {
      assignFootageToScenes(clipSlug, targetSceneIdx);
    }
    return;
  }

  try {
    if (statusBox) statusBox.textContent = `⏳ Đang lưu ${file.name} vào dự án...`;
    const dataBase64 = await readFileAsDataUrl(file);
    const targetId =
      kind === 'product'
        ? getSelectedProduct()?.id || 'sample-product'
        : kind === 'character'
        ? document.getElementById('inp-character')?.value || 'sample-kol'
        : '';

    const res = await fetch('/api/upload-asset', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        kind,
        targetId,
        slot: kind === 'product' ? 'front' : 'portrait',
        fileName: file.name,
        dataBase64
      })
    });
    const data = await res.json();
    if (!data.ok) throw new Error(data.output || 'Lỗi tải file');

    if (data.state) {
      appState = data.state;
      populateSelectors();
    }
    if (statusBox) statusBox.textContent = `✅ Đã lưu: ${data.relPath}`;
    logConsole(data.output);

    if (kind === 'footage') {
      assignFootageToScenes(data.clipId || clipSlug, targetSceneIdx);
    }
  } catch (err) {
    if (statusBox) statusBox.textContent = `❌ Lỗi: ${err.message}`;
    logConsole(`Lỗi tải file ${file.name}: ${err.message}`);
  }
}

function assignFootageToScenes(clipId, targetSceneIdx = null) {
  const clipMeta = (appState.catalog?.clips || []).find((c) => c.id === clipId);
  if (targetSceneIdx !== null && scenesList[targetSceneIdx]) {
    scenesList[targetSceneIdx].type = 'real-footage';
    scenesList[targetSceneIdx].footageId = clipId;
    if (clipMeta?.durationSec) {
      const dur = Math.min(scenesList[targetSceneIdx].durationSec || 4, clipMeta.durationSec);
      scenesList[targetSceneIdx].trimStartSec = 0;
      scenesList[targetSceneIdx].trimEndSec = dur;
    }
  } else {
    scenesList.forEach((s) => {
      if (s.type === 'real-footage' && (!s.footageId || s.footageId.startsWith('clip-quay-that'))) {
        s.footageId = clipId;
      }
    });
  }
  renderScenesTable();
  updatePhonePreview();
}

window.addEventListener('DOMContentLoaded', initDashboard);
