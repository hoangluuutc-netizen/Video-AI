import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { generateOllamaJson, normalizeOllamaModel } from './ollama-client.mjs';
import { generateJson, DEFAULT_MODEL } from './gemini-client.mjs';

const ROOT = process.cwd();

function slugifyId(raw) {
  return String(raw || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48) || `kol-${Date.now().toString().slice(-6)}`;
}

function findExistingFile(pathsObj = {}) {
  for (const val of Object.values(pathsObj || {})) {
    if (!val || typeof val !== 'string') continue;
    const abs = path.isAbsolute(val) ? val : path.join(ROOT, val);
    if (fs.existsSync(abs) && !fs.statSync(abs).isDirectory()) return abs;
  }
  return '';
}

export function listInstalledSkills() {
  const skillsDir = path.join(ROOT, '.agents', 'skills');
  if (!fs.existsSync(skillsDir)) return [];
  const entries = fs.readdirSync(skillsDir, { withFileTypes: true }).filter((d) => d.isDirectory());
  return entries.map((dir) => {
    const skillPath = path.join(skillsDir, dir.name, 'SKILL.md');
    let name = dir.name;
    let description = '';
    if (fs.existsSync(skillPath)) {
      const raw = fs.readFileSync(skillPath, 'utf8');
      const fmMatch = raw.match(/^---\s*\r?\n([\s\S]*?)\r?\n---/);
      if (fmMatch) {
        const nameLine = fmMatch[1].match(/^name:\s*(.+)$/m);
        const descLine = fmMatch[1].match(/^description:\s*(.+)$/m);
        if (nameLine) name = nameLine[1].trim().replace(/^["']|["']$/g, '');
        if (descLine) description = descLine[1].trim().replace(/^["']|["']$/g, '');
      }
    }
    return {
      id: dir.name,
      name,
      description,
      path: path.posix.join('.agents', 'skills', dir.name, 'SKILL.md')
    };
  });
}

export function saveKolCharacter(payload = {}, { root = ROOT } = {}) {
  const id = slugifyId(payload.id || payload.name);
  if (!/^[a-z0-9-]+$/.test(id)) {
    throw new Error('ID KOL không hợp lệ.');
  }
  const charDir = path.join(root, 'assets', 'characters', id);
  fs.mkdirSync(charDir, { recursive: true });
  const charPath = path.join(charDir, 'character.json');
  const existing = fs.existsSync(charPath) ? JSON.parse(fs.readFileSync(charPath, 'utf8')) : {};

  const traits = Array.isArray(payload.immutableTraits)
    ? payload.immutableTraits.map((t) => String(t).trim()).filter(Boolean)
    : String(payload.immutableTraits || '')
        .split(/\r?\n/)
        .map((t) => t.trim())
        .filter(Boolean);

  if (traits.length === 0) {
    throw new Error('Cần ít nhất 1 đặc điểm khóa ngoại hình (immutableTraits).');
  }

  const record = {
    ...existing,
    id,
    name: String(payload.name || existing.name || id).trim(),
    role: String(payload.role || existing.role || 'KOL AI Review & Trải nghiệm sản phẩm').trim(),
    niche: String(payload.niche || existing.niche || 'general').trim(),
    immutableTraits: traits,
    voiceStyle: String(payload.voiceStyle || existing.voiceStyle || 'Tự nhiên, rõ ràng, tốc độ vừa phải').trim(),
    catchphrase: String(payload.catchphrase || existing.catchphrase || '').trim(),
    platforms: Array.isArray(payload.platforms) && payload.platforms.length > 0
      ? payload.platforms
      : (existing.platforms || ['TikTok', 'Shopee', 'Facebook']),
    referenceImages: {
      ...(existing.referenceImages || {}),
      ...(payload.referenceImages || {})
    }
  };

  fs.writeFileSync(charPath, JSON.stringify(record, null, 2) + '\n', 'utf8');
  return { ok: true, character: record, relPath: path.posix.join('assets', 'characters', id, 'character.json') };
}

const NICHE_TEMPLATES = {
  beauty: {
    role: 'Chuyên gia Review Mỹ Phẩm & Skincare Thực Tế',
    voiceStyle: 'Nhẹ nhàng, chân thật, truyền cảm, nhấn mạnh trải nghiệm da thật',
    catchphrase: 'Test thật 7 ngày trên da nhạy cảm, đây là sự thật mọi người cần biết...',
    traits: [
      'Vietnamese woman, 24 years old, glowing natural skin, friendly warm smile',
      'Shoulder-length straight dark brown hair with soft curtain bangs',
      'Wearing a clean pastel cream knit top with minimal pearl stud earrings',
      'Soft natural daylight beauty lighting, crisp facial detail'
    ]
  },
  tech: {
    role: 'Reviewer Công Nghệ & Thiết Bị Thông Minh Tối Giản',
    voiceStyle: 'Rõ ràng, dứt khoát, logic, tốc độ nhanh vừa phải',
    catchphrase: 'Đừng mua món này nếu bạn chưa xem hết 3 điểm thực tế sau...',
    traits: [
      'Vietnamese young adult, 26 years old, sharp confident eyes, clean modern look',
      'Neat modern hairstyle, natural skin texture',
      'Wearing a minimalist charcoal crew-neck t-shirt under an open overshirt',
      'Clean desk studio lighting with subtle warm rim light'
    ]
  },
  home: {
    role: 'KOL Gia Dụng Thông Minh & Mẹo Sống Tiện Nghi',
    voiceStyle: 'Gần gũi, vui vẻ, năng lượng tích cực như người bạn chia sẻ mẹo hay',
    catchphrase: 'Nhà gọn hơn hẳn chỉ nhờ 1 món nhỏ xíu này nè mọi người ơi...',
    traits: [
      'Vietnamese woman, 28 years old, approachable warm expression, bright eyes',
      'Low neat ponytail with soft face-framing strands',
      'Wearing a comfortable sage green linen shirt in a cozy modern apartment',
      'Bright natural home daylight, authentic lifestyle vibe'
    ]
  },
  fashion: {
    role: 'Fashion & Mix-Match Stylist GenZ',
    voiceStyle: 'Trẻ trung, bắt trend nhanh, giàu năng lượng, nhấn nhá cuốn hút',
    catchphrase: '1 item mà phối được tận 4 kiểu đi làm lẫn đi chơi luôn nè...',
    traits: [
      'Vietnamese woman, 23 years old, stylish confident posture, expressive smile',
      'Sleek dark hair, clean modern editorial makeup',
      'Wearing an oversized tailored beige blazer over white crop tee',
      'Crisp natural street-style daylight, clean composition'
    ]
  }
};

export async function generateKolPersona({ idea = '', niche = 'beauty', aiConfig = {}, apiKey = '' } = {}) {
  const useOllama = String(aiConfig.llmModel || '').startsWith('ollama:');
  const prompt = `Hãy thiết kế 1 hồ sơ KOL AI chuyên nghiệp cho thương mại điện tử Việt Nam dựa trên ý tưởng: "${idea || 'KOL nữ review sản phẩm uy tín'}", ngành hàng: "${niche}".
Trả về JSON gồm: id (slug tiếng Anh không dấu), name (tên Việt + danh xưng ngắn), role (vai trò chuyên môn), niche, voiceStyle (mô tả giọng nói tiếng Việt), catchphrase (câu mở đầu 3s đầu), platforms (mảng ["TikTok","Shopee","Facebook"]), immutableTraits (mảng 4 chuỗi tiếng Anh mô tả ngoại hình cố định: khuôn mặt/tuổi, kiểu tóc, trang phục, ánh sáng).`;

  if (useOllama) {
    try {
      const model = normalizeOllamaModel(aiConfig.llmModel);
      const data = await generateOllamaJson({ model, prompt });
      if (data && data.name && Array.isArray(data.immutableTraits)) {
        return { ...data, id: slugifyId(data.id || data.name), engine: `ollama:${model}` };
      }
    } catch {
      // Fallback sang Rule Engine nội bộ
    }
  } else if (apiKey && aiConfig.llmModel && aiConfig.llmModel !== 'local-ecommerce-director') {
    try {
      const data = await generateJson(apiKey, {
        model: aiConfig.llmModel || DEFAULT_MODEL,
        input: prompt
      });
      if (data && data.name && Array.isArray(data.immutableTraits)) {
        return { ...data, id: slugifyId(data.id || data.name), engine: aiConfig.llmModel };
      }
    } catch {
      // Fallback sang Rule Engine nội bộ
    }
  }

  const tpl = NICHE_TEMPLATES[niche] || NICHE_TEMPLATES.beauty;
  const cleanIdea = String(idea || '').trim();
  const baseName = cleanIdea ? cleanIdea.split(/[,.]/)[0].slice(0, 28) : 'Hà My';
  return {
    id: slugifyId(baseName),
    name: cleanIdea ? `${baseName} (KOL AI)` : 'Hà My (KOL Review)',
    role: tpl.role,
    niche,
    voiceStyle: tpl.voiceStyle,
    catchphrase: tpl.catchphrase,
    platforms: ['TikTok', 'Shopee', 'Facebook'],
    immutableTraits: tpl.traits,
    engine: 'local-kol-architect ($0)'
  };
}

export async function generateKolScript({ character = {}, product = null, topic = '', platform = 'TikTok', durationSec = 25, aiConfig = {}, apiKey = '' } = {}) {
  const maxWords = Math.max(20, Math.round(Number(durationSec || 25) * 2.6));
  const prodName = product ? product.name : (topic || 'sản phẩm nổi bật hôm nay');
  const highlights = product && Array.isArray(product.highlights) ? product.highlights.slice(0, 2).join(', ') : 'chất lượng vượt mong đợi, dễ dùng hằng ngày';
  const traitsStr = Array.isArray(character.immutableTraits) ? character.immutableTraits.join(', ') : 'Vietnamese KOL creator';

  const useOllama = String(aiConfig.llmModel || '').startsWith('ollama:');
  const prompt = `Bạn là đạo diễn KOL AI. Hãy viết kịch bản nói cho KOL "${character.name || 'KOL AI'}" (${character.role || 'Reviewer'}) trên nền tảng ${platform}, thời lượng ${durationSec} giây (tổng số từ lời thoại <= ${maxWords} từ).
Chủ đề/Sản phẩm: ${prodName}. Điểm nổi bật: ${highlights}. Câu cửa miệng: "${character.catchphrase || ''}".
Trả về JSON: { "hook": "...", "body": "...", "cta": "...", "caption": "...", "hashtags": ["#..."] }.`;

  let parsed = null;
  let engine = 'local-kol-director ($0)';

  if (useOllama) {
    try {
      const model = normalizeOllamaModel(aiConfig.llmModel);
      parsed = await generateOllamaJson({ model, prompt });
      engine = `ollama:${model}`;
    } catch {
      parsed = null;
    }
  } else if (apiKey && aiConfig.llmModel && aiConfig.llmModel !== 'local-ecommerce-director') {
    try {
      parsed = await generateJson(apiKey, { model: aiConfig.llmModel || DEFAULT_MODEL, input: prompt });
      engine = aiConfig.llmModel;
    } catch {
      parsed = null;
    }
  }

  if (!parsed || !parsed.hook) {
    const hook = character.catchphrase
      ? character.catchphrase
      : `Mọi người ơi, mình vừa test thử ${prodName} và thật sự bất ngờ luôn.`;
    const body = `Điểm mình thích nhất ở ${prodName} là ${highlights}. Dùng hằng ngày cực kỳ gọn nhẹ, đúng gu của mình luôn á.`;
    const cta = `Ai đang cần tìm giải pháp chuẩn chỉnh thì bấm vào giỏ hàng bên dưới để xem ưu đãi hôm nay nha!`;
    parsed = {
      hook,
      body,
      cta,
      caption: `${hook} ✨ Trải nghiệm thực tế cùng ${character.name || 'KOL AI'}.`,
      hashtags: ['#KOLAI', '#ReviewThat', '#TikTokShop', '#XuHuong']
    };
  }

  const fullVoiceover = `${parsed.hook} ${parsed.body} ${parsed.cta}`.replace(/\s+/g, ' ').trim();
  const wordCount = fullVoiceover.split(/\s+/).filter(Boolean).length;
  const estimatedSec = Number((wordCount / 2.6).toFixed(1));
  const veoLipSyncPrompt = `Medium close-up 9:16 vertical 60fps ultra-sharp video of ${traitsStr}. Strictly preserve exact facial identity from reference chart. Looking directly into the camera lens, speaking clearly in Vietnamese with tightly synchronized lip movement matching each spoken syllable, natural micro-blinks, smooth fluid head and hand gestures: "${parsed.hook}". Soft even studio daylight, crisp skin pores, studio-grade voice audio, zero background noise.`;

  return {
    ...parsed,
    fullVoiceover,
    wordCount,
    maxWords,
    estimatedSec,
    veoLipSyncPrompt,
    engine
  };
}

export async function renderKolTalkingVideo({ character, product = null, voiceText = '', hookTitle = '', durationSec = 15, subtitleStyle = 'word-highlight' } = {}) {
  if (!character || !character.id) {
    throw new Error('Chưa chọn hồ sơ KOL AI.');
  }
  const campId = `kol-${character.id}`;
  const campDir = path.join(ROOT, 'campaigns', campId);
  const mediaDir = path.join(campDir, 'media');
  const audioDir = path.join(mediaDir, 'audio');
  const outDir = path.join(campDir, 'out');
  fs.mkdirSync(audioDir, { recursive: true });
  fs.mkdirSync(outDir, { recursive: true });

  const portraitAbs = findExistingFile(character.referenceImages);
  if (!portraitAbs) {
    throw new Error(`KOL "${character.name}" chưa có ảnh chân dung. Hãy tải ảnh lên trước!`);
  }
  const productAbs = product ? findExistingFile(product.referenceImages) : '';

  const text = String(voiceText || character.catchphrase || `Xin chào, mình là ${character.name}.`).trim();
  const estDur = Math.max(6, Math.min(45, Math.ceil(text.split(/\s+/).length / 2.5) + 1));
  const dur = Number(durationSec) > 0 ? Math.max(estDur, Number(durationSec)) : estDur;

  const tempCampPath = path.join(campDir, 'campaign.json');
  const tempCampaign = {
    id: campId,
    title: `KOL AI Talking: ${character.name}`,
    productId: product?.id || 'sample-product',
    characterId: character.id,
    hook: hookTitle || text.slice(0, 60),
    subtitleStyle,
    voiceover: text,
    scenes: [
      { id: 'scene-1', type: 'real-product-closeup', durationSec: dur, caption: hookTitle || character.name, voiceover: text, qcStatus: 'approved' }
    ]
  };
  fs.writeFileSync(tempCampPath, JSON.stringify(tempCampaign, null, 2) + '\n', 'utf8');

  // Sinh giọng đọc + phụ đề .srt/.ass bằng script sẵn có của hệ thống
  const campRel = path.posix.join('campaigns', campId, 'campaign.json');
  execFileSync('node', ['scripts/generate-voiceover.mjs', campRel], { cwd: ROOT, stdio: 'pipe' });

  const voiceCandidates = [
    path.join(audioDir, 'voiceover-full.mp3'),
    path.join(audioDir, 'scene-1.wav'),
    path.join(audioDir, 'voiceover.wav')
  ];
  const voiceWav = voiceCandidates.find((p) => fs.existsSync(p)) || '';
  const assPath = path.join(audioDir, 'subtitles.ass');
  const outFilename = `kol-talking-${Date.now()}.mp4`;
  const outMp4 = path.join(outDir, outFilename);

  // Kiểm tra thời lượng audio thực tế bằng ffprobe
  let finalDur = dur;
  if (voiceWav) {
    try {
      const probe = execFileSync('ffprobe', [
        '-v', 'error', '-show_entries', 'format=duration', '-of', 'default=noprint_wrappers=1:nokey=1', voiceWav
      ], { encoding: 'utf8' }).trim();
      const audioDur = parseFloat(probe);
      if (Number.isFinite(audioDur) && audioDur > 1) finalDur = Math.ceil(audioDur + 0.6);
    } catch {
      // giữ finalDur
    }
  }

  const targetFps = 60;
  const totalFrames = Math.max(60, Math.round(finalDur * targetFps));
  const bgBlurPng = path.join(mediaDir, 'bg-blur.png');
  execFileSync('ffmpeg', [
    '-y', '-v', 'error', '-i', portraitAbs,
    '-vf', 'scale=1080:1920:flags=lanczos:force_original_aspect_ratio=increase,crop=1080:1920,boxblur=36:6',
    '-frames:v', '1', bgBlurPng
  ], { cwd: ROOT, stdio: 'pipe' });

  const inputs = [
    '-y', '-v', 'error',
    '-loop', '1', '-t', String(finalDur), '-i', bgBlurPng,
    '-loop', '1', '-t', String(finalDur), '-i', portraitAbs
  ];
  let filter = `[1:v]scale=1200:2134:flags=lanczos:force_original_aspect_ratio=increase,crop=1200:2134,zoompan=z='min(zoom+0.00022,1.06)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${totalFrames}:s=1080x1920:fps=${targetFps},unsharp=5:5:0.8:3:3:0.4[fg];`;
  filter += `[0:v][fg]overlay=(W-w)/2:(H-h)/2[base]`;
  let lastLabel = 'base';

  if (productAbs) {
    inputs.push('-loop', '1', '-t', String(finalDur), '-i', productAbs);
    filter += `;[2:v]scale=320:320:flags=lanczos:force_original_aspect_ratio=decrease,unsharp=5:5:0.6:3:3:0.2[prod];[${lastLabel}][prod]overlay=W-w-44:H-h-240[withprod]`;
    lastLabel = 'withprod';
  }

  if (subtitleStyle === 'word-highlight' && fs.existsSync(assPath)) {
    const escapedAss = assPath.replace(/\\/g, '/').replace(/:/g, '\\:');
    filter += `;[${lastLabel}]ass='${escapedAss}'[vout]`;
    lastLabel = 'vout';
  }

  const audioIdx = productAbs ? 3 : 2;
  if (voiceWav) {
    inputs.push('-i', voiceWav);
  }

  const args = [
    ...inputs,
    '-filter_complex', filter,
    '-map', `[${lastLabel}]`
  ];
  if (voiceWav) {
    args.push('-map', `${audioIdx}:a`, '-af', 'aresample=async=1:first_pts=0', '-c:a', 'aac', '-b:a', '192k', '-shortest');
  }
  args.push('-c:v', 'libx264', '-preset', 'veryfast', '-crf', '19', '-pix_fmt', 'yuv420p', '-r', String(targetFps), '-fps_mode', 'cfr', '-movflags', '+faststart', '-t', String(finalDur), outMp4);

  execFileSync('ffmpeg', args, { cwd: ROOT, stdio: 'pipe' });

  // Dọn các file video cũ nếu không bị trình duyệt giữ lock
  for (const f of fs.readdirSync(outDir)) {
    if (f.startsWith('kol-talking-') && f !== outFilename) {
      try { fs.unlinkSync(path.join(outDir, f)); } catch {}
    }
  }

  let integrity = { ok: fs.existsSync(outMp4), width: 1080, height: 1920, fps: targetFps, hasAudio: Boolean(voiceWav), durationSec: finalDur };
  try {
    const probeJson = execFileSync('ffprobe', [
      '-v', 'error', '-show_entries', 'stream=codec_type,width,height,r_frame_rate', '-show_entries', 'format=duration', '-of', 'json', outMp4
    ], { encoding: 'utf8' });
    const parsed = JSON.parse(probeJson);
    const vStream = (parsed.streams || []).find((s) => s.codec_type === 'video');
    const aStream = (parsed.streams || []).find((s) => s.codec_type === 'audio');
    const [num, den] = String(vStream?.r_frame_rate || '60/1').split('/').map(Number);
    integrity = {
      ok: Boolean(vStream && vStream.width === 1080 && vStream.height === 1920),
      width: vStream?.width || 0,
      height: vStream?.height || 0,
      fps: den ? Math.round(num / den) : targetFps,
      hasAudio: Boolean(aStream),
      durationSec: Number(parseFloat(parsed.format?.duration || finalDur).toFixed(2))
    };
  } catch {
    // Giữ integrity mặc định
  }

  const voiceRel = voiceWav ? path.relative(path.join(ROOT, 'campaigns', campId), voiceWav).replace(/\\/g, '/') : '';
  return {
    ok: true,
    campaignId: campId,
    videoUrl: `/campaigns/${campId}/out/${outFilename}`,
    audioUrl: voiceRel ? `/campaigns/${campId}/${voiceRel}?t=${Date.now()}` : '',
    assUrl: fs.existsSync(assPath) ? `/campaigns/${campId}/media/audio/subtitles.ass?t=${Date.now()}` : '',
    durationSec: finalDur,
    integrity
  };
}
