// Ollama REST client (Local LLM) — mặc định http://127.0.0.1:11434, tương thích qwen3.5:9b.
const DEFAULT_OLLAMA_URL = process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434';
export const DEFAULT_OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'qwen3.5:9b';

export function normalizeOllamaModel(model) {
  if (!model) return DEFAULT_OLLAMA_MODEL;
  return String(model).replace(/^ollama:/i, '').trim() || DEFAULT_OLLAMA_MODEL;
}

export async function listOllamaModels(baseUrl = DEFAULT_OLLAMA_URL) {
  const res = await fetch(`${baseUrl.replace(/\/$/, '')}/api/tags`);
  if (!res.ok) throw new Error(`Ollama /api/tags HTTP ${res.status}`);
  const data = await res.json();
  return (data.models || []).map((m) => m.name);
}

export async function listLoadedOllamaModels({ baseUrl = DEFAULT_OLLAMA_URL } = {}) {
  try {
    const res = await fetch(`${baseUrl.replace(/\/$/, '')}/api/ps`);
    if (!res.ok) return [];
    const data = await res.json();
    return (data.models || []).map((m) => ({
      name: m.name,
      size: Number(m.size || 0),
      size_vram: Number(m.size_vram || 0)
    }));
  } catch {
    return [];
  }
}

export async function unloadOllamaModels({ baseUrl = DEFAULT_OLLAMA_URL, timeoutMs = 15000 } = {}) {
  const cleanBase = baseUrl.replace(/\/$/, '');
  const loaded = await listLoadedOllamaModels({ baseUrl: cleanBase });
  if (loaded.length === 0) return [];

  const names = loaded.map((m) => m.name).filter(Boolean);
  for (const name of names) {
    try {
      await fetch(`${cleanBase}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: name, keep_alive: 0 })
      });
    } catch {
      // Bỏ qua nếu Ollama đã tắt giữa chừng
    }
  }

  const deadline = Date.now() + Math.max(0, timeoutMs);
  while (Date.now() < deadline) {
    const remaining = await listLoadedOllamaModels({ baseUrl: cleanBase });
    if (remaining.length === 0) break;
    await new Promise((r) => setTimeout(r, 500));
  }
  return names;
}

export async function generateOllamaJson({
  model = DEFAULT_OLLAMA_MODEL,
  prompt,
  schema,
  systemInstruction = 'Bạn là đạo diễn video quảng cáo TMĐT tại Việt Nam. Luôn trả lời đúng định dạng JSON được yêu cầu.',
  baseUrl = DEFAULT_OLLAMA_URL,
  keepAlive = process.env.OLLAMA_KEEP_ALIVE || '2m',
  numCtx = Number(process.env.OLLAMA_NUM_CTX) || 8192
}) {
  const cleanModel = normalizeOllamaModel(model);
  const url = `${baseUrl.replace(/\/$/, '')}/api/chat`;
  const body = {
    model: cleanModel,
    stream: false,
    think: false,
    keep_alive: keepAlive,
    format: schema || 'json',
    options: { temperature: 0.4, num_ctx: numCtx },
    messages: [
      { role: 'system', content: systemInstruction },
      { role: 'user', content: prompt }
    ]
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`Ollama HTTP ${res.status}: ${errText.slice(0, 300)}`);
  }

  const data = await res.json();
  const text = data?.message?.content || data?.response || '';
  try {
    return JSON.parse(text);
  } catch {
    const m = text.match(/\{[\s\S]*\}/);
    if (m) return JSON.parse(m[0]);
    throw new Error(`Ollama (${cleanModel}) không trả về JSON hợp lệ: ${text.slice(0, 250)}`);
  }
}
