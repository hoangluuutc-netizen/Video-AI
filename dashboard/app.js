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

function openSampleAnalysisFile() {
  const sampleClipId =
    document.getElementById('inp-sample-video')?.value ||
    appState.sampleAnalysis?.sampleVideo?.clipId ||
    appState.catalog?.clips?.[0]?.id ||
    'video-m-u';
  openProjectFile(`assets/footage/analysis/${sampleClipId}/analysis.json`);
}

function getSelectedCharacter() {
  const cid = document.getElementById('inp-character')?.value;
  return appState.characters.find((c) => c.id === cid) || appState.characters[0] || { id: 'sample-kol', name: 'Nhân vật của bạn' };
}

function prefersReducedMotion() {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

function scrollToSlide(id) {
  const el = document.getElementById(id);
  if (el) el.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' });
}

// Thanh lệnh dính: đo chiều cao để các mục không bị che khi nhảy tới, và tô sáng bước đang xem.
function setupCommandBar() {
  const bar = document.getElementById('command-bar');
  if (!bar) return;
  const setHeight = () => document.documentElement.style.setProperty('--command-h', `${Math.round(bar.offsetHeight)}px`);
  setHeight();
  if ('ResizeObserver' in window) new ResizeObserver(setHeight).observe(bar);

  const navButtons = [...document.querySelectorAll('.nav-tab[data-target], .nav-action[data-target]')];
  const sections = navButtons
    .map((b) => document.getElementById(b.dataset.target))
    .filter(Boolean);
  if (!('IntersectionObserver' in window) || !sections.length) return;

  const visible = new Map();
  const markActive = () => {
    let bestId = null;
    let bestTop = Infinity;
    for (const [id, top] of visible) {
      if (top < bestTop) {
        bestTop = top;
        bestId = id;
      }
    }
    if (!bestId) return;
    for (const b of navButtons) {
      const on = b.dataset.target === bestId;
      b.classList.toggle('active', on);
      if (on) b.setAttribute('aria-current', 'step');
      else b.removeAttribute('aria-current');
      if (on && b.classList.contains('nav-tab')) {
        const nav = b.parentElement;
        const left = b.offsetLeft - nav.offsetLeft - 16;
        if (left < nav.scrollLeft || b.offsetLeft + b.offsetWidth > nav.scrollLeft + nav.clientWidth) {
          nav.scrollTo({ left: Math.max(0, left), behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
        }
      }
    }
  };
  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (e.isIntersecting) visible.set(e.target.id, e.boundingClientRect.top);
        else visible.delete(e.target.id);
      }
      markActive();
    },
    { rootMargin: `-${bar.offsetHeight + 24}px 0px -55% 0px`, threshold: 0 }
  );
  sections.forEach((s) => io.observe(s));
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
        sheet: data.sheet?.reels?.length ? data.sheet : FALLBACK_STATE.sheet,
        sampleAnalysis: data.sampleAnalysis || null,
        veo3PromptsPack: data.veo3PromptsPack || null
      };
      syncAiConfigToUi();
      serverOnline = true;
      statusEl.innerHTML = '<span aria-hidden="true">🟢</span><span class="server-label">Đã kết nối</span>';
      statusEl.title = 'Đã kết nối Local Server — các nút sẽ chạy lệnh thật trên máy';
      refreshLocalToolsStatus();
      statusEl.style.background = '#DCFCE7';
      statusEl.style.color = '#15803D';
    }
  } catch {
    serverOnline = false;
    statusEl.innerHTML = '<span aria-hidden="true">🟠</span><span class="server-label">Chỉ xem</span>';
    statusEl.title = 'Chưa kết nối Local Server — chạy node scripts/dashboard-server.mjs (hoặc start-dashboard.bat) để các nút chạy lệnh thật';
    statusEl.style.background = '#FEF3C7';
    statusEl.style.color = '#B45309';
  }

  populateSelectors();
  runAllAssistants();

  // Khôi phục chiến dịch đang lưu trên server (nếu có) để giữ nguyên cảnh, góc máy & Muse Style đã chỉnh
  const activeId = (document.getElementById('inp-campaign-id')?.value || 'sample-campaign').trim();
  const savedCamp = (appState.campaigns || []).find((c) => c.id === activeId);
  if (savedCamp && Array.isArray(savedCamp.scenes) && savedCamp.scenes.length > 0) {
    loadCampaignFromSelect(true);
  }
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

  const sampleSel = document.getElementById('inp-sample-video');
  if (sampleSel) {
    const clips = appState.catalog?.clips || [];
    if (clips.length > 0) {
      sampleSel.innerHTML = clips
        .map((c) => `<option value="${c.id}">${c.id} — ${c.filePath} (${c.durationSec}s, ${c.width}×${c.height})</option>`)
        .join('');
    } else {
      sampleSel.innerHTML = `<option value="video-mau-tham-chieu">Video mẫu mặc định (Kéo thả video mẫu mới ở Mục 05)</option>`;
    }
  }

  renderExistingAssetPreviews();
  renderSampleAnalysisCard();
  renderTruthLockSummary();
}

function renderExistingAssetPreviews() {
  const p = getSelectedProduct();
  const c = getSelectedCharacter();
  const clip = (appState.catalog?.clips || [])[0];

  const prodImgRel = Object.values(p?.referenceImages || {}).find(Boolean);
  const charImgRel = Object.values(c?.referenceImages || {}).find(Boolean);

  const prevProd = document.getElementById('preview-product');
  const statProd = document.getElementById('status-product');
  if (prevProd && prodImgRel && !prevProd.querySelector('img')) {
    prevProd.innerHTML = `<img src="/${prodImgRel}" alt="${p.name}" onerror="this.style.display='none'" />`;
    if (statProd) statProd.textContent = `✅ Đang dùng ảnh SP: ${prodImgRel}`;
  }

  const prevChar = document.getElementById('preview-character');
  const statChar = document.getElementById('status-character');
  if (prevChar && charImgRel && !prevChar.querySelector('img')) {
    prevChar.innerHTML = `<img src="/${charImgRel}" alt="${c.name}" onerror="this.style.display='none'" />`;
    if (statChar) statChar.textContent = `✅ Đang dùng ảnh Nhân vật: ${charImgRel}`;
  }

  const prevFoot = document.getElementById('preview-footage');
  const statFoot = document.getElementById('status-footage');
  if (prevFoot && clip?.filePath && !prevFoot.querySelector('video')) {
    prevFoot.innerHTML = `<video src="/${clip.filePath}" controls muted playsinline></video>`;
    if (statFoot) statFoot.textContent = `✅ Video mẫu đang phân tích: ${clip.filePath} (${clip.durationSec}s)`;
  }
}

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);
}

// Gói 7 — T12: lời thoại video mẫu (văn bản bóc băng từ video bên ngoài → luôn escape)
function renderSpeechXray(speech) {
  const btn = `<button class="icon-pill-btn" onclick="runXraySpeech()">🗣️ Bóc băng lời thoại</button>`;
  if (!speech) {
    return `<div class="speech-xray"><span class="speech-empty">Chưa bóc băng lời thoại video mẫu.</span>${btn}</div>`;
  }
  const limit = 2.8;
  const fast = speech.wordsPerSec > limit;
  const transcript = speech.transcript.length > 320 ? `${speech.transcript.slice(0, 320)}…` : speech.transcript;
  return `
    <div class="speech-xray">
      <div class="speech-stats">
        <span class="badge-mech">🗣️ Tốc độ nói: <strong>${escapeHtml(speech.wordsPerSec)} từ/giây</strong>${fast ? ` (nhanh hơn ngưỡng ${limit})` : ''}</span>
        ${speech.musicBpm?.value ? `<span class="badge-mech">🎵 BPM nhạc (đã tách giọng): <strong>${escapeHtml(speech.musicBpm.value)}</strong></span>` : ''}
        <span class="badge-mech">🔧 Công cụ: <strong>${escapeHtml(speech.tool)}</strong></span>
        ${btn}
      </div>
      <p class="speech-hook"><strong>Hook 3s đầu:</strong> ${escapeHtml(speech.hookText3s || '(không có lời)')}</p>
      <p class="speech-transcript">${escapeHtml(transcript)}</p>
    </div>`;
}

async function runXraySpeech() {
  if (!serverOnline) {
    logConsole('Cần Local Server để bóc băng lời thoại.');
    return;
  }
  const clipId = appState.sampleAnalysis?.sampleVideo?.clipId;
  if (!clipId) {
    logConsole('Phân tích video mẫu trước, rồi mới bóc băng lời thoại.');
    return;
  }
  const t0 = startJobProgress('Đang tách nhạc & bóc băng lời thoại video mẫu...', 90);
  try {
    const res = await fetch('/api/xray-speech', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clipId, model: document.getElementById('cfg-xray-audio')?.value })
    });
    const data = await res.json();
    if (data.state) appState.sampleAnalysis = data.state.sampleAnalysis || appState.sampleAnalysis;
    finishJobProgress(Boolean(data.ok), data.output, t0);
    logConsole(data.output);
    if (data.ok) renderSampleAnalysisCard();
  } catch (e) {
    finishJobProgress(false, `Lỗi bóc băng: ${e.message}`, t0);
  }
}

function renderSampleAnalysisCard() {
  const box = document.getElementById('sample-analysis-container');
  if (!box) return;
  const p = getSelectedProduct();
  const c = getSelectedCharacter();
  const ana = appState.sampleAnalysis;

  if (!ana || !ana.sampleVideo) {
    box.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;">
        <div>
          <strong style="color:var(--orange);">🎬 CHƯA PHÂN TÍCH VIDEO MẪU:</strong>
          <span style="font-size:13px;">Hãy bấm nút <strong>"🔍 1. Phân Tích Video Mẫu & Lấy Ý Tưởng"</strong> hoặc kéo thả Video Mẫu vào Mục 05 để hệ thống trích xuất nhịp cảnh và thay thế bằng <strong>${p.name}</strong> + <strong>${c.name}</strong>.</span>
        </div>
        <button class="btn btn-orange" onclick="triggerSampleVideoAnalysis()">🔍 Phân Tích Video Mẫu Ngay</button>
      </div>
    `;
    return;
  }

  const ideaInput = document.getElementById('inp-raw-idea');
  if (ideaInput && (!ideaInput.value || ideaInput.value.startsWith('Đang phân tích') || ideaInput.value.startsWith('Lấy cấu trúc từ Video mẫu'))) {
    ideaInput.value = ana.extractedIdea || '';
  }

  const blueprints = ana.sceneBlueprints || [];
  const xray = ana.xray || null;
  let xrayHtml = '';
  if (xray && (xray.pacing || xray.audio)) {
    const bpmVal = xray.audio?.bpm?.value ? `${xray.audio.bpm.value} BPM` : 'N/A';
    const shotCount = xray.pacing?.shotCount ?? blueprints.length;
    const avgShot = xray.pacing?.avgShotSec ? `${xray.pacing.avgShotSec}s/cảnh` : 'N/A';
    const hookStrength = xray.pacing?.hookStrength || 'Chưa đo';
    const wf = Array.isArray(xray.audio?.waveform) ? xray.audio.waveform : [];
    const durTotal = Math.max(1, Number(ana.sampleVideo?.durationSec || 1));
    const cuts = Array.isArray(xray.cuts) ? xray.cuts : [];

    let svgWave = '';
    if (wf.length > 0) {
      const w = 680;
      const h = 58;
      const step = w / wf.length;
      const bars = wf
        .map((v, i) => {
          const bh = Math.max(2, Math.round(Number(v || 0) * (h - 8)));
          const x = (i * step).toFixed(1);
          const y = Math.round((h - bh) / 2);
          return `<rect x="${x}" y="${y}" width="${Math.max(1.2, step * 0.7).toFixed(1)}" height="${bh}" rx="1" fill="#F59E0B" opacity="0.85" />`;
        })
        .join('');
      const cutLines = cuts
        .map((c) => {
          const cx = ((Number(c) / durTotal) * w).toFixed(1);
          return `<line x1="${cx}" y1="0" x2="${cx}" y2="${h}" stroke="#DC2626" stroke-width="1.5" stroke-dasharray="3,2" />`;
        })
        .join('');
      const hook3x = ((Math.min(3, durTotal) / durTotal) * w).toFixed(1);
      svgWave = `
        <div style="margin-top:8px;background:#0F172A;border-radius:10px;padding:8px 10px;">
          <div style="display:flex;justify-content:space-between;font-size:10px;color:#CBD5E1;margin-bottom:4px;">
            <span>📊 Sóng âm thật (${wf.length} mẫu) • <span style="color:#F87171;">Vạch đỏ: ${cuts.length} điểm cắt cảnh</span></span>
            <span>⏱️ Mốc 3s đầu: ${Math.min(3, durTotal)}s</span>
          </div>
          <svg viewBox="0 0 ${w} ${h}" style="width:100%;height:58px;display:block;">
            <rect x="0" y="0" width="${hook3x}" height="${h}" fill="#22C55E" opacity="0.12" />
            ${bars}
            ${cutLines}
          </svg>
        </div>
      `;
    }

    xrayHtml = `
      <div style="background:#FFFFFF;border:1px solid var(--orange-border);border-radius:12px;padding:10px 12px;">
        <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center;font-size:12px;">
          <span class="badge-mech">🥁 Nhịp nhạc: <strong>${bpmVal}</strong></span>
          <span class="badge-mech">✂️ Cắt cảnh thật: <strong>${shotCount} cảnh</strong></span>
          <span class="badge-mech">⏱️ Nhịp TB: <strong>${avgShot}</strong></span>
          <span class="badge-mech">⚡ Hook 3s đầu: <strong>${hookStrength}</strong></span>
        </div>
        ${svgWave}
        ${renderSpeechXray(xray.speech)}
      </div>
    `;
  }

  let breakdownHtml = '';
  if (ana.breakdown) {
    const bd = ana.breakdown;
    const formulaList = (bd.winningFormula || []).slice(0, 4).map((f) => `<li>${f}</li>`).join('');
    breakdownHtml = `
      <div style="background:#EFF6FF;border:1px solid #93C5FD;border-radius:12px;padding:10px 14px;font-size:12px;">
        <div style="font-weight:800;color:#1D4ED8;margin-bottom:4px;">🧠 Giải phẫu sâu Gemini: Khung ${bd.framework || 'AIDA'} • Hook: ${bd.hook?.type || ''}</div>
        <div style="color:#1E3A8A;margin-bottom:4px;">${bd.summary || ''}</div>
        ${formulaList ? `<ul style="margin:4px 0 0 18px;color:#1E40AF;">${formulaList}</ul>` : ''}
      </div>
    `;
  }

  box.innerHTML = `
    <div style="display:flex;flex-direction:column;gap:12px;">
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;">
        <div>
          <span style="font-size:11px;font-weight:900;color:var(--orange);text-transform:uppercase;">🔍 KẾT QUẢ PHÂN TÍCH VIDEO MẪU & SƠ ĐỒ THAY THẾ BẰNG TÀI SẢN CỦA BẠN</span>
          <div style="font-size:14px;font-weight:800;margin-top:2px;">
            Video mẫu: <code>${ana.sampleVideo.filePath}</code> (${ana.sampleVideo.durationSec}s • ${ana.sampleVideo.width}×${ana.sampleVideo.height} • ${ana.sampleVideo.fps}fps)
            ➔ Thay bằng: <strong style="color:var(--orange);">${p.name}</strong> + <strong style="color:var(--orange);">${c.name}</strong>
          </div>
        </div>
        <button class="icon-pill-btn" onclick="openSampleAnalysisFile()">📂 Mở file \`analysis.json\`</button>
      </div>

      ${xrayHtml}
      ${breakdownHtml}

      <div style="font-size:12px;color:var(--text-dark);background:#FFF5ED;padding:10px 14px;border-radius:10px;border:1px solid var(--orange-border);">
        <strong>📌 Cấu trúc rút ra từ Video mẫu:</strong> ${ana.sampleStructureSummary || ana.extractedIdea}
      </div>

      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:10px;">
        ${blueprints
          .map(
            (bp) => `
            <div style="background:#FFFFFF;border:1px solid var(--border);border-radius:12px;padding:10px;display:flex;flex-direction:column;gap:6px;">
              <div style="display:flex;justify-content:space-between;align-items:center;">
                <span class="badge-mech">Cảnh ${bp.sceneIndex} (${bp.sampleStartSec}s→${bp.sampleEndSec}s)</span>
                <strong style="font-size:11px;color:var(--orange);">${bp.durationSec}s</strong>
              </div>
              ${
                bp.sampleThumbnailUrl
                  ? `<img src="${bp.sampleThumbnailUrl}" alt="Cảnh mẫu ${bp.sceneIndex}" style="width:100%;height:110px;object-fit:cover;border-radius:8px;border:1px solid var(--border);" />`
                  : ''
              }
              <div style="font-size:11px;color:var(--text-muted);"><strong>Mẫu gốc:</strong> ${bp.samplePattern}</div>
              <div style="font-size:11px;color:var(--green);font-weight:700;">🔄 <strong>Thay thế:</strong> ${bp.replacementMethod}</div>
            </div>
          `
          )
          .join('')}
      </div>
    </div>
  `;
}

async function triggerSampleVideoAnalysis() {
  const clipId = document.getElementById('inp-sample-video')?.value || '';
  const productId = getSelectedProduct()?.id || 'sample-product';
  const characterId = getSelectedCharacter()?.id || 'sample-kol';

  if (!serverOnline) {
    logConsole('Hãy mở http://localhost:4173 để chạy phân tích video mẫu bằng ffprobe & ffmpeg.');
    return;
  }

  const t0 = startJobProgress('Đang phân tích Video Mẫu (ffprobe + trích 4 khung hình mẫu + lập phương án thay thế)...', 4);
  const res = await fetch('/api/analyze-sample-video', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ clipId, productId, characterId })
  });
  const data = await res.json();
  if (data.state) {
    appState = data.state;
  }
  if (data.sampleAnalysis) {
    appState.sampleAnalysis = data.sampleAnalysis;
    const ideaInput = document.getElementById('inp-raw-idea');
    if (ideaInput) ideaInput.value = data.sampleAnalysis.extractedIdea;
  }
  renderSampleAnalysisCard();
  runAllAssistants();
  finishJobProgress(Boolean(data.ok), data.ok ? 'Đã phân tích Video Mẫu & cập nhật kịch bản thay thế!' : 'Lỗi phân tích video mẫu', t0);
  logConsole(data.output || 'Đã phân tích xong video mẫu.');
}

function onSampleVideoSelectChange() {
  triggerSampleVideoAnalysis();
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

// 2. Trợ lý 01 - 02 - 03: Sinh 15 Hook theo 5 cơ chế + Bảng Thay Đổi Ý Tưởng Cho Từng Hook (So với Video Mẫu)
const HOOK_ANGLE_MODES = [
  { value: 'same-as-sample', label: '🎯 Giống Video Mẫu (Chỉ thay SP & Nhân vật của mình)' },
  { value: 'new-pain-point', label: '🔄 Đổi Nỗi Đau Mới (Làm khác video mẫu)' },
  { value: 'reverse-shock', label: '🔥 Đảo Ngược Tình Huống / Bóc Sự Thật (Làm khác mẫu)' },
  { value: 'live-test-proof', label: '🧪 Test Thực Tế Ngay 3s Đầu (Làm khác mẫu)' },
  { value: 'flash-deal-first', label: '🎁 Đập Giá Sốc / Deal Hời Đầu Video (Làm khác mẫu)' },
  { value: 'custom-idea', label: '✍️ Tự Nhập Ý Tưởng Mới Hoàn Toàn' }
];

function getDefaultHookIdeaForMode(angleMode, mech) {
  const p = getSelectedProduct();
  const c = getSelectedCharacter();
  const sampleClipId = appState.sampleAnalysis?.sampleVideo?.clipId || 'video-m-u';
  const h1 = p.highlights?.[0] || 'Chất liệu chuẩn cao cấp';
  const h2 = p.highlights?.[1] || 'Hoàn thiện tỉ mỉ từng chi tiết';
  const h3 = p.highlights?.[2] || 'Thiết kế tiện lợi mỗi ngày';
  const sale = p.salePrice || p.price;

  switch (angleMode) {
    case 'new-pain-point':
      return `Làm khác video mẫu: Mở đầu bằng nỗi đau mua phải hàng trôi nổi nhanh hỏng, sau đó ${c.name} đưa ${p.name} (${h1}) ra giải quyết dứt điểm.`;
    case 'reverse-shock':
      return `Làm khác video mẫu: ${c.name} phản biện ngược gây tò mò mạnh ("Đừng vội tin quảng cáo nếu chưa nhìn thấy lõi ${h1} của ${p.name}").`;
    case 'live-test-proof':
      return `Làm khác video mẫu: Không giới thiệu dài dòng, 3 giây đầu ${c.name} test trực tiếp khả năng "${h3}" và "${h2}" của ${p.name} ngay trước ống kính.`;
    case 'flash-deal-first':
      return `Làm khác video mẫu: Đánh thẳng vào ưu đãi ${p.discountBadge || ''} chỉ còn ${sale} cho mẫu ${p.name} chính hãng ngay câu mở đầu.`;
    case 'custom-idea':
      return `Tự thiết kế tình huống riêng cho cơ chế ${mech}: ${c.name} giới thiệu điểm ăn tiền nhất của ${p.name} theo phong cách riêng của shop.`;
    case 'same-as-sample':
    default:
      return `Bám sát nhịp mở đầu của Video Mẫu "${sampleClipId}": Thay thế bằng ${c.name} xuất hiện cùng ${p.name} theo đúng bố cục mẫu.`;
  }
}

function buildHookTextFromIdea(h, p, c) {
  const h1 = p.highlights?.[0] || 'Chất liệu chuẩn cao cấp';
  const h2 = p.highlights?.[1] || 'Hoàn thiện tỉ mỉ từng chi tiết';
  const h3 = p.highlights?.[2] || 'Thiết kế tiện lợi mỗi ngày';
  const sale = p.salePrice || p.price;
  const ideaStr = (h.customIdea || '').trim();

  if (h.angleMode === 'new-pain-point') {
    return {
      text: `Mua nhầm bình kém chất lượng vừa mất tiền vừa bực mình — xem ngay cách ${p.name} khắc phục hoàn toàn bằng ${h1.toLowerCase()}!`,
      visualHookAction: `[Làm khác Video Mẫu - Đổi nỗi đau]: ${c.name} chỉ rõ điểm yếu hàng thường rồi giơ cao ${p.name} nguyên bản.`
    };
  }
  if (h.angleMode === 'reverse-shock') {
    return {
      text: `Đừng tin bất kỳ lời quảng cáo nào cho tới khi bạn nhìn tận mắt lõi ${h1.toLowerCase()} bên trong ${p.name}!`,
      visualHookAction: `[Làm khác Video Mẫu - Đảo ngược tình huống]: Cận cảnh ${c.name} mở nắp ${p.name} khoe trọn cấu tạo thật bên trong.`
    };
  }
  if (h.angleMode === 'live-test-proof') {
    return {
      text: `Thử thách kiểm chứng trực tiếp trong 3 giây: ${h3} và ${h1} trên ${p.name} có thật sự đỉnh như lời đồn?`,
      visualHookAction: `[Làm khác Video Mẫu - Test thực tế 3s đầu]: ${c.name} thực hiện bài test thực tế với ${p.name} ngay giây đầu tiên.`
    };
  }
  if (h.angleMode === 'flash-deal-first') {
    return {
      text: `Sốc thật sự: ${p.name} chuẩn ${h1.toLowerCase()} đang giảm từ ${p.price} xuống chỉ còn ${sale} duy nhất hôm nay!`,
      visualHookAction: `[Làm khác Video Mẫu - Đập giá sốc đầu video]: Hiển thị ${c.name} cầm ${p.name} kèm bảng giá ${sale} nổi bật ngay cảnh 1.`
    };
  }
  if (h.angleMode === 'custom-idea' && ideaStr) {
    return {
      text: `${p.name}: ${ideaStr.replace(/^Làm khác video mẫu:\s*/i, '')}`,
      visualHookAction: `[Ý tưởng riêng khác Video Mẫu]: ${c.name} + ${p.name} thể hiện tình huống: ${ideaStr}`
    };
  }
  return {
    text: h.originalText || h.text,
    visualHookAction: `[Bám sát nhịp Cảnh 1 Video Mẫu]: Thay thế bằng ${c.name} cầm ${p.name} trực diện (giữ 100% chi tiết gốc).`
  };
}

function generate15Hooks() {
  const p = getSelectedProduct();
  const c = getSelectedCharacter();
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
    { mech: 'Tò mò', text: `Bên trong lớp vỏ của ${name} có gì mà giữ nhiệt tới 24 giờ?`, scores: [17, 15, 18, 17, 16] },
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
      const angleMode = 'same-as-sample';
      return {
        id: idx + 1,
        ...h,
        originalText: h.text,
        total,
        angleMode,
        customIdea: getDefaultHookIdeaForMode(angleMode, h.mech),
        visualHookAction: `[Bám sát nhịp Cảnh 1 Video Mẫu]: Thay thế bằng ${c.name} cầm ${p.name} trực diện (giữ 100% chi tiết gốc).`
      };
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

function onHookAngleModeChange(idx, newMode) {
  const h = hooksPool[idx];
  if (!h) return;
  const p = getSelectedProduct();
  const c = getSelectedCharacter();
  h.angleMode = newMode;
  h.customIdea = getDefaultHookIdeaForMode(newMode, h.mech);
  const built = buildHookTextFromIdea(h, p, c);
  h.text = built.text;
  h.visualHookAction = built.visualHookAction;

  renderHooksFunnel();
  if (idx === winnerHookIndex) {
    buildSixScriptBlocks();
    syncScriptToScenes();
  }
}

function onHookCustomIdeaEdit(idx, newIdea) {
  const h = hooksPool[idx];
  if (!h) return;
  h.customIdea = newIdea;
  if (h.angleMode === 'same-as-sample' && newIdea.trim()) {
    h.angleMode = 'custom-idea';
  }
}

function onHookTextDirectEdit(idx, newText) {
  const h = hooksPool[idx];
  if (!h) return;
  h.text = newText;
  renderHooksFunnel();
  if (idx === winnerHookIndex) {
    buildSixScriptBlocks();
    syncScriptToScenes();
  }
}

function regenerateSingleHookFromIdea(idx) {
  const h = hooksPool[idx];
  if (!h) return;
  const p = getSelectedProduct();
  const c = getSelectedCharacter();
  const built = buildHookTextFromIdea(h, p, c);
  h.text = built.text;
  h.visualHookAction = built.visualHookAction;
  winnerHookIndex = idx;
  renderHooksFunnel();
  buildSixScriptBlocks();
  syncScriptToScenes();
  logConsole(`Đã tạo lại Hook #${h.id} theo ý tưởng "${h.angleMode}" và áp dụng xuống Kịch bản & Phân cảnh!`);
}

function resetAllHooksToSampleIdea() {
  const p = getSelectedProduct();
  const c = getSelectedCharacter();
  hooksPool.forEach((h) => {
    h.angleMode = 'same-as-sample';
    h.customIdea = getDefaultHookIdeaForMode('same-as-sample', h.mech);
    h.text = h.originalText || h.text;
    h.visualHookAction = `[Bám sát nhịp Cảnh 1 Video Mẫu]: Thay thế bằng ${c.name} cầm ${p.name} trực diện (giữ 100% chi tiết gốc).`;
  });
  renderHooksFunnel();
  buildSixScriptBlocks();
  syncScriptToScenes();
  logConsole('Đã đặt lại toàn bộ 15 Hook bám sát theo cấu trúc Video Mẫu.');
}

function regenerateAllCustomizedHooks() {
  const p = getSelectedProduct();
  const c = getSelectedCharacter();
  hooksPool.forEach((h) => {
    const built = buildHookTextFromIdea(h, p, c);
    h.text = built.text;
    h.visualHookAction = built.visualHookAction;
  });
  renderHooksFunnel();
  buildSixScriptBlocks();
  syncScriptToScenes();
  logConsole('Đã sinh lại toàn bộ các Hook theo bảng ý tưởng tùy chỉnh và đồng bộ xuống kịch bản!');
}

function applyWinnerHookIdeaToScriptAndScenes() {
  buildSixScriptBlocks();
  syncScriptToScenes();
  scrollToSlide('slide-04');
  logConsole('Đã áp dụng ý tưởng của Hook Thắng xuống 6 khối kịch bản (Mục 04) và Bảng phân cảnh thay thế (Mục 05).');
}

function renderHookIdeaTable() {
  const tbody = document.getElementById('hook-idea-table-tbody');
  if (!tbody) return;
  const displayList = showOnlyQualifiedHooks ? hooksPool.filter((h) => h.total >= 70) : hooksPool.slice(0, 8);

  tbody.innerHTML = displayList
    .map((h) => {
      const realIdx = hooksPool.indexOf(h);
      const isWinner = realIdx === winnerHookIndex;
      const isDifferent = h.angleMode && h.angleMode !== 'same-as-sample';
      return `
        <tr style="${isWinner ? 'background:#FFF5ED;' : ''}">
          <td style="min-width:130px;">
            <div style="font-weight:900;color:${isWinner ? 'var(--orange)' : 'var(--text-dark)'};">
              ${isWinner ? '🏆 ' : ''}#${h.id} • ${h.mech}
            </div>
            <div style="font-size:11px;color:var(--text-muted);margin-top:2px;">Điểm QC: <strong>${h.total}/100đ</strong></div>
            <span class="badge-mech" style="display:inline-block;margin-top:4px;background:${isDifferent ? '#FEF3C7' : '#DCFCE7'};color:${isDifferent ? '#B45309' : '#15803D'};">
              ${isDifferent ? '✨ Khác Video Mẫu' : '🎯 Giống Video Mẫu'}
            </span>
          </td>
          <td style="min-width:210px;">
            <select onchange="onHookAngleModeChange(${realIdx}, this.value)">
              ${HOOK_ANGLE_MODES.map(
                (m) => `<option value="${m.value}" ${h.angleMode === m.value ? 'selected' : ''}>${m.label}</option>`
              ).join('')}
            </select>
          </td>
          <td style="min-width:240px;">
            <textarea style="min-height:58px;font-size:12px;" onchange="onHookCustomIdeaEdit(${realIdx}, this.value)" placeholder="Nhập ý tưởng/tình huống riêng nếu muốn làm khác video mẫu...">${h.customIdea || ''}</textarea>
          </td>
          <td style="min-width:250px;">
            <textarea style="min-height:58px;font-size:12px;font-weight:700;" onchange="onHookTextDirectEdit(${realIdx}, this.value)">${h.text}</textarea>
            <div style="font-size:11px;color:var(--text-muted);margin-top:3px;">🎥 ${h.visualHookAction || ''}</div>
          </td>
          <td style="min-width:145px;">
            <div style="display:flex;flex-direction:column;gap:6px;">
              <button class="btn ${isWinner ? 'btn-orange' : 'btn-outline'}" style="padding:6px 10px;font-size:11px;" onclick="selectWinnerHook(${realIdx})">
                ${isWinner ? '🏆 Đang Chọn' : 'Chọn & Áp Dụng'}
              </button>
              <button class="icon-pill-btn" style="justify-content:center;" onclick="regenerateSingleHookFromIdea(${realIdx})">⚡ Tạo lại Hook</button>
            </div>
          </td>
        </tr>
      `;
    })
    .join('');
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
    const modeTag = winner.angleMode && winner.angleMode !== 'same-as-sample' ? '✨ Ý tưởng mới khác Video mẫu' : '🎯 Bám sát cấu trúc Video mẫu';
    document.getElementById('winner-hook-readtime').textContent =
      `🏆 Hook thắng (#${winner.id} • ${modeTag}): ${words} chữ (~${readSec}s đọc)`;
  }

  renderHookIdeaTable();

  const container = document.getElementById('hook-list-container');
  const displayList = showOnlyQualifiedHooks ? hooksPool.filter((h) => h.total >= 70) : hooksPool;

  container.innerHTML = displayList
    .map((h) => {
      const realIdx = hooksPool.indexOf(h);
      const isWinner = realIdx === winnerHookIndex;
      const isLow = h.total < 70;
      const isDiff = h.angleMode && h.angleMode !== 'same-as-sample';
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
            <span class="badge-mech">#${h.id} • ${h.mech} ${isDiff ? '• ✨ Đã đổi ý tưởng' : ''}</span>
            <span class="badge-score ${isLow ? 'low' : ''}">${h.total}/100đ • ${rankBadge}</span>
          </div>
          <div style="font-size:13px;font-weight:700;">"${h.text}"</div>
          <div style="font-size:11px;color:var(--text-muted);margin-top:4px;">💡 Ý tưởng: ${h.customIdea || ''}</div>
        </div>
      `;
    })
    .join('');
}

// 3. Trợ lý 04: Biên tập kịch bản 6 khối (Tự động điều chỉnh theo Video Mẫu hoặc theo Ý tưởng Hook đã đổi)
function buildSixScriptBlocks() {
  const p = getSelectedProduct();
  const c = getSelectedCharacter();
  const winner = hooksPool[winnerHookIndex] || { text: 'Đừng mua nếu bạn chưa xem 3 chi tiết này!', angleMode: 'same-as-sample' };
  const h1 = p.highlights?.[0] || 'Chất liệu chuẩn cao cấp';
  const h2 = p.highlights?.[1] || 'Bề mặt hoàn thiện chống bám vân tay';
  const h3 = p.highlights?.[2] || 'Nắp khóa kín khít chống tràn';

  const isDiffFromSample = winner.angleMode && winner.angleMode !== 'same-as-sample';
  const vanDeText =
    winner.angleMode === 'new-pain-point'
      ? `Rất nhiều người mua phải hàng trôi nổi chỉ giữ nhiệt được 1–2 tiếng, vỏ ngoài đọng nước làm ướt sạch túi xách và giấy tờ.`
      : winner.angleMode === 'live-test-proof'
      ? `Thông thường các loại bình giá rẻ khi dốc ngược hoặc đựng nước đá cả ngày sẽ bị rỉ nước và mất nhiệt cực nhanh.`
      : winner.angleMode === 'flash-deal-first'
      ? `Bình chuẩn ${h1.toLowerCase()} ngoài thị trường thường có giá rất cao khiến nhiều người đắn đo chưa dám xuống tiền.`
      : `Mang đồ uống đi làm cả ngày mà chỉ vài tiếng đã nguội lạnh, vỏ bình lại trơn trượt bám vân tay gây bất tiện.`;

  const latYText = isDiffFromSample
    ? `Theo đúng hướng mở đầu mới (${winner.customIdea || ''}): ${c.name} trực tiếp kiểm chứng kết cấu ${h1} kết hợp ${h2.toLowerCase()} trên ${p.name}.`
    : `Khác biệt của ${p.name} nằm ở kết cấu: ${h1} kết hợp lớp ${h2.toLowerCase()}.`;

  scriptBlocks = [
    { num: 1, key: 'HOOK', title: 'HOOK', note: isDiffFromSample ? '✨ Theo ý tưởng Hook đã đổi khác mẫu' : '🎯 Theo nhịp mở đầu Video Mẫu', sec: 4, text: winner.text },
    { num: 2, key: 'VAN_DE', title: 'VẤN ĐỀ', note: 'Nỗi đau người xem nhận ra', sec: 4, text: vanDeText },
    { num: 3, key: 'LAT_Y', title: 'LẬT Ý', note: 'Đổi cách nhìn trong 15s đầu', sec: 4, text: latYText },
    { num: 4, key: 'BANG_CHUNG', title: 'BẰNG CHỨNG', note: '2–3 ý đúng dữ liệu product.json', sec: 5, text: `Nhìn cận cảnh ${p.name}: ${h1}; ${h2}; và ${h3}.` },
    { num: 5, key: 'KET_QUA', title: 'KẾT QUẢ', note: 'Cái người xem nhận được', sec: 4, text: `Cầm chắc tay, nhỏ gọn sang trọng khi mang đi làm mỗi ngày, giữ trọn hương vị đồ uống suốt 24 giờ.` },
    { num: 6, key: 'CTA', title: 'CTA', note: 'Đúng giá & ưu đãi có thật', sec: 3, text: `Giá gốc ${p.price} giảm chỉ còn ${p.salePrice || p.price} (${p.discountBadge || 'Ưu đãi hôm nay'}) — bấm giỏ hàng đặt ngay!` }
  ];

  renderScriptBlocks();
}

function renderScriptBlocks() {
  const container = document.getElementById('script-blocks-container');
  const totalSec = scriptBlocks.reduce((s, b) => s + Number(b.sec || 0), 0);
  document.getElementById('script-duration-badge').textContent = `${totalSec} giây (trả lời hook ở giây thứ 8–12 ≤ 15s)`;

  container.innerHTML = scriptBlocks
    .map((b, idx) => {
      const words = String(b.text || '').trim().split(/\s+/).filter(Boolean).length;
      const maxWords = Math.max(1, Math.round(Number(b.sec || 4) * 2.8));
      const isOver = words > maxWords;
      return `
      <div class="script-block ${idx === 0 ? 'first-block' : ''}">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:6px;">
          <span class="script-num">${b.num}</span>
          <span id="word-badge-${idx}" style="font-size:11px;font-weight:800;color:${isOver ? '#DC2626' : '#16A34A'};">
            ${words}/${maxWords} từ ${isOver ? '⚠️ Quá dài' : '✓ Chuẩn'} • ${b.sec}s
          </span>
        </div>
        <div class="script-label">${b.title}</div>
        <div style="font-size:11px;color:var(--text-muted);">${b.note}</div>
        <textarea oninput="onScriptWordCount(${idx}, this.value)" onchange="onScriptBlockEdit(${idx}, this.value)" style="margin-top:4px;font-size:12px;min-height:74px;">${b.text}</textarea>
      </div>
    `;
    })
    .join('');
}

function onScriptWordCount(idx, val) {
  const b = scriptBlocks[idx];
  const badge = document.getElementById(`word-badge-${idx}`);
  if (!b || !badge) return;
  const words = String(val || '').trim().split(/\s+/).filter(Boolean).length;
  const maxWords = Math.max(1, Math.round(Number(b.sec || 4) * 2.8));
  const isOver = words > maxWords;
  badge.style.color = isOver ? '#DC2626' : '#16A34A';
  badge.textContent = `${words}/${maxWords} từ ${isOver ? '⚠️ Quá dài' : '✓ Chuẩn'} • ${b.sec}s`;
}

async function importSampleVideoFromUrl() {
  const urlInput = document.getElementById('inp-sample-url');
  const videoUrl = (urlInput?.value || '').trim();
  if (!videoUrl) {
    alert('Hãy dán link video TikTok / YouTube Shorts / Facebook Reels trước.');
    return;
  }
  if (!serverOnline) {
    logConsole('Hãy mở http://localhost:4173 để tải video từ URL.');
    return;
  }
  const productId = getSelectedProduct()?.id || 'sample-product';
  const characterId = getSelectedCharacter()?.id || 'sample-kol';
  const t0 = startJobProgress('Đang tải video từ link và phân tích nhịp cắt cảnh...', 8);
  try {
    const res = await fetch('/api/import-url', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ videoUrl, productId, characterId })
    });
    const data = await res.json();
    if (!data.ok) {
      finishJobProgress(t0, data.output || 'Không tải được video từ link.');
      alert(data.output || 'Không tải được video từ link.');
      return;
    }
    if (data.state) {
      appState = data.state;
      populateSampleVideoSelect();
      const sel = document.getElementById('inp-sample-video');
      if (sel && data.clipId) sel.value = data.clipId;
      renderSampleAnalysisCard();
    }
    finishJobProgress(t0, data.output || 'Đã tải và phân tích video từ link!');
  } catch (e) {
    finishJobProgress(t0, `Lỗi tải link: ${e.message}`);
  }
}

function downloadCampaignFile(relPath, downloadName) {
  const campId = document.getElementById('inp-campaign-id')?.value || 'sample-campaign';
  const url = `/campaigns/${campId}/${relPath}`;
  const a = document.createElement('a');
  a.href = url;
  a.download = downloadName || relPath.split('/').pop();
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

async function triggerGeminiXray() {
  if (!serverOnline) {
    logConsole('Hãy mở http://localhost:4173 để chạy Giải phẫu sâu Gemini.');
    return;
  }
  const clipId = document.getElementById('inp-sample-video')?.value || '';
  const productId = getSelectedProduct()?.id || 'sample-product';
  const characterId = getSelectedCharacter()?.id || 'sample-kol';
  const t0 = startJobProgress('Đang tải video lên Gemini Files API & giải phẫu từng cảnh...', 15);
  try {
    const res = await fetch('/api/xray-ai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clipId, productId, characterId })
    });
    const data = await res.json();
    if (!data.ok) {
      finishJobProgress(t0, data.output || 'Giải phẫu Gemini thất bại.');
      alert(data.output || 'Giải phẫu Gemini thất bại.');
      return;
    }
    if (data.state) appState = data.state;
    else if (data.sampleAnalysis) appState.sampleAnalysis = data.sampleAnalysis;
    renderSampleAnalysisCard();
    finishJobProgress(t0, data.output || 'Đã giải phẫu sâu Gemini xong!');
  } catch (e) {
    finishJobProgress(t0, `Lỗi Giải phẫu Gemini: ${e.message}`);
  }
}

async function generateCharacterSheetUi() {
  if (!serverOnline) {
    logConsole('Hãy mở http://localhost:4173 để tạo Bộ Ảnh Nhân Vật 4 Góc.');
    return;
  }
  const characterId = getSelectedCharacter()?.id || 'sample-kol';
  const t0 = startJobProgress('Đang tạo Bộ Ảnh Nhân Vật 4 Góc (Character Sheet)...', 5);
  try {
    const res = await fetch('/api/character-sheet', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ characterId })
    });
    const data = await res.json();
    if (!data.ok) {
      finishJobProgress(t0, data.output || 'Lỗi tạo Character Sheet.');
      alert(data.output || 'Lỗi tạo Character Sheet.');
      return;
    }
    if (data.state) appState = data.state;
    if (typeof renderTruthLockSummary === 'function') renderTruthLockSummary();
    finishJobProgress(t0, data.output || 'Đã tạo Bộ Ảnh Nhân Vật 4 Góc!');
  } catch (e) {
    finishJobProgress(t0, `Lỗi tạo Character Sheet: ${e.message}`);
  }
}

async function applyRemakeToHooksAndScript() {
  if (!serverOnline) {
    logConsole('Hãy mở http://localhost:4173 để nhân bản công thức.');
    return;
  }
  const clipId = document.getElementById('inp-sample-video')?.value || '';
  const productId = getSelectedProduct()?.id || 'sample-product';
  const category = document.getElementById('inp-industry')?.value || 'home';
  const style = document.getElementById('inp-tone-style')?.value || 'ugc-iphone';
  const t0 = startJobProgress('Đang áp công thức giải phẫu sang Hook & Kịch bản 6 khối...', 6);
  try {
    const res = await fetch('/api/ai-remake', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clipId, productId, category, style })
    });
    const data = await res.json();
    if (!data.ok || !data.remake) {
      finishJobProgress(t0, data.output || 'Không áp được công thức.');
      alert(data.output || 'Không áp được công thức.');
      return;
    }
    const remake = data.remake;
    const shots = remake.shots || [];
    if (remake.hookLine && hooksPool[winnerHookIndex]) {
      hooksPool[winnerHookIndex].text = remake.hookLine;
    }
    for (let i = 0; i < scriptBlocks.length; i++) {
      const mapped = shots[i];
      if (mapped && mapped.voiceover) {
        scriptBlocks[i].text = mapped.voiceover;
        if (mapped.durationSec) scriptBlocks[i].sec = Math.max(1, Math.round(mapped.durationSec));
      }
    }
    if (typeof renderHooks === 'function') renderHooks();
    renderScriptBlocks();
    finishJobProgress(t0, data.output || 'Đã áp công thức sang Mục 03 & 04!');
    scrollToSlide('slide-03');
  } catch (e) {
    finishJobProgress(t0, `Lỗi áp công thức: ${e.message}`);
  }
}

function onScriptBlockEdit(idx, val) {
  if (idx === 0) {
    alert('Quy tắc Trợ lý 04: Để đổi câu Hook hoặc đổi ý tưởng mở đầu, hãy chỉnh ngay tại Bảng Thay Đổi Ý Tưởng Cho Từng Hook ở Mục 03!');
    renderScriptBlocks();
    return;
  }
  scriptBlocks[idx].text = val;
}

// 4. Trợ lý 05: Đạo diễn hình ảnh (Thay thế Sản phẩm & Nhân vật của bạn vào cấu trúc Video Mẫu) & 3 phương án bìa
function syncScriptToScenes() {
  const mode = getSelectedMode();
  const p = getSelectedProduct();
  const c = getSelectedCharacter();
  const winner = hooksPool[winnerHookIndex] || {};
  const clips = appState.catalog?.clips || [];
  const sampleClipId = document.getElementById('inp-sample-video')?.value || clips[0]?.id || 'video-m-u';
  const bps = appState.sampleAnalysis?.sceneBlueprints || [];

  const s1Action =
    winner.visualHookAction ||
    bps[0]?.suggestedVisualAction ||
    `[Thay thế theo Cảnh 1 Video Mẫu]: Ghép ${c.name} + ${p.name} trực diện (giữ nguyên 100% chi tiết gốc).`;
  const s2Action =
    bps[1]?.suggestedVisualAction ||
    `[Thay thế theo Cảnh 2 Video Mẫu]: ${c.name} trải nghiệm ${p.name}, làm nổi bật ${p.highlights?.[0] || 'chất liệu cao cấp'}.`;
  const s3Action =
    bps[2]?.suggestedVisualAction ||
    `[Thay thế theo Cảnh 3 Video Mẫu]: Cận cảnh 100% ảnh gốc ${p.name} + 3 thông số thật từ product.json.`;
  const s4Action =
    bps[3]?.suggestedVisualAction ||
    `[Thay thế theo Cảnh 4 Video Mẫu]: Hiển thị ${p.name} + Thẻ giá ưu đãi ${p.salePrice || p.price} & nút đặt hàng.`;

  if (mode === 'real-footage') {
    scenesList = [
      {
        id: 'scene-1-hook',
        type: 'real-footage',
        durationSec: 4,
        footageId: sampleClipId,
        trimStartSec: bps[0]?.sampleStartSec ?? 0,
        trimEndSec: (bps[0]?.sampleStartSec ?? 0) + 4,
        subtitle: scriptBlocks[0]?.text || '',
        visualAction: s1Action
      },
      {
        id: 'scene-2-problem-flip',
        type: 'real-footage',
        durationSec: 5,
        footageId: sampleClipId,
        trimStartSec: bps[1]?.sampleStartSec ?? 4,
        trimEndSec: (bps[1]?.sampleStartSec ?? 4) + 5,
        subtitle: `${scriptBlocks[1]?.text || ''} ${scriptBlocks[2]?.text || ''}`.trim(),
        visualAction: s2Action
      },
      {
        id: 'scene-3-proof',
        type: 'real-product-closeup',
        durationSec: 4,
        footageId: '',
        trimStartSec: bps[2]?.sampleStartSec ?? 9,
        trimEndSec: (bps[2]?.sampleStartSec ?? 9) + 4,
        subtitle: scriptBlocks[3]?.text || '',
        visualAction: s3Action
      },
      {
        id: 'scene-4-cta',
        type: 'offer-cta',
        durationSec: 3,
        footageId: '',
        trimStartSec: bps[3]?.sampleStartSec ?? 13,
        trimEndSec: (bps[3]?.sampleStartSec ?? 13) + 3,
        subtitle: scriptBlocks[5]?.text || '',
        visualAction: s4Action
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
        visualAction: s1Action
      },
      {
        id: 'scene-2-experience',
        type: 'ai-experience',
        durationSec: 5,
        footageId: '',
        trimStartSec: 0,
        trimEndSec: 5,
        subtitle: scriptBlocks[2]?.text || '',
        visualAction: s2Action
      },
      {
        id: 'scene-3-product-truth',
        type: 'real-product-closeup',
        durationSec: 4,
        footageId: '',
        trimStartSec: 0,
        trimEndSec: 4,
        subtitle: scriptBlocks[3]?.text || '',
        visualAction: s3Action
      },
      {
        id: 'scene-4-cta',
        type: 'offer-cta',
        durationSec: 3,
        footageId: '',
        trimStartSec: 0,
        trimEndSec: 3,
        subtitle: scriptBlocks[5]?.text || '',
        visualAction: s4Action
      }
    ];
  }

  renderScenesTable();
  renderVeo3StudioCards();
  renderThreeCovers();
  updatePhonePreview();
}

const CAMERA_PRESET_OPTIONS = [
  { value: 'hook-eye-level', label: '🎥 Cận mắt 50mm Dolly-In (Mở đầu 3s)' },
  { value: 'ugc-handheld', label: '📱 Cầm tay UGC Tự nhiên 35mm (Trải nghiệm)' },
  { value: 'macro-product', label: '🔍 Macro Cận cảnh 85mm f/2.8 (Chi tiết SP)' },
  { value: 'split-comparison', label: '⚖️ Bố cục Đôi Studio (Nhân vật + SP)' },
  { value: 'cta-hero', label: '✨ Hero Chốt đơn CTA (Nền sáng sang trọng)' }
];

function getSceneCameraPreset(sc, i) {
  if (sc.cameraPreset) return sc.cameraPreset;
  if (sc.type === 'real-product-closeup' || i === 2) return 'macro-product';
  if (sc.type === 'offer-cta' || i === 3) return 'cta-hero';
  if (i === 1) return 'ugc-handheld';
  return 'hook-eye-level';
}

function buildClientSideVeo3Prompt(sc, i) {
  const p = getSelectedProduct();
  const c = getSelectedCharacter();
  const camKey = getSceneCameraPreset(sc, i);
  const camObj = CAMERA_PRESET_OPTIONS.find((x) => x.value === camKey) || CAMERA_PRESET_OPTIONS[0];
  const pLocks = (p.immutableFeatures || []).join('; ');
  const cLocks = (c.immutableTraits || []).join('; ');
  const prodImg = Object.values(p.referenceImages || {}).find(Boolean) || 'assets/products/sample-product/front.png';
  const charImg = Object.values(c.referenceImages || {}).find(Boolean) || 'assets/characters/sample-kol/portrait.png';
  const refClip = `media/ref-clips/${sc.id}-ref3s.mp4`;
  const campaignId = (document.getElementById('inp-campaign-id')?.value || 'sample-campaign').trim();
  const museStyleEl = document.getElementById('inp-muse-style');
  const museStyleId = sc.museStyle || museStyleEl?.value || 'tvc-studio-luxury';
  const museStyleLabels = {
    'tvc-studio-luxury': '💎 TVC Studio Sang Trọng (Bokeh Vàng Ấm)',
    'warm-lifestyle': '☀️ Lifestyle Đời Thường Tự Nhiên (Nắng Sớm)',
    'clean-shopee-mall': '🛍️ Shopee Mall Sắc Nét (Sáng Rõ Chi Tiết)',
    'tiktok-viral-contrast': '🔥 TikTok High-Retention (Tương Phản Ấn Tượng)'
  };
  const museStylePrompts = {
    'tvc-studio-luxury': 'High-end commercial TVC lighting, warm golden rim light, Sony Venice cinema color science, 85mm f/1.4 creamy bokeh',
    'warm-lifestyle': 'Natural morning window sunlight, soft organic shadows, authentic UGC lifestyle color grade, Fujifilm Eterna warm film tone',
    'clean-shopee-mall': 'Ultra-clean e-commerce studio softbox lighting, neutral 5600K daylight balance, crisp product edge definition',
    'tiktok-viral-contrast': 'Punchy high-contrast social commercial look, dramatic studio key light with subtle teal-amber depth separation'
  };
  const museStyleLabel = museStyleLabels[museStyleId] || museStyleLabels['tvc-studio-luxury'];
  const museStylePrompt = museStylePrompts[museStyleId] || museStylePrompts['tvc-studio-luxury'];

  const startKeyframeUrl = `/campaigns/${campaignId}/media/keyframes/${sc.id}-start.png?t=${Date.now()}`;
  const endKeyframeUrl = `/campaigns/${campaignId}/media/keyframes/${sc.id}-end.png?t=${Date.now()}`;
  const sceneBackdropRel = `assets/footage/analysis/video-m-u/scene-${(i % 4) + 1}.jpg`;

  const whisk3SlotPrompt = [
    `[MUSE AI / GOOGLE WHISK 3-SLOT REMIX — 9:16 VERTICAL]`,
    `• [SLOT 1 - SUBJECT (Chủ thể khóa cứng 100%)]: ${c.name} (${cLocks}) holding/presenting ${p.name} (${pLocks}). Preserve exact face and product geometry/logo.`,
    `• [SLOT 2 - SCENE (Bối cảnh & Hành động)]: ${sc.setting || 'Modern clean studio/lifestyle backdrop'} (${sceneBackdropRel}). Action: ${sc.visualAction}`,
    `• [SLOT 3 - STYLE (Ánh sáng & Màu phim)]: ${museStylePrompt}. Camera: ${camObj.label}.`,
    `• [STRICT NEGATIVE]: no warped logo, no distorted text, no altered product colors, no face morphing.`
  ].join('\n');

  const veo3Prompt = [
    `[VEO 3.1 + MUSE AI FRAMES-TO-VIDEO — 9:16 VERTICAL 1080p]`,
    `• Character Reference (Image 1 - ${charImg}): ${c.name} (${cLocks}). Keep facial identity, hairstyle, and outfit 100% consistent.`,
    `• Product Ingredient Reference (Image 2 - ${prodImg}): ${p.name} (${pLocks}). Preserve exact shape, logo, and surface finish.`,
    `• Frame Continuity (Start Frame -> End Frame): Transition smoothly from ${sc.id}-start.png to ${sc.id}-end.png over ${sc.durationSec || 4}s.`,
    `• Camera & Lens: ${camObj.label}. Style: ${museStylePrompt}.`,
    `• Scene Action (${sc.durationSec || 4}s): ${sc.visualAction}`,
    `• Native Audio & Lip-Sync Dialogue (Vietnamese): Character speaks naturally in Vietnamese: "${sc.subtitle || ''}"`,
    `• Sound Effects (SFX): Realistic tactile product sounds, warm studio acoustic ambiance.`,
    `• Negative: no warped logo, no distorted text, no altered product colors, no face morphing.`
  ].join('\n');

  const omniPrompt = `In a single continuous shot (${sc.durationSec || 4}s, 9:16 1080p, ${museStylePrompt}): The person from the first reference image (${c.name}) holds and demonstrates the exact product from the second reference image (${p.name}), following the camera framing of the reference video (${refClip}) and transitioning from start keyframe to end keyframe. Action: ${sc.visualAction}. Audio: Speaks in Vietnamese: "${sc.subtitle || ''}". Preserve 100% original face and product geometry.`;

  return {
    sceneNumber: i + 1,
    id: sc.id,
    durationSec: sc.durationSec || 4,
    cameraLabel: camObj.label,
    museStyleId,
    museStyleLabel,
    charImg,
    prodImg,
    sceneBackdropRel,
    startKeyframeUrl,
    endKeyframeUrl,
    refClip,
    whisk3SlotPrompt,
    veo3Prompt,
    omniPrompt
  };
}

function renderVeo3StudioCards() {
  const container = document.getElementById('veo3-studio-cards');
  if (!container) return;

  const cards = scenesList.map((sc, i) => buildClientSideVeo3Prompt(sc, i));
  container.innerHTML = cards
    .map(
      (item, i) => `
      <div class="spec-row" style="flex-direction:column;align-items:stretch;gap:8px;background:#FFFFFF;border:1px solid var(--orange-border);">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:6px;flex-wrap:wrap;">
          <span class="badge-mech">CẢNH ${item.sceneNumber} • ${item.id} (${item.durationSec}s)</span>
          <span style="font-size:11px;font-weight:800;color:var(--orange);">${item.cameraLabel}</span>
        </div>

        <!-- Whisk 3-Slot Badges -->
        <div style="font-size:11px;color:var(--text-muted);background:#F8FAFC;padding:6px 8px;border-radius:8px;border:1px solid var(--border);display:flex;flex-direction:column;gap:3px;">
          <div>🎯 <strong>Slot 1 (Chủ thể):</strong> <code>${item.charImg}</code> + <code>${item.prodImg}</code></div>
          <div>🏞️ <strong>Slot 2 (Bối cảnh + Clip 3s):</strong> <code>${item.sceneBackdropRel}</code> • <code>${item.refClip}</code></div>
          <div>🎨 <strong>Slot 3 (Muse Style):</strong> <strong style="color:var(--orange);">${item.museStyleLabel}</strong></div>
        </div>

        <!-- Khung Hình Đầu (Start Frame) -> Khung Hình Cuối (End Frame) -->
        <div style="display:grid;grid-template-columns:1fr auto 1fr;align-items:center;gap:6px;background:#0F172A;padding:8px;border-radius:8px;color:#FFF;">
          <div style="text-align:center;">
            <div style="font-size:10px;font-weight:800;color:#38BDF8;margin-bottom:4px;">KHUNG ĐẦU (START)</div>
            <img src="${item.startKeyframeUrl}" alt="Start ${item.id}" style="width:100%;height:125px;object-fit:contain;border-radius:6px;background:#1E293B;" onerror="this.style.display='none'" />
          </div>
          <div style="font-size:16px;font-weight:900;color:var(--orange);">➔</div>
          <div style="text-align:center;">
            <div style="font-size:10px;font-weight:800;color:#FBBF24;margin-bottom:4px;">KHUNG CUỐI (END)</div>
            <img src="${item.endKeyframeUrl}" alt="End ${item.id}" style="width:100%;height:125px;object-fit:contain;border-radius:6px;background:#1E293B;" onerror="this.style.display='none'" />
          </div>
        </div>

        <textarea id="veo3-prompt-box-${i}" readonly style="font-size:11px;min-height:105px;background:#18181B;color:#F4F4F5;font-family:Consolas,monospace;border-radius:8px;">${item.veo3Prompt}</textarea>
        <div style="display:flex;gap:6px;flex-wrap:wrap;">
          <button class="btn btn-outline" style="padding:6px 8px;font-size:11px;flex:1;" onclick="copySceneVeoPrompt(${i}, 'whisk')">📋 Copy Whisk 3-Slot</button>
          <button class="btn btn-orange" style="padding:6px 8px;font-size:11px;flex:1;" onclick="copySceneVeoPrompt(${i}, 'veo3')">📋 Copy Veo 3.1 (Start→End)</button>
          <button class="btn btn-outline" style="padding:6px 8px;font-size:11px;flex:1;" onclick="copySceneVeoPrompt(${i}, 'omni')">📋 Copy Omni 1.2</button>
        </div>
      </div>
    `
    )
    .join('');
}

async function onChangeMuseStyle(styleId) {
  scenesList.forEach((s) => {
    s.museStyle = styleId;
  });
  renderVeo3StudioCards();
  if (serverOnline) {
    await saveCampaignToServer(true);
    await triggerBackendAction('generate-muse-pack', 5);
    renderVeo3StudioCards();
  }
}

async function copySceneVeoPrompt(idx, kind = 'veo3') {
  const sc = scenesList[idx];
  if (!sc) return;
  const built = buildClientSideVeo3Prompt(sc, idx);
  const textToCopy =
    kind === 'whisk' ? built.whisk3SlotPrompt : kind === 'omni' ? built.omniPrompt : built.veo3Prompt;
  const label =
    kind === 'whisk' ? 'Muse AI / Whisk 3-Slot' : kind === 'omni' ? 'Gemini Omni 1.2 R2V' : 'Google Veo 3.1 (Start→End)';
  try {
    await navigator.clipboard.writeText(textToCopy);
    logConsole(`✅ Đã copy Prompt ${label} của cảnh "${sc.id}" vào Clipboard!`);
  } catch {
    logConsole(textToCopy);
  }
}

async function copyAllVeo3BatchJson() {
  const cards = scenesList.map((sc, i) => buildClientSideVeo3Prompt(sc, i));
  const jsonText = JSON.stringify(cards, null, 2);
  try {
    await navigator.clipboard.writeText(jsonText);
    logConsole(`✅ Đã copy toàn bộ JSON Batch (${cards.length} phân cảnh Veo 3.1) vào Clipboard!`);
  } catch {
    logConsole(jsonText);
  }
}

async function runVeo3PackGeneration() {
  await saveCampaignToServer(true);
  await triggerBackendAction('generate-veo3-pack', 5);
  renderVeo3StudioCards();
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
      (s, i) => {
        const curCam = getSceneCameraPreset(s, i);
        return `
      <tr ondragover="handleDragOver(event, this)" ondragleave="handleDragLeave(event, this)" ondrop="handleSceneRowDrop(event, ${i})" title="Mẹo: Kéo thả trực tiếp file video .mp4 vào dòng này để gán cho cảnh #${i + 1}">
        <td><strong>${i + 1}</strong></td>
        <td style="min-width:140px;"><input type="text" value="${s.id}" onchange="scenesList[${i}].id=this.value;renderVeo3StudioCards();" /></td>
        <td style="min-width:145px;">
          <select onchange="scenesList[${i}].type=this.value;renderScenesTable();renderVeo3StudioCards();updatePhonePreview();">
            ${typeOptions
              .map((t) => `<option value="${t}" ${s.type === t ? 'selected' : ''}>${t}</option>`)
              .join('')}
          </select>
        </td>
        <td style="width:72px;min-width:68px;">
          <input type="number" min="1" max="15" value="${s.durationSec}" onchange="scenesList[${i}].durationSec=Number(this.value);renderVeo3StudioCards();updatePhonePreview();" />
        </td>
        <td style="min-width:255px;">
          <div style="display:flex;flex-direction:column;gap:4px;">
            <select onchange="scenesList[${i}].cameraPreset=this.value;renderVeo3StudioCards();" style="font-size:11px;padding:6px 8px;">
              ${CAMERA_PRESET_OPTIONS.map((c) => `<option value="${c.value}" ${curCam === c.value ? 'selected' : ''}>${c.label}</option>`).join('')}
            </select>
            ${
              s.type === 'real-footage'
                ? `<div style="display:flex;gap:4px;align-items:center;">
                     <input type="text" list="footage-datalist" placeholder="Mã video mẫu" value="${s.footageId || ''}" onchange="scenesList[${i}].footageId=this.value" style="min-width:105px;flex:1;font-size:11px;padding:5px 8px;" />
                     <input type="number" step="0.5" value="${s.trimStartSec ?? 0}" onchange="scenesList[${i}].trimStartSec=Number(this.value)" style="width:50px;font-size:11px;padding:5px;" />
                     <span>→</span>
                     <input type="number" step="0.5" value="${s.trimEndSec ?? s.durationSec}" onchange="scenesList[${i}].trimEndSec=Number(this.value)" style="width:50px;font-size:11px;padding:5px;" />
                   </div>`
                : `<span style="font-size:11px;color:var(--text-muted);">${s.type === 'real-product-closeup' || s.type === 'offer-cta' ? 'Remotion 100% ảnh/chữ gốc' : 'Veo 3.1 Ingredients → Video'}</span>`
            }
          </div>
        </td>
        <td style="min-width:210px;"><input type="text" value="${s.subtitle}" onchange="scenesList[${i}].subtitle=this.value;renderVeo3StudioCards();updatePhonePreview();" /></td>
        <td style="min-width:210px;"><input type="text" value="${s.visualAction}" onchange="scenesList[${i}].visualAction=this.value;renderVeo3StudioCards();" /></td>
        <td><button class="btn btn-outline" style="padding:4px 10px;" onclick="removeSceneRow(${i})">✕</button></td>
      </tr>
    `;
      }
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

  const museStyle = document.getElementById('inp-muse-style')?.value || 'tvc-studio-luxury';
  const cleanScenes = scenesList.map((s) => {
    const base = {
      id: s.id,
      type: s.type,
      durationSec: Number(s.durationSec || 4),
      subtitle: s.subtitle,
      visualAction: s.visualAction,
      setting: s.setting || 'Standard clean studio/lifestyle setting',
      cameraPreset: s.cameraPreset || '',
      sfxPreset: s.sfxPreset || '',
      museStyle: s.museStyle || museStyle,
      motionRefClip: s.motionRefClip || ''
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
    museStyle,
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
  setVal('cfg-ai-scene-count', String(cfg.selectiveAiCount ?? 1));
  setVal('cfg-subtitle-align', cfg.subtitleAlignModel);
  setVal('cfg-subtitle-style', cfg.subtitleStyle);
  setVal('cfg-xray-audio', cfg.xrayAudioModel);
  const budgetEl = document.getElementById('cfg-max-cost');
  if (budgetEl) budgetEl.value = Number(cfg.maxCostUsdPerVideo ?? 0.5).toFixed(2);
  const selEl = document.getElementById('cfg-selective-ai');
  if (selEl) selEl.checked = Boolean(cfg.selectiveAiOnly);

  refreshBrainSummary();
  updateKeyBadges(cfg);
  scheduleCostEstimate();
}

function updateKeyBadges(cfg = {}) {
  const es = cfg.envStatus || {};
  const setBadge = (id, ok) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = ok ? '✅ Đã có trong .env' : '⚪ Chưa có';
    el.style.color = ok ? '#15803D' : '#64748B';
    el.style.fontWeight = ok ? '800' : '600';
  };
  setBadge('badge-gemini-key', Boolean(cfg.hasGeminiKey || es.GEMINI_API_KEY));
  setBadge('badge-fal-key', Boolean(cfg.hasFalKey || es.FAL_KEY));
  setBadge('badge-vbee-key', Boolean(cfg.hasVbeeKey || es.VBEE_API_KEY));
  setBadge('badge-fpt-key', Boolean(cfg.hasFptKey || es.FPT_API_KEY));
}

function toggleKeyVisibility(inputId) {
  const el = document.getElementById(inputId);
  if (el) el.type = el.type === 'password' ? 'text' : 'password';
}

function applyBrainPreset(mode) {
  const setVal = (id, val) => { const el = document.getElementById(id); if (el) el.value = val; };
  if (mode === 'free') {
    setVal('cfg-llm-model', 'local-ecommerce-director');
    setVal('cfg-image-model', 'ffmpeg-real-composite');
    setVal('cfg-video-model', 'ffmpeg-bokeh-cinema');
    setVal('cfg-tts-model', 'google-vi-natural');
    setVal('cfg-subtitle-align', 'heuristic-silence');
    setVal('cfg-subtitle-style', 'box');
  } else if (mode === 'plan1') {
    setVal('cfg-llm-model', 'ollama:qwen3.5:9b');
    setVal('cfg-image-model', 'ffmpeg-real-composite');
    setVal('cfg-video-model', 'ffmpeg-bokeh-cinema');
    setVal('cfg-tts-model', 'vbee-vi');
    setVal('cfg-subtitle-align', 'faster-whisper-local');
    setVal('cfg-subtitle-style', 'word-highlight');
  } else if (mode === 'cloud') {
    setVal('cfg-llm-model', 'gemini-3.1-pro-preview');
    setVal('cfg-image-model', 'fal-flux-kontext');
    setVal('cfg-video-model', 'fal-wan-i2v');
    setVal('cfg-tts-model', 'vbee-vi');
    setVal('cfg-subtitle-align', 'faster-whisper-local');
    setVal('cfg-subtitle-style', 'word-highlight');
  }
  refreshBrainSummary();
  saveAiConfigFromUi();
}

async function saveEnvKeysOnly() {
  const payload = {
    GEMINI_API_KEY: document.getElementById('cfg-gemini-key')?.value.trim() || '',
    FAL_KEY: document.getElementById('cfg-fal-key')?.value.trim() || '',
    VBEE_API_KEY: document.getElementById('cfg-vi-tts-key')?.value.trim() || '',
    VBEE_APP_ID: document.getElementById('cfg-vbee-app-id')?.value.trim() || '',
    FPT_API_KEY: document.getElementById('cfg-fpt-key')?.value.trim() || ''
  };
  try {
    const res = await fetch('/api/save-env-keys', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok || !data.ok) throw new Error(data.output || 'Lỗi lưu key');
    if (data.state) {
      appState = data.state;
      updateKeyBadges(appState.aiConfig);
    }
    ['cfg-gemini-key', 'cfg-fal-key', 'cfg-vi-tts-key', 'cfg-vbee-app-id', 'cfg-fpt-key'].forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });
    alert(data.output);
  } catch (e) {
    alert(`Lỗi lưu API Key: ${e.message}`);
  }
}

// Tên ngắn của lựa chọn đang chọn (phần trước dấu " — ") để hiện trên chip "Đang dùng".
function selectedOptionParts(selectId) {
  const sel = document.getElementById(selectId);
  const text = sel?.selectedOptions?.[0]?.textContent?.trim() || '';
  const [name, ...rest] = text.split(' — ');
  const detail = rest.join(' — ');
  const priceMatch = detail.match(/\(([^()]*\$[^()]*)\)\s*$/);
  return {
    name: name || sel?.value || '—',
    price: priceMatch ? priceMatch[1].trim() : '',
    note: priceMatch ? detail.slice(0, priceMatch.index).trim() : detail
  };
}

function refreshBrainSummary() {
  const pills = { 'pill-llm': 'cfg-llm-model', 'pill-img': 'cfg-image-model', 'pill-vid': 'cfg-video-model', 'pill-tts': 'cfg-tts-model' };
  for (const [pillId, selectId] of Object.entries(pills)) {
    const el = document.getElementById(pillId);
    if (el) el.textContent = selectedOptionParts(selectId).name;
  }
  for (const hint of document.querySelectorAll('.cost-hint[data-hint-for]')) {
    const { price, note } = selectedOptionParts(hint.dataset.hintFor);
    // "$0 / ảnh, giữ 100% pixel gốc" → chip "$0 / ảnh" + ghi chú "giữ 100% pixel gốc"
    const [chipText, ...extra] = price.split(/,\s+/); // ", " mới là ngăn ý; "0,3s" là số thập phân

    hint.textContent = '';
    if (chipText) {
      const chip = document.createElement('span');
      chip.className = 'cost-chip' + (/\$0(?![.\d])/.test(chipText) ? ' is-free' : '');
      chip.textContent = chipText;
      hint.appendChild(chip);
    }
    hint.appendChild(document.createTextNode([note, ...extra].filter(Boolean).join(', ')));
    // Lựa chọn cần công cụ local mà chưa sẵn sàng → nói rõ lý do ngay dưới ô chọn
    const sel = document.getElementById(hint.dataset.hintFor);
    const req = sel?.selectedOptions?.[0]?.dataset?.requires;
    const why = req ? localToolUnavailableReason(req) : '';
    if (why) {
      const warn = document.createElement('span');
      warn.className = 'tool-warn';
      warn.textContent = ` Chưa sẵn sàng: ${why}`;
      hint.appendChild(warn);
    }
  }
}

// ===== Gói 7 — trạng thái công cụ local (VoiceStudio, Python, libass) =====
let localToolsStatus = null;

function localToolUnavailableReason(req) {
  if (!localToolsStatus) return '';
  if (req === 'voicestudio') return localToolsStatus.voicestudio?.ok ? '' : localToolsStatus.voicestudio?.detail || 'VoiceStudio chưa chạy (cần Task 0)';
  if (req === 'speechPython') return localToolsStatus.speechPython ? '' : 'chưa cài tools/speech/.venv (cần Task 0)';
  if (req === 'libass') return localToolsStatus.libass ? '' : 'FFmpeg thiếu libass';
  return '';
}

async function refreshLocalToolsStatus() {
  if (!serverOnline) return;
  try {
    const res = await fetch('/api/local-tools/status');
    localToolsStatus = await res.json();
  } catch {
    localToolsStatus = null;
    return;
  }
  for (const opt of document.querySelectorAll('option[data-requires]')) {
    const why = localToolUnavailableReason(opt.dataset.requires);
    opt.disabled = Boolean(why);
    opt.title = why ? `Chưa sẵn sàng: ${why}` : '';
  }
  refreshBrainSummary();
}

const COST_STEP_LABELS = { keyframe: 'Ảnh keyframe', video: 'Video AI', tts: 'Giọng đọc' };
let costEstimateTimer = null;

function scheduleCostEstimate() {
  clearTimeout(costEstimateTimer);
  costEstimateTimer = setTimeout(refreshCostEstimate, 250);
}

function readCostInputs() {
  const selective = Boolean(document.getElementById('cfg-selective-ai')?.checked);
  const count = Number(document.getElementById('cfg-ai-scene-count')?.value || 1);
  const budget = Number(document.getElementById('cfg-max-cost')?.value);
  return {
    imageModel: document.getElementById('cfg-image-model')?.value,
    videoModel: document.getElementById('cfg-video-model')?.value,
    ttsModel: document.getElementById('cfg-tts-model')?.value,
    // Không giới hạn thì giả định mọi cảnh của chiến dịch 4 cảnh đều dùng AI.
    aiSceneCount: selective ? count : 4,
    selective,
    maxCostUsdPerVideo: Number.isFinite(budget) ? budget : 0.5
  };
}

async function refreshCostEstimate() {
  const box = document.getElementById('cost-estimate');
  const totalEl = document.getElementById('cost-total');
  const verdictEl = document.getElementById('cost-verdict');
  const listEl = document.getElementById('cost-breakdown');
  if (!box || !totalEl || !verdictEl || !listEl) return;
  const countSel = document.getElementById('cfg-ai-scene-count');
  const input = readCostInputs();
  if (countSel) countSel.disabled = !input.selective;

  if (!serverOnline) {
    totalEl.textContent = '—';
    verdictEl.textContent = 'Bật Local Server để tính chi phí.';
    listEl.textContent = '';
    box.classList.remove('is-over');
    return;
  }
  try {
    const res = await fetch('/api/cost-estimate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input)
    });
    const data = await res.json();
    if (!data.ok) throw new Error(data.output || 'Không tính được chi phí');
    totalEl.textContent = `$${data.totalUsd.toFixed(2)}`;
    box.classList.toggle('is-over', !data.withinBudget);
    const scope = input.selective ? `${data.aiSceneCount} cảnh AI × 5s` : 'mọi cảnh dùng AI (giả định 4 × 5s)';
    verdictEl.textContent = data.withinBudget
      ? `Trong ngân sách $${data.maxUsd.toFixed(2)} — ${scope}`
      : `Vượt ngân sách $${data.maxUsd.toFixed(2)} — giảm số cảnh AI hoặc chọn công cụ rẻ hơn. Lệnh chạy thật sẽ bị chặn.`;
    listEl.textContent = '';
    for (const it of data.items || []) {
      const li = document.createElement('li');
      const label = document.createElement('span');
      label.textContent = COST_STEP_LABELS[it.step] || it.step;
      const val = document.createElement('span');
      val.textContent = `$${Number(it.usd).toFixed(2)}`;
      li.append(label, val);
      listEl.appendChild(li);
    }
  } catch (e) {
    totalEl.textContent = '—';
    verdictEl.textContent = `Không tính được chi phí: ${e.message}`;
    box.classList.remove('is-over');
  }
}

function setupCostControls() {
  const ids = [
    'cfg-llm-model', 'cfg-image-model', 'cfg-video-model', 'cfg-tts-model',
    'cfg-subtitle-align', 'cfg-subtitle-style', 'cfg-xray-audio',
    'cfg-selective-ai', 'cfg-ai-scene-count', 'cfg-max-cost'
  ];
  for (const id of ids) {
    const el = document.getElementById(id);
    if (!el) continue;
    el.addEventListener('change', () => {
      refreshBrainSummary();
      scheduleCostEstimate();
    });
    if (el.type === 'number') el.addEventListener('input', scheduleCostEstimate);
  }
  refreshBrainSummary();
  updateKeyBadges(cfg);
  scheduleCostEstimate();
}

function updateKeyBadges(cfg = {}) {
  const es = cfg.envStatus || {};
  const setBadge = (id, ok) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = ok ? '✅ Đã có trong .env' : '⚪ Chưa có';
    el.style.color = ok ? '#15803D' : '#64748B';
    el.style.fontWeight = ok ? '800' : '600';
  };
  setBadge('badge-gemini-key', Boolean(cfg.hasGeminiKey || es.GEMINI_API_KEY));
  setBadge('badge-fal-key', Boolean(cfg.hasFalKey || es.FAL_KEY));
  setBadge('badge-vbee-key', Boolean(cfg.hasVbeeKey || es.VBEE_API_KEY));
  setBadge('badge-fpt-key', Boolean(cfg.hasFptKey || es.FPT_API_KEY));
}

function toggleKeyVisibility(inputId) {
  const el = document.getElementById(inputId);
  if (el) el.type = el.type === 'password' ? 'text' : 'password';
}

function applyBrainPreset(mode) {
  const setVal = (id, val) => { const el = document.getElementById(id); if (el) el.value = val; };
  if (mode === 'free') {
    setVal('cfg-llm-model', 'local-ecommerce-director');
    setVal('cfg-image-model', 'ffmpeg-real-composite');
    setVal('cfg-video-model', 'ffmpeg-bokeh-cinema');
    setVal('cfg-tts-model', 'google-vi-natural');
    setVal('cfg-subtitle-align', 'heuristic-silence');
    setVal('cfg-subtitle-style', 'box');
  } else if (mode === 'plan1') {
    setVal('cfg-llm-model', 'ollama:qwen3.5:9b');
    setVal('cfg-image-model', 'ffmpeg-real-composite');
    setVal('cfg-video-model', 'ffmpeg-bokeh-cinema');
    setVal('cfg-tts-model', 'vbee-vi');
    setVal('cfg-subtitle-align', 'faster-whisper-local');
    setVal('cfg-subtitle-style', 'word-highlight');
  } else if (mode === 'cloud') {
    setVal('cfg-llm-model', 'gemini-3.1-pro-preview');
    setVal('cfg-image-model', 'fal-flux-kontext');
    setVal('cfg-video-model', 'fal-wan-i2v');
    setVal('cfg-tts-model', 'vbee-vi');
    setVal('cfg-subtitle-align', 'faster-whisper-local');
    setVal('cfg-subtitle-style', 'word-highlight');
  }
  refreshBrainSummary();
  saveAiConfigFromUi();
}

async function saveEnvKeysOnly() {
  const payload = {
    GEMINI_API_KEY: document.getElementById('cfg-gemini-key')?.value.trim() || '',
    FAL_KEY: document.getElementById('cfg-fal-key')?.value.trim() || '',
    VBEE_API_KEY: document.getElementById('cfg-vi-tts-key')?.value.trim() || '',
    VBEE_APP_ID: document.getElementById('cfg-vbee-app-id')?.value.trim() || '',
    FPT_API_KEY: document.getElementById('cfg-fpt-key')?.value.trim() || ''
  };
  try {
    const res = await fetch('/api/save-env-keys', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok || !data.ok) throw new Error(data.output || 'Lỗi lưu key');
    if (data.state) {
      appState = data.state;
      updateKeyBadges(appState.aiConfig);
    }
    ['cfg-gemini-key', 'cfg-fal-key', 'cfg-vi-tts-key', 'cfg-vbee-app-id', 'cfg-fpt-key'].forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });
    alert(data.output);
  } catch (e) {
    alert(`Lỗi lưu API Key: ${e.message}`);
  }
}

// Preset tiết kiệm: Ollama local + 1 cảnh AI (FLUX Kontext + Wan 5s) + Vbee ≈ $0.30, ngân sách $0.50.
function applyBudgetPreset() {
  const setVal = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.value = val;
  };
  setVal('cfg-llm-model', 'ollama:qwen3.5:9b');
  setVal('cfg-image-model', 'fal-flux-kontext');
  setVal('cfg-video-model', 'fal-wan-i2v');
  setVal('cfg-tts-model', 'vbee-vi');
  setVal('cfg-ai-scene-count', '1');
  setVal('cfg-max-cost', '0.50');
  const selEl = document.getElementById('cfg-selective-ai');
  if (selEl) selEl.checked = true;
  saveAiConfigFromUi();
}

// Giữ tên cũ để không vỡ nơi khác đang gọi.
const applyUnderOneDollarPreset = applyBudgetPreset;

async function saveAiConfigFromUi() {
  const ttsModel = document.getElementById('cfg-tts-model')?.value;
  const viTtsKey = document.getElementById('cfg-vi-tts-key')?.value || '';
  const payload = {
    llmModel: document.getElementById('cfg-llm-model')?.value,
    imageModel: document.getElementById('cfg-image-model')?.value,
    videoModel: document.getElementById('cfg-video-model')?.value,
    ttsModel,
    selectiveAiOnly: Boolean(document.getElementById('cfg-selective-ai')?.checked),
    selectiveAiCount: Number(document.getElementById('cfg-ai-scene-count')?.value || 1),
    maxCostUsdPerVideo: document.getElementById('cfg-max-cost')?.value ?? '',
    subtitleAlignModel: document.getElementById('cfg-subtitle-align')?.value,
    subtitleStyle: document.getElementById('cfg-subtitle-style')?.value,
    xrayAudioModel: document.getElementById('cfg-xray-audio')?.value,
    geminiApiKey: document.getElementById('cfg-gemini-key')?.value || '',
    falApiKey: document.getElementById('cfg-fal-key')?.value || '',
    vbeeApiKey: document.getElementById('cfg-vi-tts-key')?.value || '',
    vbeeAppId: document.getElementById('cfg-vbee-app-id')?.value || '',
    fptApiKey: document.getElementById('cfg-fpt-key')?.value || ''
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

async function runFullAutoPilot() {
  await saveCampaignToServer(true);
  await triggerBackendAction('run-optimal-pipeline', 18);
  renderVeo3StudioCards();
  renderReelSheet();
  scrollToSlide('slide-06');
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
    'generate-muse-pack': '🎨 Đang tạo cặp ảnh Khung Đầu / Khung Cuối & gói Muse AI / Whisk 3-Slot...',
    'generate-veo3-pack': '🎨🎬 Đang xuất bộ Prompt Muse AI × Whisk 3-Slot × Veo 3.1 & cắt clip mẫu 3s...',
    'run-veo3-cloud': 'Đang gọi Cloud Veo 3.1 / Gemini Omni 1.2 Flash sinh video điện ảnh...',
    'generate-voiceover': 'Đang sinh giọng đọc thuyết minh tiếng Việt & trộn âm thanh 48kHz...',
    'export-cutlist': 'Đang trích xuất bảng cắt CapCut (cutlist.md & cutlist.csv)...',
    'render-ffmpeg': 'Đang dựng video MP4 1080×1920 (Bokeh Cinema + 100% Người & SP Thật + Giọng Việt)...',
    'sync-studio': 'Đang đồng bộ chiến dịch & âm thanh sang Remotion Studio...',
    'verify-integrity': 'Đang đo chỉ số SSIM khung hình & kiểm tra luồng âm thanh...',
    'run-optimal-pipeline': '⚡ AUTO-PILOT: Đang tự động chạy toàn bộ 6 bước (Phân tích Video Mẫu → Muse 3-Slot Keyframes → Prompt Veo 3.1 → Giọng Việt → Dựng MP4 Bokeh Cinema → Kiểm định)...'
  };

  const t0 = startJobProgress(actionLabels[action] || `Đang thực thi ${action}...`, estSec);
  logConsole(actionLabels[action] || `Đang thực thi "${action}"...`);

  const museStyle = document.getElementById('inp-muse-style')?.value || 'tvc-studio-luxury';
  const res = await fetch('/api/run-action', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, campaignId, museStyle })
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
    } else if (action === 'render-ffmpeg' || action === 'run-optimal-pipeline') {
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

function loadCampaignFromSelect(silent = false) {
  const slug = (document.getElementById('inp-campaign-id').value || 'sample-campaign').trim();
  const found = (appState.campaigns || []).find((c) => c.id === slug);
  if (!found) {
    if (!silent) alert(`Không tìm thấy chiến dịch "${slug}" trong bộ nhớ hiện tại.`);
    return;
  }
  if (found.productId && document.getElementById('inp-product')) {
    document.getElementById('inp-product').value = found.productId;
  }
  if (found.characterId && document.getElementById('inp-character')) {
    document.getElementById('inp-character').value = found.characterId;
  }
  if (found.museStyle && document.getElementById('inp-muse-style')) {
    document.getElementById('inp-muse-style').value = found.museStyle;
  }
  document.getElementById('inp-mode').value = found.mode === 'real-footage' ? 'real-footage' : 'hybrid-ai';
  scenesList = structuredClone(found.scenes || []);
  renderScenesTable();
  renderVeo3StudioCards();
  renderThreeCovers();
  renderExistingAssetPreviews();
  renderTruthLockSummary();
  updatePhonePreview();
  if (!silent) logConsole(`Đã nạp chiến dịch "${slug}" (${scenesList.length} cảnh).`);
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

  // Hiển thị xem trước ngay tức thì trên ô Kéo & Thả
  if (previewBox) {
    if (kind === 'footage' || file.type.startsWith('video/')) {
      previewBox.innerHTML = `<video src="${objectUrl}" controls muted playsinline></video>`;
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
    if (data.sampleAnalysis) {
      appState.sampleAnalysis = data.sampleAnalysis;
      const ideaInput = document.getElementById('inp-raw-idea');
      if (ideaInput) ideaInput.value = data.sampleAnalysis.extractedIdea;
      renderSampleAnalysisCard();
      runAllAssistants();
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

function renderBatchPanel(data = {}) {
  const csvEl = document.getElementById('batch-csv-input');
  if (csvEl && typeof data.csvText === 'string') csvEl.value = data.csvText;
  const p = data.preview || {};
  const sumEl = document.getElementById('batch-summary-text');
  if (sumEl) {
    sumEl.textContent = `📦 ${p.count || 0} SKU trong CSV • Ước tính ~$${Number(p.perVideoUsd || 0).toFixed(2)}/video • Tổng lô: ~$${Number(p.totalEstimatedUsd || 0).toFixed(2)}`;
  }
  const l = data.ledger || {};
  const totalEl = document.getElementById('ledger-total-usd');
  if (totalEl) totalEl.textContent = `$${Number(l.totalUsd || 0).toFixed(2)}`;
  const cntEl = document.getElementById('ledger-entries-count');
  if (cntEl) cntEl.textContent = `${l.entriesCount || 0} lượt ghi nhận chi phí`;
  const listEl = document.getElementById('ledger-recent-list');
  if (listEl) {
    const recent = l.recent || [];
    listEl.innerHTML = recent.length
      ? recent.map((r) => `<li><strong>${r.campaignId}</strong> • ${r.step || 'ai'} (${r.model || ''}): $${Number(r.usd || 0).toFixed(2)}</li>`).join('')
      : '<li>Chưa có giao dịch chi phí AI nào được ghi nhận.</li>';
  }
}

async function loadBatchStatus() {
  try {
    const res = await fetch('/api/batch/status');
    const data = await res.json();
    if (res.ok && data.ok) renderBatchPanel(data);
  } catch {
    // Bỏ qua nếu server chưa chạy
  }
}

async function runBatchFromUi(runPipeline = false) {
  const csvText = document.getElementById('batch-csv-input')?.value || '';
  const sumEl = document.getElementById('batch-summary-text');
  if (sumEl) sumEl.textContent = runPipeline ? '⏳ Đang chạy dây chuyền sản xuất hàng loạt (--run --resume)...' : '⏳ Đang nhập SKU từ CSV...';
  try {
    const res = await fetch('/api/batch/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ csvText, runPipeline, resume: true })
    });
    const data = await res.json();
    if (!res.ok || !data.ok) throw new Error(data.output || 'Lỗi chạy lô CSV');
    renderBatchPanel(data);
    if (data.state) appState = data.state;
    logConsole(data.output);
    alert(runPipeline ? 'Đã chạy xong lô hàng loạt!' : 'Đã nhập SKU từ CSV thành công!');
  } catch (e) {
    if (sumEl) sumEl.textContent = `❌ Lỗi: ${e.message}`;
    alert(`Lỗi chạy lô CSV: ${e.message}`);
  }
}

window.addEventListener('DOMContentLoaded', () => {
  setupCommandBar();
  setupCostControls();
  initDashboard();
  loadBatchStatus();
});
