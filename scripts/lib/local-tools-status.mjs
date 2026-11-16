// Trạng thái sẵn sàng của các công cụ local (Gói 7 — Task 9) để Dashboard làm xám lựa chọn chưa dùng được.
import { resolveLocalTtsConfig, checkLocalTts, assertCommercialSafeEngine } from './local-tts-client.mjs';
import { findSpeechPython } from './word-aligner.mjs';
import { hasFfmpegFilter, detectVideoEncoder } from './ffmpeg-encoder.mjs';

let ffmpegCaps = null;

export async function getLocalToolsStatus(aiCfg = {}, { root = process.cwd() } = {}) {
  const lt = aiCfg.localTts || {};
  const vsCfg = resolveLocalTtsConfig({ ...aiCfg, localTts: { ...lt, provider: 'voicestudio' } });
  const scCfg = resolveLocalTtsConfig({ ...aiCfg, localTts: { ...lt, provider: 'sidecar', baseUrl: lt.sidecarUrl || 'http://127.0.0.1:3901' } });
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
    voicestudio: { ok: vs.ok && commercialSafe, reachable: vs.ok, engine: vs.engine, detail: vs.ok ? engineNote || vs.detail : `Chưa chạy (${vsCfg.baseUrl}) — cần Task 0` },
    sidecar: { ok: sc.ok, detail: sc.ok ? 'sẵn sàng' : 'Chưa chạy (chỉ dùng khi Task 0 chọn phương án dự phòng)' },
    speechPython: Boolean(findSpeechPython({ root })),
    ...ffmpegCaps
  };
}
