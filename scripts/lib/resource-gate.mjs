import os from 'node:os';
import { unloadOllamaModels } from './ollama-client.mjs';

export function getFreeMemoryGb() {
  return Math.round((os.freemem() / (1024 ** 3)) * 100) / 100;
}

export async function ensureFreeMemory({
  minFreeGb = 2,
  label = 'tác vụ nặng',
  waitMs = 20000,
  pollMs = 2000,
  freeMemFn = getFreeMemoryGb
} = {}) {
  const deadline = Date.now() + Math.max(0, waitMs);
  let lastFree = Number(freeMemFn());
  while (lastFree < minFreeGb && Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, pollMs));
    lastFree = Number(freeMemFn());
  }
  if (lastFree < minFreeGb) {
    throw new Error(`Không đủ RAM cho ${label}: cần ${minFreeGb} GB, còn ${lastFree} GB.`);
  }
  return lastFree;
}

export async function prepareForHeavyPhase({
  label = 'tác vụ nặng',
  minFreeGb = 2,
  ollamaBaseUrl = process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434'
} = {}) {
  const unloaded = await unloadOllamaModels({ baseUrl: ollamaBaseUrl });
  console.log(
    `[Tài nguyên] Đã giải phóng Ollama: ${unloaded.length ? unloaded.join(', ') : 'không có model đang nạp'}`
  );
  const freeGb = await ensureFreeMemory({ minFreeGb, label });
  console.log(`[Tài nguyên] RAM trống cho ${label}: ${freeGb} GB (ngưỡng ${minFreeGb} GB)`);
  return { unloaded, freeGb };
}
