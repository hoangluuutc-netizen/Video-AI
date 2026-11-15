// "Giải phẫu" sâu bằng Gemini: đọc video + mốc cắt cảnh thật từ ffmpeg → bảng phân tích từng cảnh.
import { generateJson } from './gemini-client.mjs';

const SHOT_SCHEMA = {
  type: 'object',
  properties: {
    index: { type: 'integer' },
    start: { type: 'number' },
    end: { type: 'number' },
    purpose: { type: 'string', enum: ['hook', 'problem', 'agitate', 'solution', 'demo', 'proof', 'benefit', 'social-proof', 'offer', 'cta', 'transition', 'other'] },
    shotType: { type: 'string', description: 'Cỡ cảnh: extreme close-up, close-up, medium, wide, POV, overhead, macro...' },
    cameraMovement: { type: 'string', description: 'static, handheld, push-in, pull-out, pan, tilt, orbit, whip-pan, tracking...' },
    angle: { type: 'string' },
    lighting: { type: 'string' },
    subjectAction: { type: 'string', description: 'Ai/cái gì đang làm gì trong khung hình (tiếng Việt)' },
    onScreenText: { type: 'string', description: 'Chữ xuất hiện trên màn hình, chép nguyên văn; rỗng nếu không có' },
    voiceover: { type: 'string', description: 'Lời thoại/thuyết minh trong cảnh, chép nguyên văn ngôn ngữ gốc' },
    sfxMusic: { type: 'string' },
    transitionOut: { type: 'string' },
    retentionTrick: { type: 'string', description: 'Thủ thuật giữ chân người xem trong cảnh này (tiếng Việt)' }
  },
  required: ['index', 'start', 'end', 'purpose', 'shotType', 'cameraMovement', 'subjectAction', 'onScreenText', 'voiceover', 'retentionTrick']
};

export const BREAKDOWN_SCHEMA = {
  type: 'object',
  properties: {
    summary: { type: 'string', description: 'Tóm tắt nội dung video 2-3 câu (tiếng Việt)' },
    productOrTopic: { type: 'string' },
    targetAudience: { type: 'string' },
    framework: { type: 'string', description: 'Khung kịch bản nhận diện được: AIDA, PAS, Before-After-Bridge, Problem-Demo-CTA, Storytelling, Listicle...' },
    tone: { type: 'string' },
    language: { type: 'string' },
    hook: {
      type: 'object',
      properties: {
        type: { type: 'string', description: 'Loại hook: câu hỏi, gây sốc, nỗi đau, kết quả trước, phản trực giác, thử thách, giá sốc...' },
        visual: { type: 'string' },
        line: { type: 'string', description: 'Câu hook nguyên văn' },
        whyItWorks: { type: 'string' }
      },
      required: ['type', 'visual', 'line', 'whyItWorks']
    },
    musicStyle: { type: 'string' },
    visualStyle: { type: 'string', description: 'Phong cách hình ảnh tổng thể: màu, ánh sáng, chất liệu quay (iPhone UGC, studio, cinematic...)' },
    cta: { type: 'string' },
    shots: { type: 'array', items: SHOT_SCHEMA },
    winningFormula: { type: 'array', items: { type: 'string' }, description: '3-6 nguyên tắc có thể sao chép để làm video tương tự (tiếng Việt)' },
    weaknesses: { type: 'array', items: { type: 'string' }, description: 'Điểm yếu có thể làm tốt hơn (tiếng Việt)' }
  },
  required: ['summary', 'framework', 'hook', 'shots', 'winningFormula', 'visualStyle', 'cta']
};

const SYSTEM = `Bạn là chuyên gia "giải phẫu" video ngắn quảng cáo (TikTok, Reels, Shorts) cho thương mại điện tử Việt Nam.
Nhiệm vụ: phân tích pháp y (forensic breakdown) từng cảnh để người dùng có thể dựng lại cấu trúc video với sản phẩm của họ.
Quy tắc:
- Trả lời bằng tiếng Việt, riêng thuật ngữ quay phim (shot type, camera movement) có thể giữ tiếng Anh.
- Chép NGUYÊN VĂN chữ trên màn hình và lời thoại, không bịa. Nếu không nghe/thấy rõ, để chuỗi rỗng.
- Bám sát các mốc cắt cảnh được cung cấp (đã đo bằng ffmpeg). Mỗi mốc là 1 phần tử trong "shots", giữ nguyên start/end.`;

export function buildForensicPrompt(xray) {
  const lines = (xray?.shots || []).map((s) => `#${s.index}: ${s.start.toFixed(2)}s → ${s.end.toFixed(2)}s (${s.duration}s)`);
  const shotList = lines.length ? lines.join('\n') : '(Không có mốc ffmpeg — hãy tự chia cảnh theo các lần cắt hình.)';
  return `Giải phẫu video này theo từng cảnh.
Thông số đo được: thời lượng ${xray?.meta?.durationSec ?? '?'}s, tỉ lệ ${xray?.meta?.aspect ?? '?'}, ${xray?.pacing?.shotCount ?? '?'} cảnh, trung bình ${xray?.pacing?.avgShotSec ?? '?'}s/cảnh${xray?.audio?.bpm ? `, nhịp nhạc ~${xray.audio.bpm.value} BPM` : ''}.
Các mốc cắt cảnh:
${shotList}`;
}

export async function aiBreakdown(apiKey, { model, videoRef, xray }) {
  const input = [
    { type: 'video', uri: videoRef.uri, ...(videoRef.mimeType ? { mime_type: videoRef.mimeType } : {}) },
    { type: 'text', text: buildForensicPrompt(xray) }
  ];
  return generateJson(apiKey, { model, input, schema: BREAKDOWN_SCHEMA, systemInstruction: SYSTEM });
}
