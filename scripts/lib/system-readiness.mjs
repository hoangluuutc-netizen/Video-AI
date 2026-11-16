export function buildSystemReadiness({
  toolsStatus = {},
  aiConfig = {},
  counts = {},
  studioInstalled = false,
  musicCount = 0
} = {}) {
  const es = aiConfig.envStatus || {};
  const hasAnyPaidTts = Boolean(es.VBEE_API_KEY || es.FPT_API_KEY || es.ELEVENLABS_API_KEY || aiConfig.hasVbeeKey || aiConfig.hasFptKey);
  const hasAnyCloudAi = Boolean(es.GEMINI_API_KEY || es.FAL_KEY || aiConfig.hasGeminiKey || aiConfig.hasFalKey);

  const items = [
    {
      id: 'ffmpeg',
      label: 'FFmpeg + QSV + libass',
      ready: Boolean(toolsStatus.libass),
      level: toolsStatus.libass ? 'ok' : 'warn',
      detail: toolsStatus.qsv ? 'h264_qsv + ASS sẵn sàng' : (toolsStatus.libass ? 'libx264 + ASS sẵn sàng' : 'Thiếu libass')
    },
    {
      id: 'speech-python',
      label: 'faster-whisper local',
      ready: Boolean(toolsStatus.speechPython),
      level: toolsStatus.speechPython ? 'ok' : 'warn',
      detail: toolsStatus.speechPython ? 'tools/speech/.venv sẵn sàng' : 'Chưa cài Python speech'
    },
    {
      id: 'remotion',
      label: 'Remotion Studio',
      ready: Boolean(studioInstalled),
      level: studioInstalled ? 'ok' : 'warn',
      detail: studioInstalled ? 'studio/node_modules sẵn sàng' : 'Chưa npm install trong studio/'
    },
    {
      id: 'assets',
      label: 'Tài sản & KOL AI',
      ready: Number(counts.products || 0) > 0 && Number(counts.characters || 0) > 0,
      level: (Number(counts.products || 0) > 0 && Number(counts.characters || 0) > 0) ? 'ok' : 'warn',
      detail: `${counts.products || 0} SP • ${counts.characters || 0} KOL • ${counts.campaigns || 0} chiến dịch`
    },
    {
      id: 'tts-keys',
      label: 'Giọng Việt Vbee/FPT (.env)',
      ready: hasAnyPaidTts,
      level: hasAnyPaidTts ? 'ok' : 'optional',
      detail: hasAnyPaidTts ? 'Đã cấu hình key TTS Việt' : 'Đang dùng $0 (google-vi-natural) — điền key để nâng cấp'
    },
    {
      id: 'cloud-keys',
      label: 'Cloud AI Gemini/Fal (.env)',
      ready: hasAnyCloudAi,
      level: hasAnyCloudAi ? 'ok' : 'optional',
      detail: hasAnyCloudAi ? 'Đã cấu hình key Cloud AI' : 'Đang chạy $0 Local — điền key nếu dùng Veo/FLUX'
    },
    {
      id: 'music',
      label: 'Nhạc nền Auto-Ducking',
      ready: Number(musicCount || 0) > 0,
      level: Number(musicCount || 0) > 0 ? 'ok' : 'optional',
      detail: Number(musicCount || 0) > 0 ? `${musicCount} bài trong assets/music/` : 'Thả .mp3 vào assets/music/ để tự trộn nhạc nền'
    }
  ];

  const coreItems = items.filter((i) => i.level !== 'optional' || i.ready);
  const readyCount = items.filter((i) => i.ready).length;
  const coreReady = items.filter((i) => i.level === 'ok').length;
  const coreTotal = items.filter((i) => i.level !== 'optional').length || 1;

  return {
    items,
    readyCount,
    totalCount: items.length,
    corePercent: Math.round((coreReady / coreTotal) * 100)
  };
}
