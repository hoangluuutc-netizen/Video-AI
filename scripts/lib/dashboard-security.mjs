// Bảo vệ Dashboard chạy trên máy (localhost:4173).
// Dashboard có API ghi .env, chạy pipeline tốn tiền, ghi file và đọc dữ liệu riêng (assets/private) → phải chặn:
//  - máy khác trong mạng LAN (bind 127.0.0.1 + kiểm Host),
//  - trang web lạ trong trình duyệt gửi lệnh tới localhost (CSRF: bắt buộc application/json + kiểm Origin),
//  - DNS rebinding (Host phải là loopback),
//  - lộ API key / giọng KOL / văn bản đồng ý qua route /assets/.

const LOOPBACK_NAMES = ['localhost', '127.0.0.1', '[::1]'];

export function isLoopbackHost(hostHeader, port) {
  const h = String(hostHeader || '').trim().toLowerCase();
  return LOOPBACK_NAMES.some((name) => h === `${name}:${port}`);
}

// Kiểm mọi request tới /api/*. allowAnyHost chỉ bật khi người dùng tự mở Dashboard cho mạng LAN (DASHBOARD_HOST).
export function checkApiRequest({ method = 'GET', headers = {}, port, allowAnyHost = false }) {
  const host = String(headers.host || '').trim().toLowerCase();
  if (!allowAnyHost && !isLoopbackHost(host, port)) {
    return { ok: false, status: 403, reason: `Từ chối: Host "${host || '(trống)'}" không phải localhost (chống DNS rebinding).` };
  }
  const m = String(method).toUpperCase();
  if (m === 'OPTIONS') {
    return { ok: false, status: 405, reason: 'Dashboard không nhận request khác nguồn (CORS preflight).' };
  }
  const origin = headers.origin;
  if (origin !== undefined) {
    const allowed = new Set([`http://${host}`, ...LOOPBACK_NAMES.map((n) => `http://${n}:${port}`)]);
    if (!allowed.has(String(origin).toLowerCase())) {
      return { ok: false, status: 403, reason: `Từ chối request từ trang khác (${origin}).` };
    }
  }
  if (m !== 'GET' && m !== 'HEAD') {
    const ct = String(headers['content-type'] || '').toLowerCase();
    if (!ct.startsWith('application/json')) {
      return { ok: false, status: 415, reason: 'API chỉ nhận Content-Type: application/json.' };
    }
  }
  return { ok: true };
}

// Route /assets/<rel>: không phục vụ dữ liệu riêng, cache giọng, cấu hình chứa key và file ẩn.
const BLOCKED_ASSET_ROOTS = new Set(['private', 'voice-cache']);
const BLOCKED_ASSET_FILES = new Set(['brand-kit/ai-config.json']);

export function isServableAssetPath(rel) {
  const norm = String(rel || '').replace(/\\/g, '/').replace(/^\/+/, '').toLowerCase();
  const parts = norm.split('/').filter(Boolean);
  if (!parts.length) return false;
  if (parts.some((p) => p.startsWith('.') || p === '..')) return false;
  if (BLOCKED_ASSET_ROOTS.has(parts[0])) return false;
  if (BLOCKED_ASSET_FILES.has(parts.join('/'))) return false;
  return true;
}

// Cấu hình gửi về trình duyệt: bỏ mọi chuỗi bí mật, giữ lựa chọn model và cờ has* / envStatus (boolean).
const SECRET_KEY_RE = /(api_?key|app_?id|secret|token|password)$/i;

export function publicAiConfig(cfg = {}) {
  const strip = (obj) => {
    const out = {};
    for (const [k, v] of Object.entries(obj || {})) {
      if (typeof v === 'string' && SECRET_KEY_RE.test(k)) continue;
      out[k] = v && typeof v === 'object' && !Array.isArray(v) ? strip(v) : v;
    }
    return out;
  };
  return strip(cfg);
}

// Mã sản phẩm / nhân vật dùng làm tên thư mục: chỉ chữ thường, số, "-" và "_" (chặn ../).
export function safeSlug(value) {
  const s = String(value ?? '').trim().toLowerCase();
  return /^[a-z0-9][a-z0-9_-]{0,63}$/.test(s) ? s : null;
}

// Khớp đúng id <Composition> trong studio/src/Root.tsx
const COMPOSITIONS = { '9x16': 'TikTok-9x16', '1x1': 'Facebook-1x1', '16x9': 'Web-16x9' };

export function remotionCompositionId(ratio) {
  return COMPOSITIONS[ratio] || COMPOSITIONS['9x16'];
}
