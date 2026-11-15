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

export async function generateOllamaJson({
  model = DEFAULT_OLLAMA_MODEL,
  prompt,
  schema,
  systemInstruction = 'Bạn là đạo diễn video quảng cáo TMĐT tại Việt Nam. Luôn trả lời đúng định dạng JSON được yêu cầu.',
  baseUrl = DEFAULT_OLLAMA_URL
}) {
  const cleanModel = normalizeOllamaModel(model);
  const url = `${baseUrl.replace(/\/$/, '')}/api/chat`;
  const body = {
    model: cleanModel,
    stream: false,
    think: false,
    format: schema || 'json',
    options: { temperature: 0.4 },
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
