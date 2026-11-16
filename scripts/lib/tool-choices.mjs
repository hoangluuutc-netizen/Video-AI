// Danh sách lựa chọn công cụ cho từng hạng mục mới của Gói 7 (chuẩn Gói 6: lựa chọn $0 mặc định đứng đầu).
// Giá trị đầu tiên của mỗi danh sách = mặc định = hành vi cũ.
export const TOOL_CHOICES = {
  subtitleAlignModel: ['heuristic-silence', 'faster-whisper-local', 'voicestudio-whisperx'],
  subtitleStyle: ['box', 'word-highlight'],
  xrayAudioModel: ['none', 'voicestudio-asr', 'demucs-faster-whisper-local']
};

export function normalizeToolChoices(input = {}, current = {}) {
  const out = {};
  for (const [key, allowed] of Object.entries(TOOL_CHOICES)) {
    const v = input[key];
    out[key] = allowed.includes(v) ? v : allowed.includes(current[key]) ? current[key] : allowed[0];
  }
  return out;
}
