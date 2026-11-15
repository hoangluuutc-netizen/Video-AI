// Gemini REST client (Interactions API + Files API) — không cần cài SDK.
import fs from 'node:fs';
import path from 'node:path';

const BASE = 'https://generativelanguage.googleapis.com';
export const DEFAULT_MODEL = process.env.GEMINI_MODEL || 'gemini-4-hydrogen';
export const MODEL_CHOICES = [
  { id: 'gemini-4-hydrogen', label: 'Gemini 4 Hydrogen — cân bằng, khuyên dùng' },
  { id: 'gemini-4-argon', label: 'Gemini 4 Argon — suy luận sâu hơn' },
  { id: 'gemini-4-carbon', label: 'Gemini 4 Carbon — mạnh nhất, chậm & đắt hơn' },
  { id: 'gemini-3.5-flash-lite', label: 'Gemini 3.5 Flash-Lite — nhanh & rẻ nhất' }
];

const MIME = { '.mp4': 'video/mp4', '.webm': 'video/webm', '.mov': 'video/quicktime', '.mkv': 'video/x-matroska', '.m4v': 'video/mp4' };

async function http(url, opts, label) {
  const res = await fetch(url, opts);
  if (!res.ok) {
    let detail = '';
    try { detail = await res.text(); } catch { /* ignore */ }
    throw new Error(`${label} thất bại (HTTP ${res.status}): ${detail.slice(0, 500)}`);
  }
  return res;
}

export async function uploadVideo(apiKey, filePath, { onStage = () => {} } = {}) {
  const stat = fs.statSync(filePath);
  const mime = MIME[path.extname(filePath).toLowerCase()] || 'video/mp4';
  onStage('upload-start');
  const start = await http(`${BASE}/upload/v1beta/files`, {
    method: 'POST',
    headers: {
      'x-goog-api-key': apiKey,
      'X-Goog-Upload-Protocol': 'resumable',
      'X-Goog-Upload-Command': 'start',
      'X-Goog-Upload-Header-Content-Length': String(stat.size),
      'X-Goog-Upload-Header-Content-Type': mime,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ file: { display_name: path.basename(filePath) } })
  }, 'Khởi tạo upload');
  const uploadUrl = start.headers.get('x-goog-upload-url');
  if (!uploadUrl) throw new Error('Không nhận được upload URL từ Gemini Files API.');
  onStage('upload-data');
  const up = await http(uploadUrl, {
    method: 'POST',
    headers: { 'Content-Length': String(stat.size), 'X-Goog-Upload-Offset': '0', 'X-Goog-Upload-Command': 'upload, finalize' },
    body: fs.readFileSync(filePath)
  }, 'Tải video lên');
  const info = await up.json();
  const file = info.file;
  onStage('processing');
  for (let i = 0; i < 90; i++) {
    const r = await http(`${BASE}/v1beta/${file.name}`, { headers: { 'x-goog-api-key': apiKey } }, 'Kiểm tra trạng thái file');
    const st = await r.json();
    if (st.state === 'ACTIVE') return { uri: st.uri || file.uri, mimeType: mime, name: file.name };
    if (st.state === 'FAILED') throw new Error('Gemini xử lý video thất bại (state=FAILED).');
    await new Promise((res) => setTimeout(res, 3000));
  }
  throw new Error('Hết thời gian chờ Gemini xử lý video.');
}

export function extractText(interaction) {
  const steps = interaction?.steps || [];
  const texts = [];
  for (const s of steps) {
    if (s.type !== 'model_output') continue;
    for (const c of s.content || []) if (c.type === 'text' && c.text) texts.push(c.text);
  }
  if (!texts.length && interaction?.output_text) texts.push(interaction.output_text);
  return texts.join('');
}

export async function generateJson(apiKey, { model = DEFAULT_MODEL, input, schema, systemInstruction }) {
  const body = {
    model,
    input,
    store: false,
    response_format: { type: 'text', mime_type: 'application/json', schema }
  };
  if (systemInstruction) body.system_instruction = systemInstruction;
  const res = await http(`${BASE}/v1beta/interactions`, {
    method: 'POST',
    headers: { 'x-goog-api-key': apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  }, `Gọi ${model}`);
  const data = await res.json();
  const text = extractText(data);
  try {
    return JSON.parse(text);
  } catch {
    const m = text.match(/\{[\s\S]*\}/);
    if (m) return JSON.parse(m[0]);
    throw new Error('Gemini không trả về JSON hợp lệ: ' + text.slice(0, 300));
  }
}
