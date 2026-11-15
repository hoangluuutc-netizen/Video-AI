// Nhân bản kịch bản từ video mẫu sang sản phẩm của bạn (7 ngành hàng, 5 phong cách, đếm từ ~2.8 từ/giây).
import { generateJson } from './gemini-client.mjs';

export const STYLE_PRESETS = {
  'ugc-iphone': { label: 'UGC chân thực (quay điện thoại, ánh sáng tự nhiên)', prompt: 'authentic UGC look, shot on a modern smartphone, handheld micro-shake, natural window light, real home environment, slightly imperfect framing' },
  'cinematic': { label: 'Điện ảnh (tone ấm, xoá phông, ánh sáng kịch tính)', prompt: 'cinematic commercial look, warm grade, shallow depth of field, anamorphic bokeh, dramatic rim light, 24fps film texture' },
  'luxury': { label: 'Sang trọng tối giản (studio, slow-motion)', prompt: 'premium luxury product film, minimal set, soft diffused studio light, glossy reflections, smooth slow-motion, elegant negative space' },
  'fast-viral': { label: 'Nhanh dồn dập (cắt 0.5–1.2s, zoom giật)', prompt: 'high-energy viral edit style, punchy snap zooms, fast whip pans, bold saturated colors, dynamic angles' },
  'funny': { label: 'Hài hước phóng đại (màu rực, biểu cảm mạnh)', prompt: 'playful comedic tone, vivid colors, exaggerated facial expressions, bouncy camera moves, cartoon-like energy' }
};

export const CATEGORY_PRESETS = {
  'tech': 'Công nghệ & phụ kiện',
  'beauty': 'Làm đẹp & chăm sóc da',
  'fashion': 'Thời trang & phụ kiện',
  'home': 'Gia dụng & đời sống',
  'food': 'Ăn uống & F&B',
  'education': 'Giáo dục & khoá học',
  'other': 'Khác'
};

export const ENGINE_NOTES = {
  veo: 'Veo 3.1 (Ingredients-to-Video: đính kèm ảnh sản phẩm thật + ảnh nhân vật)',
  omni: 'Gemini Omni 1.2 Flash (3–15s, first-frame/first-last-frame, reference images)',
  kling: 'Kling (Image-to-Video / Elements)',
  sora: 'Sora'
};

const PURPOSE_VI = {
  hook: 'Hook', problem: 'Nỗi đau', agitate: 'Khoét sâu', solution: 'Giải pháp', demo: 'Trình diễn', proof: 'Bằng chứng',
  benefit: 'Lợi ích', 'social-proof': 'Khách review', offer: 'Ưu đãi', cta: 'Kêu gọi', transition: 'Chuyển cảnh', other: 'Khác'
};
export const purposeLabel = (p) => PURPOSE_VI[p] || p;

const FIDELITY_LOCK = 'The product must match the attached reference image exactly: same shape, proportions, colors, logo, label text and materials. Do not redesign, distort or add text to the packaging. Keep camera motion gentle around the product.';

export function inferPurposes(n) {
  if (n <= 1) return ['hook'];
  if (n === 2) return ['hook', 'cta'];
  if (n === 3) return ['hook', 'demo', 'cta'];
  const middle = ['problem', 'solution', 'demo', 'proof', 'benefit', 'social-proof'];
  const out = ['hook'];
  for (let i = 0; i < n - 2; i++) out.push(middle[Math.min(middle.length - 1, Math.floor((i / (n - 2)) * middle.length))]);
  out.push('cta');
  return out;
}

export function wordsFor(sec) {
  return Math.max(4, Math.round(sec * 2.8));
}

export function templateRemake(xray, breakdown, product) {
  const style = STYLE_PRESETS[product.style] || STYLE_PRESETS['ugc-iphone'];
  const shots = (breakdown?.shots?.length ? breakdown.shots : xray.shots) || [];
  const purposes = breakdown?.shots?.length ? shots.map((s) => s.purpose) : inferPurposes(shots.length);
  const name = product.name || 'sản phẩm';
  const usp = (product.usp || '').split(/[,;\n]/).map((s) => s.trim()).filter(Boolean);
  const pain = product.pain || `vấn đề thường gặp khi chưa có ${name}`;
  const lines = {
    hook: `Đừng mua ${name} khi chưa xem video này!`,
    problem: `Bạn có hay gặp cảnh ${pain} không?`,
    agitate: `Càng để lâu càng tốn tiền, tốn thời gian.`,
    solution: `Đây là ${name} — giải pháp mình đang dùng mỗi ngày.`,
    demo: `Nhìn này: ${usp[0] || 'dùng cực kỳ đơn giản'}.`,
    proof: `${usp[1] || usp[0] || 'Chất lượng thật'} — kiểm chứng ngay trước mắt.`,
    benefit: `${usp[2] || usp[0] || 'Tiện lợi'} giúp bạn nhẹ nhàng hơn hẳn.`,
    'social-proof': `Hàng nghìn khách đã mua lại lần hai.`,
    offer: product.offer || `Hôm nay đang có ưu đãi riêng.`,
    cta: product.offer ? `${product.offer} — bấm giỏ hàng ngay!` : `Bấm vào giỏ hàng để nhận ưu đãi hôm nay!`,
    transition: '', other: ''
  };
  const out = shots.map((s, i) => {
    const purpose = purposes[i] || 'other';
    const ref = breakdown?.shots?.[i];
    const shotType = ref?.shotType || (purpose === 'hook' ? 'extreme close-up' : purpose === 'cta' ? 'medium shot' : 'close-up');
    const camera = ref?.cameraMovement || (purpose === 'hook' ? 'fast push-in' : 'slow push-in');
    const action = ref?.subjectAction ? `mirroring the reference action: ${ref.subjectAction}` : `presenter interacting with ${name}`;
    const vo = lines[purpose] || '';
    const dur = Number((s.end - s.start).toFixed(2));
    const visual = `${shotType}, ${camera}. ${action}, now featuring "${name}"${product.category ? ` (${CATEGORY_PRESETS[product.category] || product.category})` : ''}. ${style.prompt}. Vertical 9:16.`;
    return {
      index: i + 1,
      start: s.start,
      end: s.end,
      durationSec: dur,
      purpose,
      shotType,
      cameraMovement: camera,
      visualPrompt: `${visual} ${FIDELITY_LOCK}`,
      omniPrompt: `${dur <= 3 ? 'A 3-second' : `A ${Math.min(15, Math.max(3, Math.round(dur)))}-second`} vertical clip. ${visual} Use the first attached image as the exact product reference. ${FIDELITY_LOCK}`,
      voiceoverVi: vo,
      maxWords: wordsFor(dur),
      onScreenTextVi: purpose === 'hook' ? (product.hookText || lines.hook) : purpose === 'cta' ? (product.offer || 'Mua ngay') : (usp[i % Math.max(1, usp.length)] || ''),
      sfx: purpose === 'hook' ? 'whoosh + bass hit' : purpose === 'cta' ? 'ding / cash register' : 'subtle swoosh',
      fidelityNote: purpose === 'demo' || purpose === 'proof' ? 'Nên dùng ẢNH/CLIP SẢN PHẨM THẬT ở cảnh này (Zero-AI-Pixel).' : 'Có thể dùng AI, khoá sản phẩm bằng ảnh tham chiếu.'
    };
  });
  return {
    engine: 'template',
    title: `Nhân bản: ${name}`,
    hookVariants: [lines.hook, `3 lý do ${name} đang cháy hàng`, `Mình đã thử ${name} trong 7 ngày và...`],
    caption: `${name} — ${usp.slice(0, 2).join(', ')} ✨`,
    hashtags: ['#review', '#tiktokshop', '#xuhuong', `#${name.replace(/\s+/g, '').toLowerCase().slice(0, 20)}`],
    shots: out
  };
}

const REMAKE_SCHEMA = {
  type: 'object',
  properties: {
    title: { type: 'string' },
    hookVariants: { type: 'array', items: { type: 'string' }, description: '3 câu hook tiếng Việt thay thế' },
    caption: { type: 'string' },
    hashtags: { type: 'array', items: { type: 'string' } },
    shots: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          index: { type: 'integer' },
          start: { type: 'number' },
          end: { type: 'number' },
          durationSec: { type: 'number' },
          purpose: { type: 'string' },
          shotType: { type: 'string' },
          cameraMovement: { type: 'string' },
          visualPrompt: { type: 'string', description: 'Prompt tiếng Anh cho Veo 3.1 / Kling, mô tả chủ thể, hành động, góc máy, ánh sáng, phong cách, tỉ lệ 9:16' },
          omniPrompt: { type: 'string', description: 'Prompt tiếng Anh cho Gemini Omni Flash, nói rõ ảnh tham chiếu đầu tiên là sản phẩm thật' },
          voiceoverVi: { type: 'string', description: 'Lời thoại tiếng Việt, tối đa ~2.8 từ/giây' },
          onScreenTextVi: { type: 'string' },
          sfx: { type: 'string' },
          fidelityNote: { type: 'string', description: 'Lưu ý chống sai lệch sản phẩm cho cảnh này (tiếng Việt)' }
        },
        required: ['index', 'start', 'end', 'durationSec', 'purpose', 'visualPrompt', 'omniPrompt', 'voiceoverVi', 'onScreenTextVi']
      }
    }
  },
  required: ['title', 'hookVariants', 'shots', 'caption']
};

export async function aiRemake(apiKey, { model, xray, breakdown, product }) {
  const style = STYLE_PRESETS[product.style] || STYLE_PRESETS['ugc-iphone'];
  const ref = breakdown?.shots?.length ? breakdown.shots : xray.shots;
  const text = `Dựng lại video quảng cáo cho sản phẩm của tôi, GIỮ NGUYÊN số cảnh, thời lượng từng cảnh, vai trò và nhịp của video mẫu.

SẢN PHẨM:
- Tên: ${product.name}
- Ngành: ${CATEGORY_PRESETS[product.category] || product.category || ''}
- Điểm bán hàng (USP): ${product.usp || ''}
- Nỗi đau khách hàng: ${product.pain || ''}
- Ưu đãi / giá: ${product.offer || ''}
- Khách hàng mục tiêu: ${product.audience || ''}
- Phong cách hình ảnh: ${style.label} → ${style.prompt}
- Model tạo video chính: ${ENGINE_NOTES[product.engine] || ENGINE_NOTES.veo}

PHÂN TÍCH VIDEO MẪU:
${JSON.stringify({ framework: breakdown?.framework, hook: breakdown?.hook, winningFormula: breakdown?.winningFormula, pacing: xray.pacing, shots: ref }, null, 1)}

YÊU CẦU:
- Lời thoại và chữ trên màn hình bằng tiếng Việt tự nhiên, đúng giới hạn số từ theo thời lượng cảnh.
- Prompt hình ảnh bằng tiếng Anh, luôn kèm ràng buộc: "${FIDELITY_LOCK}"
- Không sao chép nguyên văn lời thoại của video mẫu; chỉ học cấu trúc.
- Cảnh trình diễn/bằng chứng nên khuyến nghị dùng clip/ảnh sản phẩm thật.`;
  const res = await generateJson(apiKey, { model, input: text, schema: REMAKE_SCHEMA });
  res.engine = model;
  for (const s of res.shots || []) s.maxWords = wordsFor(s.durationSec || (s.end - s.start));
  return res;
}

export function toCampaign(job, { productId = 'sample-product', characterId = 'sample-kol' } = {}) {
  const { remake, product } = job;
  const slug = (product?.name || 'nhan-ban').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/gi, 'd').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'nhan-ban';
  const typeOf = (p) => (p === 'cta' || p === 'offer') ? 'offer-cta' : (p === 'demo' || p === 'proof') ? 'real-product-closeup' : (p === 'benefit' || p === 'solution' || p === 'social-proof') ? 'ai-experience' : 'ai-lifestyle';
  const scenes = (remake?.shots || []).map((s) => ({
    id: `scene-${s.index}-${s.purpose}`,
    type: typeOf(s.purpose),
    durationSec: Math.max(1, Math.round(s.durationSec * 10) / 10),
    subtitle: s.onScreenTextVi || '',
    voiceover: s.voiceoverVi || '',
    visualAction: s.visualPrompt,
    veo3Prompt: s.visualPrompt,
    omniFlashR2VPrompt: s.omniPrompt,
    setting: STYLE_PRESETS[product?.style]?.label || '',
    referenceTiming: { start: s.start, end: s.end },
    qcStatus: 'pending'
  }));
  return {
    id: `xray-${slug}`,
    title: `Nhân bản từ video mẫu — ${product?.name || ''}`,
    productId,
    characterId,
    platforms: ['tiktok', 'shopee', 'facebook'],
    hookText: remake?.shots?.[0]?.onScreenTextVi || remake?.hookVariants?.[0] || '',
    ctaText: remake?.shots?.[remake.shots.length - 1]?.onScreenTextVi || product?.offer || '',
    mode: 'hybrid',
    source: { tool: 'giai-phau-video', jobId: job.id, analyzedAt: job.xray?.analyzedAt, pacing: job.xray?.pacing },
    scenes
  };
}
