let appState = null;
let currentKol = null;

function setStatus(msg) {
  const el = document.getElementById('kol-status');
  if (el) el.textContent = msg;
}

function switchTab(tabId) {
  document.querySelectorAll('.tab-panel').forEach((p) => p.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach((b) => b.classList.remove('active'));
  const panel = document.getElementById(tabId);
  if (panel) panel.classList.add('active');
  const btn = document.querySelector(`.tab-btn[data-tab="${tabId}"]`);
  if (btn) btn.classList.add('active');
}

async function apiJson(url, method = 'GET', body = null) {
  const opts = { method, headers: {} };
  if (body !== null) {
    opts.headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(body);
  }
  const res = await fetch(url, opts);
  const data = await res.json();
  if (!res.ok || data.ok === false) {
    throw new Error(data.output || `HTTP ${res.status}`);
  }
  return data;
}

function hydrateState(state) {
  appState = state;
  const chars = state.characters || [];
  const prods = state.products || [];

  document.getElementById('kol-count-badge').textContent = `${chars.length} KOL`;
  if (state.aiConfig) {
    document.getElementById('kol-brain-badge').textContent = `LLM: ${state.aiConfig.llmModel}`;
  }

  const kolSel = document.getElementById('kol-select');
  const prevKol = kolSel.value;
  kolSel.innerHTML = chars.map((c) => `<option value="${c.id}">${c.name} (${c.id})</option>`).join('');
  if (prevKol && chars.some((c) => c.id === prevKol)) {
    kolSel.value = prevKol;
  } else if (chars.length > 0) {
    kolSel.value = chars[0].id;
  }

  const prodSel = document.getElementById('kol-product-select');
  prodSel.innerHTML = `<option value="">-- Không gắn sản phẩm (Nói tự do) --</option>` +
    prods.map((p) => `<option value="${p.id}">${p.name} (${p.price})</option>`).join('');

  onSelectKol();
}

function fillKolForm(kol) {
  if (!kol) return;
  currentKol = kol;
  document.getElementById('kol-id').value = kol.id || '';
  document.getElementById('kol-name').value = kol.name || '';
  document.getElementById('kol-role').value = kol.role || '';
  document.getElementById('kol-niche').value = kol.niche || 'beauty';
  document.getElementById('kol-voice').value = kol.voiceStyle || '';
  document.getElementById('kol-catchphrase').value = kol.catchphrase || '';
  document.getElementById('kol-traits').value = Array.isArray(kol.immutableTraits) ? kol.immutableTraits.join('\n') : '';

  document.getElementById('kol-preview-card').textContent = JSON.stringify(kol, null, 2);

  const refs = kol.referenceImages || {};
  const portraitSrc = refs.portrait || refs.halfBody || '';
  const portraitImg = document.getElementById('kol-portrait-preview');
  if (portraitSrc) {
    portraitImg.src = `/${portraitSrc}?t=${Date.now()}`;
    portraitImg.style.display = 'block';
  } else {
    portraitImg.style.display = 'none';
  }

  const sheetImg = document.getElementById('kol-sheet-preview');
  if (refs.sheet4Angles) {
    sheetImg.src = `/${refs.sheet4Angles}?t=${Date.now()}`;
    sheetImg.style.display = 'block';
  } else {
    sheetImg.style.display = 'none';
  }

  updateLookbookPrompt();
}

function onSelectKol() {
  if (!appState) return;
  const id = document.getElementById('kol-select').value;
  const found = (appState.characters || []).find((c) => c.id === id);
  if (found) fillKolForm(found);
}

function resetNewKolForm() {
  currentKol = null;
  document.getElementById('kol-id').value = '';
  document.getElementById('kol-name').value = '';
  document.getElementById('kol-role').value = '';
  document.getElementById('kol-voice').value = '';
  document.getElementById('kol-catchphrase').value = '';
  document.getElementById('kol-traits').value = '';
  document.getElementById('kol-preview-card').textContent = 'Nhập thông tin hoặc dùng AI để sinh hồ sơ mới.';
  setStatus('Đang tạo hồ sơ KOL AI mới.');
}

async function saveKolProfile() {
  try {
    setStatus('Đang lưu hồ sơ KOL AI...');
    const payload = {
      id: document.getElementById('kol-id').value.trim(),
      name: document.getElementById('kol-name').value.trim(),
      role: document.getElementById('kol-role').value.trim(),
      niche: document.getElementById('kol-niche').value,
      voiceStyle: document.getElementById('kol-voice').value.trim(),
      catchphrase: document.getElementById('kol-catchphrase').value.trim(),
      immutableTraits: document.getElementById('kol-traits').value.split(/\r?\n/).map((s) => s.trim()).filter(Boolean)
    };
    const res = await apiJson('/api/kol/save', 'POST', payload);
    hydrateState(res.state);
    document.getElementById('kol-select').value = res.character.id;
    onSelectKol();
    setStatus(res.output);
  } catch (e) {
    setStatus(`Lỗi: ${e.message}`);
  }
}

async function generatePersonaAi() {
  try {
    setStatus('Đang sinh hồ sơ KOL AI...');
    const idea = document.getElementById('kol-idea-input').value.trim();
    const niche = document.getElementById('kol-niche').value;
    const res = await apiJson('/api/kol/generate-persona', 'POST', { idea, niche });
    fillKolForm(res.persona);
    setStatus(res.output);
  } catch (e) {
    setStatus(`Lỗi: ${e.message}`);
  }
}

function updateLookbookPrompt() {
  const traits = document.getElementById('kol-traits').value
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean)
    .join(', ');
  const scene = document.getElementById('lookbook-scene').value;
  const prompt = traits
    ? `Photorealistic 9:16 portrait of ${traits}. Setting: ${scene}. Preserve exact facial features and identity from reference portrait. Negative: different person, plastic skin, distorted hands, watermark.`
    : 'Chưa có immutableTraits. Hãy lưu hồ sơ KOL trước.';
  document.getElementById('lookbook-prompt-box').textContent = prompt;
}

async function handlePortraitFile(file) {
  if (!file) return;
  const kolId = document.getElementById('kol-id').value.trim();
  if (!kolId) {
    setStatus('Vui lòng nhập Mã KOL (ID) và Lưu Hồ Sơ trước khi tải ảnh lên.');
    return;
  }
  try {
    setStatus(`Đang tải ảnh chân dung "${file.name}" cho KOL ${kolId}...`);
    const base64 = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result).split(',')[1] || '');
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
    const res = await apiJson('/api/upload-asset', 'POST', {
      kind: 'character',
      targetId: kolId,
      slot: 'portrait',
      filename: file.name,
      base64
    });
    hydrateState(res.state);
    document.getElementById('kol-select').value = kolId;
    onSelectKol();
    setStatus(res.output);
  } catch (e) {
    setStatus(`Lỗi tải ảnh: ${e.message}`);
  }
}

async function generate4AngleSheet() {
  const kolId = document.getElementById('kol-id').value.trim();
  if (!kolId) {
    setStatus('Vui lòng chọn hoặc lưu hồ sơ KOL trước.');
    return;
  }
  try {
    setStatus(`Đang tạo Bộ Ảnh 4 Góc cho KOL ${kolId}...`);
    const res = await apiJson('/api/character-sheet', 'POST', { characterId: kolId });
    hydrateState(res.state);
    document.getElementById('kol-select').value = kolId;
    onSelectKol();
    setStatus(res.output);
  } catch (e) {
    setStatus(`Lỗi tạo bộ ảnh 4 góc: ${e.message}`);
  }
}

function updateWordMeter() {
  const text = document.getElementById('kol-voice-text').value.trim();
  const words = text ? text.split(/\s+/).filter(Boolean).length : 0;
  const sec = (words / 2.6).toFixed(1);
  document.getElementById('kol-word-meter').textContent = `${words} từ • ~${sec}s (chuẩn <= 2.8 từ/s)`;
}

async function generateKolScriptAi() {
  const kolId = document.getElementById('kol-id').value.trim();
  if (!kolId) {
    setStatus('Vui lòng chọn hoặc lưu hồ sơ KOL trước.');
    return;
  }
  try {
    setStatus('Đang sinh kịch bản & prompt Veo 3.1 cho KOL...');
    const res = await apiJson('/api/kol/generate-script', 'POST', {
      characterId: kolId,
      productId: document.getElementById('kol-product-select').value,
      topic: document.getElementById('kol-topic').value.trim(),
      platform: document.getElementById('kol-platform').value,
      durationSec: Number(document.getElementById('kol-duration').value)
    });
    const s = res.script;
    document.getElementById('kol-hook-title').value = s.hook || '';
    document.getElementById('kol-voice-text').value = s.fullVoiceover || '';
    document.getElementById('kol-veo-prompt').textContent = s.veoLipSyncPrompt || '';
    updateWordMeter();
    setStatus(res.output);
  } catch (e) {
    setStatus(`Lỗi sinh kịch bản: ${e.message}`);
  }
}

async function renderTalkingKol() {
  const kolId = document.getElementById('kol-id').value.trim();
  if (!kolId) {
    setStatus('Vui lòng chọn hoặc lưu hồ sơ KOL trước.');
    return;
  }
  const btn = document.querySelector('button[onclick="renderTalkingKol()"]');
  const startMs = Date.now();
  const timer = setInterval(() => {
    const sec = Math.floor((Date.now() - startMs) / 1000);
    setStatus(`⏳ Đang tổng hợp giọng đọc & dựng Video KOL AI 60fps... (${sec}s)`);
  }, 1000);
  if (btn) btn.disabled = true;
  try {
    setStatus('⏳ Đang tổng hợp giọng đọc tiếng Việt & dựng Video KOL AI 9:16...');
    const res = await apiJson('/api/kol/render-video', 'POST', {
      characterId: kolId,
      productId: document.getElementById('kol-product-select').value,
      voiceText: document.getElementById('kol-voice-text').value.trim(),
      hookTitle: document.getElementById('kol-hook-title').value.trim(),
      durationSec: Number(document.getElementById('kol-duration').value)
    });
    const videoEl = document.getElementById('kol-video-player');
    videoEl.src = res.videoUrl;
    videoEl.style.display = 'block';
    document.getElementById('kol-video-placeholder').style.display = 'none';

    const audioEl = document.getElementById('kol-audio-player');
    if (res.audioUrl) {
      audioEl.src = res.audioUrl;
      audioEl.style.display = 'block';
    }
    const linksEl = document.getElementById('kol-download-links');
    linksEl.innerHTML = `<a class="btn btn-primary" href="${res.videoUrl}" download="kol-${kolId}-9x16.mp4">⬇️ Tải Video MP4</a>` +
      (res.assUrl ? `<a class="btn btn-secondary" href="${res.assUrl}" download="subtitles.ass">⬇️ Tải Phụ Đề .ASS</a>` : '');
    setStatus(res.output);
  } catch (e) {
    setStatus(`Lỗi dựng video: ${e.message}`);
  } finally {
    clearInterval(timer);
    if (btn) btn.disabled = false;
  }
}

async function approveKolScript() {
  const kolId = document.getElementById('kol-id').value.trim();
  const approvedBy = document.getElementById('kol-approved-by').value.trim();
  const note = document.getElementById('kol-approval-note');
  if (!kolId) {
    setStatus('Vui lòng chọn hoặc lưu hồ sơ KOL trước.');
    return;
  }
  if (!approvedBy) {
    setStatus('Ghi tên người duyệt trước khi xác nhận.');
    document.getElementById('kol-approved-by').focus();
    return;
  }
  try {
    const res = await apiJson('/api/kol/approve', 'POST', { campaignId: `kol-${kolId}`, approvedBy });
    if (note) note.textContent = res.output;
    setStatus(res.output);
  } catch (e) {
    setStatus(`Lỗi ghi duyệt: ${e.message}`);
  }
}

async function loadSkillsHub() {
  try {
    const res = await apiJson('/api/kol/skills');
    const grid = document.getElementById('skills-grid');
    const pluginCards = [
      { name: 'gemini-api (Plugin Đã Cài)', description: 'Sinh ảnh (Nano Banana / Imagen), video (Veo 3.1 / Omni 1.2), giọng đọc (Gemini TTS) và Live API.', path: 'Plugin: antigravity-plugins-official/plugin/gemini-api' },
      { name: 'invideo (Plugin Đã Cài)', description: 'Dựng & biên tập timeline video AI hoàn chỉnh, lồng tiếng, nhạc nền và xuất bản đa nền tảng.', path: 'Plugin: antigravity-plugins-partners/plugin/invideo' }
    ];
    const all = [...(res.skills || []), ...pluginCards];
    grid.innerHTML = all.map((s) => `
      <div class="skill-card">
        <h3>🧩 ${s.name}</h3>
        <p>${s.description || 'Agent Skill chuyên dụng trong dự án.'}</p>
        <div class="code-box">${s.path}</div>
      </div>
    `).join('');
  } catch (e) {
    document.getElementById('skills-grid').textContent = `Không tải được danh sách skills: ${e.message}`;
  }
}

function copyTextById(id) {
  const txt = document.getElementById(id)?.textContent || '';
  navigator.clipboard.writeText(txt);
  setStatus('Đã copy nội dung vào clipboard!');
}

function copyCharacterJson() {
  const txt = document.getElementById('kol-preview-card')?.textContent || '';
  navigator.clipboard.writeText(txt);
  setStatus('Đã copy character.json!');
}

function setupDropzone() {
  const dz = document.getElementById('kol-dropzone');
  if (!dz) return;
  dz.addEventListener('dragover', (e) => { e.preventDefault(); dz.classList.add('dragover'); });
  dz.addEventListener('dragleave', () => dz.classList.remove('dragover'));
  dz.addEventListener('drop', (e) => {
    e.preventDefault();
    dz.classList.remove('dragover');
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handlePortraitFile(e.dataTransfer.files[0]);
    }
  });
}

async function initKolStudio() {
  setupDropzone();
  try {
    const state = await apiJson('/api/state');
    hydrateState(state);
    await loadSkillsHub();
    setStatus('Sẵn sàng — Chọn hoặc tạo KOL AI mới.');
  } catch (e) {
    setStatus(`Không kết nối được server: ${e.message}`);
  }
}

initKolStudio();
