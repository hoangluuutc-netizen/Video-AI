// Trạng thái sẵn sàng của các công cụ local (Gói 7 — Task 9) để Dashboard làm xám lựa chọn chưa dùng được.
import { resolveLocalTtsConfig, checkLocalTts, assertCommercialSafeEngine } from './local-tts-client.mjs';
import { findSpeechPython } from './word-aligner.mjs';
import { hasFfmpegFilter, detectVideoEncoder } from './ffmpeg-encoder.mjs';

let ffmpegCaps = null;

export async function getLocalToolsStatus(aiCfg = {}, { root = process.cwd() } = {}) {
  const lt = aiCfg.localTts || {};
  const vsCfg = resolveLocalTtsConfig({ ...aiCfg, localTts: { ...lt, provider: 'voicestudio' } });
  const scCfg = resolveLocalTtsConfig({ ...aiCfg, localTts: { ...lt, provider: 'sidecar', baseUrl: lt.sidecarUrl || 'http://127.0.0.1:3911' } });
  const [vs, sc] = await Promise.all([checkLocalTts(vsCfg), checkLocalTts(scCfg)]);
  let commercialSafe = false;
  let engineNote = '';
  if (vs.ok) {
    try {
      assertCommercialSafeEngine(vs.engine);
      commercialSafe = true;
    } catch (e) {
      engineNote = e.message;
    }
  }
  if (!ffmpegCaps) ffmpegCaps = { libass: hasFfmpegFilter('ass'), qsv: detectVideoEncoder().name === 'h264_qsv' };
  return {
    voicestudio: { ok: vs.ok && commercialSafe, reachable: vs.ok, engine: vs.engine, detail: vs.ok ? engineNote || vs.detail : `Không dùng (${vsCfg.baseUrl}) — đã chốt Hướng 1 (Vbee/FPT)` },
    sidecar: { ok: sc.ok, detail: sc.ok ? 'sẵn sàng' : 'Chưa chạy (dự phòng cho TTS local nhẹ sau này)' },
    speechPython: Boolean(findSpeechPython({ root })),
    ...ffmpegCaps
  };
}
