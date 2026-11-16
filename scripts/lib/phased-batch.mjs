// Chạy lô theo PHA (Gói 7 — Task 9): mỗi model chỉ nạp 1 lần cho cả lô, đỡ tranh RAM/CPU trên máy không GPU rời.
// Pha 1 (phân tích video mẫu) chạy trước khi gọi hàm này.
// Pha 2 prompts → [giải phóng Ollama] → Pha 3 giọng (TTS local bật 1 lần) → Pha 5 dựng → Pha 6 kiểm định + Sổ Vận Hành.
// SKU lỗi ở pha nào thì dừng SKU đó, các SKU khác vẫn chạy tiếp.
export async function runPhasedPipeline(campPaths, deps) {
  let alive = [...campPaths];
  const failed = [];

  async function phase(name, fn) {
    const next = [];
    for (const c of alive) {
      try {
        await fn(c);
        next.push(c);
      } catch (e) {
        failed.push({ id: c, phase: name, error: e?.message || String(e) });
        console.error(`[Lô theo pha] "${c}" lỗi ở pha ${name}: ${e?.message || e}`);
      }
    }
    alive = next;
  }

  await phase('prompts', deps.prompts);
  if (deps.beforeVoice) await deps.beforeVoice();
  const voiceAll = () => phase('voice', deps.voice);
  if (deps.withTts) await deps.withTts(voiceAll);
  else await voiceAll();
  await phase('render', deps.render);
  await phase('verify', deps.verify);
  await phase('record', deps.record);
  return { ok: alive, failed };
}
