import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { readJson } from './lib/prompt-builder.mjs';
import crypto from 'node:crypto';
import { generateAssSubtitles, buildSrtFromWords } from './lib/ass-subtitles.mjs';
import { normalizeViForTts } from './lib/vi-text-normalize.mjs';
import { voiceCacheKey, getCachedVoice, putCachedVoice, getCachedVoiceMeta } from './lib/voice-cache.mjs';
import { isCloneCharacter, assertVoiceConsent } from './lib/kol-consent.mjs';
import { resolveLocalTtsConfig, synthesizeLocalTts, withManagedLocalTts, unloadLocalTts } from './lib/local-tts-client.mjs';
import { alignCampaignWords, detectSpeechBounds, boundsFromRaw } from './lib/word-aligner.mjs';

const ROOT = process.cwd();
const INTERACTIONS_URL = 'https://generativelanguage.googleapis.com/v1beta/interactions';

function loadEnvFile() {
  const envPath = path.join(ROOT, '.env');
  if (!fs.existsSync(envPath)) return;
  const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, '');
    if (key && !process.env[key]) process.env[key] = val;
  }
}

function loadAiConfig() {
  const cfgPath = path.join(ROOT, 'assets', 'brand-kit', 'ai-config.json');
  if (!fs.existsSync(cfgPath)) return {};
  try {
    return JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
  } catch {
    return {};
  }
}

function cleanSpeechText(raw) {
  return String(raw || '')
    .replace(/^\[[^\]]+\]\s*/g, '')
    .replace(/[—–]/g, ', ')
    .trim();
}

async function fetchGeminiTts(text, apiKey, voiceName = 'Kore') {
  const res = await fetch(INTERACTIONS_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': apiKey
    },
    body: JSON.stringify({
      model: 'gemini-3.8-flash-tts',
      input: [
        {
          type: 'user_input',
          content: [
            {
              type: 'text',
              text,
              annotations: [
                {
                  type: 'speech_metadata',
                  style: 'natural, clear, warm Vietnamese presenter voice, realistic pacing'
                }
              ]
            }
          ]
        }
      ],
      response_format: { type: 'audio' },
      generation_config: {
        speech_config: [{ voice: voiceName }]
      }
    })
  });
  if (!res.ok) throw new Error(`Gemini TTS HTTP ${res.status}`);
  const data = await res.json();
  if (data.output_audio?.data) return Buffer.from(data.output_audio.data, 'base64');
  for (const step of data.steps || []) {
    for (const part of step.content || []) {
      if (part.type === 'audio' && part.data) {
        return Buffer.from(part.data, 'base64');
      }
    }
  }
  throw new Error('Không tìm thấy dữ liệu âm thanh từ Gemini TTS');
}

async function fetchVbeeTts(text, { apiKey, appId = '', voiceCode = 'hn_female_ngochuyen_full_48k-fhg' }) {
  const res = await fetch('https://vbee.vn/api/v1/tts', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      app_id: appId || undefined,
      voice_code: voiceCode,
      audio_type: 'mp3',
      bitrate: 128,
      speed_rate: '1.0',
      input_text: text
    })
  });
  if (!res.ok) throw new Error(`Vbee TTS HTTP ${res.status}`);
  const data = await res.json();
  const audioUrl = data?.result?.audio_link || data?.audio_link;
  if (audioUrl) {
    const dl = await fetch(audioUrl);
    if (!dl.ok) throw new Error(`Vbee download HTTP ${dl.status}`);
    return Buffer.from(await dl.arrayBuffer());
  }
  const reqId = data?.result?.request_id || data?.request_id;
  if (!reqId) throw new Error('Vbee TTS không trả về audio_link hoặc request_id');
  for (let i = 0; i < 20; i++) {
    await new Promise((r) => setTimeout(r, 1000));
    const stRes = await fetch(`https://vbee.vn/api/v1/tts/${reqId}`, {
      headers: { Authorization: `Bearer ${apiKey}` }
    });
    if (!stRes.ok) continue;
    const st = await stRes.json();
    const link = st?.result?.audio_link;
    if (link) {
      const dl = await fetch(link);
      if (dl.ok) return Buffer.from(await dl.arrayBuffer());
    }
  }
  throw new Error('Vbee TTS timeout khi chờ audio');
}

async function fetchFptTts(text, { apiKey, voice = 'banmai' }) {
  const res = await fetch('https://api.fpt.ai/hmi/tts/v5', {
    method: 'POST',
    headers: {
      api_key: apiKey,
      voice,
      speed: '0',
      format: 'mp3'
    },
    body: text
  });
  if (!res.ok) throw new Error(`FPT.AI TTS HTTP ${res.status}`);
  const data = await res.json();
  const asyncUrl = data?.async;
  if (!asyncUrl) throw new Error(`FPT.AI TTS không trả về URL async: ${JSON.stringify(data).slice(0, 200)}`);
  for (let i = 0; i < 20; i++) {
    await new Promise((r) => setTimeout(r, 800));
    const dl = await fetch(asyncUrl);
    if (dl.ok) {
      const buf = Buffer.from(await dl.arrayBuffer());
      if (buf.length > 500) return buf;
    }
  }
  throw new Error('FPT.AI TTS timeout khi tải file mp3');
}

async function fetchGoogleTranslateViTts(text) {
  const chunks = [];
  const words = text.split(/\s+/);
  let cur = '';
  for (const w of words) {
    if ((cur + ' ' + w).trim().length > 160) {
      chunks.push(cur.trim());
      cur = w;
    } else {
      cur = (cur + ' ' + w).trim();
    }
  }
  if (cur.trim()) chunks.push(cur.trim());

  const buffers = [];
  for (const chunk of chunks) {
    const url = `https://translate.googleapis.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(chunk)}&tl=vi&client=tw-ob`;
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
      }
    });
    if (!res.ok) throw new Error(`Google TTS HTTP ${res.status}`);
    const arr = await res.arrayBuffer();
    buffers.push(Buffer.from(arr));
  }
  return Buffer.concat(buffers);
}

function generateWindowsSapiOrToneWav(text, outWav, durationSec) {
  try {
    // Thử gọi Windows System.Speech.Synthesis nếu máy có sẵn voice
    const safeText = text.replace(/'/g, "''");
    const safeOut = outWav.replace(/'/g, "''");
    const psScript = `
      Add-Type -AssemblyName System.Speech;
      $synth = New-Object System.Speech.Synthesis.SpeechSynthesizer;
      $voices = $synth.GetInstalledVoices() | Where-Object { $_.VoiceInfo.Culture.Name -like 'vi*' };
      if ($voices.Count -gt 0) { $synth.SelectVoice($voices[0].VoiceInfo.Name) };
      $synth.Rate = 1;
      $synth.SetOutputToWaveFile('${safeOut}');
      $synth.Speak('${safeText}');
      $synth.Dispose();
    `;
    execFileSync('powershell', ['-NoProfile', '-Command', psScript], { stdio: 'ignore' });
    if (fs.existsSync(outWav) && fs.statSync(outWav).size > 1000) {
      return;
    }
  } catch {
    // Fallback sang âm thanh nhạc nền ấm áp bằng ffmpeg
  }
  execFileSync('ffmpeg', [
    '-y', '-v', 'error',
    '-f', 'lavfi', '-i', `sine=frequency=220:duration=${durationSec}`,
    '-f', 'lavfi', '-i', `sine=frequency=330:duration=${durationSec}`,
    '-filter_complex', '[0:a][1:a]amix=inputs=2:duration=shortest,volume=0.18,afade=t=in:st=0:d=0.2,afade=t=out:st=' + Math.max(0.2, durationSec - 0.3) + ':d=0.3',
    '-ar', '48000', '-ac', '2', outWav
  ]);
}

export function computeFitTempo(rawSec, targetSec) {
  const raw = Math.max(0, Number(rawSec || 0));
  const target = Math.max(0.1, Number(targetSec || 1));
  const tempo = Math.round(Math.min(1.15, Math.max(1, raw / target)) * 1000) / 1000;
  const overflowSec = Math.round(Math.max(0, raw / tempo - target) * 1000) / 1000;
  return { tempo, overflowSec };
}

function probeDurationSec(mediaPath) {
  try {
    const out = execFileSync(
      'ffprobe',
      ['-v', 'quiet', '-show_entries', 'format=duration', '-of', 'csv=p=0', mediaPath],
      { encoding: 'utf8' }
    ).trim();
    return parseFloat(out) || 0;
  } catch {
    return 0;
  }
}

function hasCampaignBgm(campaign) {
  if (campaign?.bgmSrc) {
    const abs = path.isAbsolute(campaign.bgmSrc) ? campaign.bgmSrc : path.join(ROOT, campaign.bgmSrc);
    if (fs.existsSync(abs)) return true;
  }
  const musicDir = path.join(ROOT, 'assets', 'music');
  if (!fs.existsSync(musicDir)) return false;
  return fs.readdirSync(musicDir).some((f) => /\.(mp3|wav|m4a|aac)$/i.test(f));
}

function normalizeAndFitAudio(rawMediaPath, finalWavPath, targetDurationSec, { hasBgm = false, sceneId = '' } = {}) {
  const dur = Math.max(1, Number(targetDurationSec || 4));
  const rawSec = probeDurationSec(rawMediaPath) || dur;
  const { tempo, overflowSec } = computeFitTempo(rawSec, dur);
  if (overflowSec > 0) {
    console.warn(`[Cảnh báo thời lượng] Cảnh "${sceneId || path.basename(finalWavPath)}" bị tràn ~${overflowSec}s sau khi tăng tốc ${tempo}x — nên rút gọn lời thoại.`);
  }

  const tempoFilter = tempo > 1 ? `atempo=${tempo},` : '';
  const fadeFilter = overflowSec > 0 ? `,afade=t=out:st=${Math.max(0.05, dur - 0.12).toFixed(2)}:d=0.12` : '';

  if (hasBgm) {
    execFileSync('ffmpeg', [
      '-y', '-v', 'error',
      '-i', rawMediaPath,
      '-af', `${tempoFilter}aresample=48000,aformat=sample_fmts=fltp:channel_layouts=stereo,apad=whole_dur=${dur},atrim=0:${dur}${fadeFilter}`,
      '-ar', '48000', '-ac', '2', finalWavPath
    ]);
  } else {
    execFileSync('ffmpeg', [
      '-y', '-v', 'error',
      '-i', rawMediaPath,
      '-f', 'lavfi', '-i', `sine=frequency=196:duration=${dur}`,
      '-filter_complex',
      `[0:a]${tempoFilter}aresample=48000,aformat=sample_fmts=fltp:channel_layouts=stereo,apad=whole_dur=${dur}[v];` +
      `[1:a]volume=0.025,afade=t=in:st=0:d=0.3,afade=t=out:st=${Math.max(0.1, dur - 0.4)}:d=0.4[bg];` +
      `[v][bg]amix=inputs=2:duration=first:dropout_transition=0:normalize=0,atrim=0:${dur}${fadeFilter}`,
      '-ar', '48000', '-ac', '2', finalWavPath
    ]);
  }
  return Math.min(dur, Math.round((rawSec / tempo) * 1000) / 1000);
}

const LOCAL_TTS_ENGINES = new Set(['voicestudio-voxcpm2', 'sidecar-voxcpm2']);
const ENGINE_LABELS = {
  'voicestudio-voxcpm2': 'VoiceStudio · VoxCPM2',
  'sidecar-voxcpm2': 'VoxCPM2 Sidecar',
  'vbee-vi': 'Vbee TTS',
  'fpt-vi': 'FPT.AI TTS',
  'google-vi-natural': 'Giọng Việt Tự Nhiên',
  'windows-sapi-vi': 'Local Voice/Audio',
  'existing-wav': 'Giữ giọng đã tạo'
};

function readJsonSafe(p, fallback) {
  try {
    return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : fallback;
  } catch {
    return fallback;
  }
}

function fileHash(p) {
  try {
    return crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex').slice(0, 16);
  } catch {
    return '';
  }
}

// Gói 7 — T9: thứ tự engine thử cho 1 chiến dịch.
// KOL người thật (mode "clone") chỉ được dùng engine local, không lặng lẽ thay giọng khác vào mặt KOL.
export function pickVoiceRoute({ ttsModel = 'google-vi-natural', character = null, allowGenericVoice = false } = {}) {
  if (isCloneCharacter(character)) {
    const local = `${character.voiceProfile.provider === 'sidecar' ? 'sidecar' : 'voicestudio'}-voxcpm2`;
    return allowGenericVoice
      ? { engines: [local, 'google-vi-natural', 'windows-sapi-vi'], mustBeLocal: false }
      : { engines: [local], mustBeLocal: true };
  }
  // Giữ hành vi cũ: chọn Windows SAPI thì vẫn thử Google trước, SAPI là đường cuối
  if (ttsModel === 'windows-sapi-vi') return { engines: ['google-vi-natural', 'windows-sapi-vi'], mustBeLocal: false };
  return { engines: [...new Set([ttsModel, 'google-vi-natural', 'windows-sapi-vi'])], mustBeLocal: false };
}

// Đo vùng tiếng nói trên FILE THÔ (trước khi trộn âm nền), rồi chuẩn hóa/khớp thời lượng
function fitAndMeasure(rawPath, finalWav, dur, opts) {
  const rawSec = probeDurationSec(rawPath) || dur;
  const { tempo } = computeFitTempo(rawSec, dur);
  const rawBounds = detectSpeechBounds(rawPath, { totalSec: rawSec });
  const speechSec = normalizeAndFitAudio(rawPath, finalWav, dur, opts);
  return { speechSec, ...boundsFromRaw(rawBounds, tempo, dur) };
}

// manageLocalTts=false: lô theo pha tự bật/tắt TTS local 1 lần cho cả lô (scripts/lib/phased-batch.mjs)
export async function generateCampaignVoiceover(
  campaignPath,
  { allowGenericVoice = process.argv.includes('--allow-generic-voice'), manageLocalTts = true } = {}
) {
  loadEnvFile();
  const aiCfg = loadAiConfig();
  const campaign = readJson(campaignPath);
  const campaignDir = path.dirname(campaignPath);
  const audioDir = path.join(campaignDir, 'media', 'audio');
  fs.mkdirSync(audioDir, { recursive: true });

  const ttsEngine = aiCfg.ttsModel || process.env.TTS_MODEL || 'google-vi-natural';
  const geminiKey = aiCfg.geminiApiKey || process.env.GEMINI_API_KEY || '';
  const vbeeKey = aiCfg.vbeeApiKey || process.env.VBEE_API_KEY || '';
  const vbeeAppId = aiCfg.vbeeAppId || process.env.VBEE_APP_ID || '';
  const fptKey = aiCfg.fptApiKey || process.env.FPT_API_KEY || '';

  const character = readJsonSafe(path.join(ROOT, 'assets', 'characters', campaign.characterId || '', 'character.json'), {});
  const product = readJsonSafe(path.join(ROOT, 'assets', 'products', campaign.productId || '', 'product.json'), {});
  // Gói 7 — T8: KOL người thật → chặn cứng nếu thiếu / hết hạn / đã thu hồi / sai ngành hàng
  assertVoiceConsent({ character, product });

  const route = pickVoiceRoute({ ttsModel: ttsEngine, character, allowGenericVoice });
  const localEngine = route.engines.find((e) => LOCAL_TTS_ENGINES.has(e));
  const localCfg = localEngine
    ? resolveLocalTtsConfig({ ...aiCfg, localTts: { ...(aiCfg.localTts || {}), provider: localEngine.startsWith('sidecar') ? 'sidecar' : 'voicestudio' } })
    : null;
  const vp = character.voiceProfile || {};
  const refAudioHash = vp.referenceAudio ? fileHash(path.join(ROOT, vp.referenceAudio)) : '';
  const bgmPresent = hasCampaignBgm(campaign);
  const voiceIdFor = (engine) =>
    LOCAL_TTS_ENGINES.has(engine) ? vp.voiceId || character.id || 'default' : aiCfg.vbeeVoice || aiCfg.fptVoice || aiCfg.ttsVoice || 'default';

  // Trả đường dẫn file thô, hoặc null nếu engine không khả dụng (thiếu key / chưa hỗ trợ)
  async function synthRaw(engine, spoken, rawBase, dur) {
    let buf = null;
    let ext = 'mp3';
    if (engine === 'vbee-vi') {
      if (!vbeeKey) return null;
      buf = await fetchVbeeTts(spoken, { apiKey: vbeeKey, appId: vbeeAppId, voiceCode: aiCfg.vbeeVoice || undefined });
    } else if (engine === 'fpt-vi') {
      if (!fptKey) return null;
      buf = await fetchFptTts(spoken, { apiKey: fptKey, voice: aiCfg.fptVoice || 'banmai' });
    } else if (engine.startsWith('gemini')) {
      if (!geminiKey) return null;
      buf = await fetchGeminiTts(spoken, geminiKey, aiCfg.ttsVoice || 'Kore');
    } else if (engine === 'google-vi-natural') {
      buf = await fetchGoogleTranslateViTts(spoken);
    } else if (LOCAL_TTS_ENGINES.has(engine)) {
      buf = await synthesizeLocalTts(spoken, { cfg: localCfg, voiceProfile: { ...vp, characterId: character.id }, root: ROOT });
      ext = 'wav';
    } else if (engine === 'windows-sapi-vi') {
      const p = `${rawBase}.wav`;
      generateWindowsSapiOrToneWav(spoken, p, dur);
      return p;
    } else {
      return null;
    }
    const p = `${rawBase}.${ext}`;
    fs.writeFileSync(p, buf);
    return p;
  }

  const sceneWavs = [];
  const manifest = [];
  let usedGeneric = false;

  const runScenes = async () => {
    for (const scene of campaign.scenes) {
      const text = cleanSpeechText(scene.subtitle || campaign.hookText || 'Sản phẩm chính hãng chất lượng cao');
      const { spoken, tokens } = normalizeViForTts(text);
      const dur = Math.max(1, Number(scene.durationSec || 4));
      const wordCount = text.split(/\s+/).filter(Boolean).length;
      const maxWords = Math.round(dur * 2.8);
      if (wordCount > maxWords) {
        console.warn(`[Cảnh báo nhịp thoại] Cảnh "${scene.id}" (${dur}s) có ${wordCount} từ (khuyên dùng <= ${maxWords} từ để không bị đọc vội).`);
      }
      const finalWav = path.join(audioDir, `${scene.id}.wav`);
      const rawBase = path.join(audioDir, `_raw-${scene.id}`);
      const steps = route.mustBeLocal ? [...route.engines] : route.engines.flatMap((e) => (e === 'windows-sapi-vi' ? ['existing-wav', e] : [e]));

      let result = null;
      for (const engine of steps) {
        const label = ENGINE_LABELS[engine] || engine;
        if (engine === 'existing-wav') {
          if (fs.existsSync(finalWav) && fs.statSync(finalWav).size > 15000) {
            result = { engine, cacheKey: '', speechSec: probeDurationSec(finalWav) || dur };
            console.log(`OK [${label}] Cảnh "${scene.id}" (${dur}s)`);
            break;
          }
          continue;
        }
        const isLocal = LOCAL_TTS_ENGINES.has(engine);
        const cacheKey = voiceCacheKey({
          engine,
          model: isLocal ? localCfg.model : engine,
          voiceId: voiceIdFor(engine),
          text: spoken,
          refAudioHash: isLocal ? refAudioHash : ''
        });
        const cachedPath = getCachedVoice(cacheKey);
        if (cachedPath) {
          fs.copyFileSync(cachedPath, finalWav);
          const meta = getCachedVoiceMeta(cacheKey) || {};
          result = { engine, cacheKey, fromCache: true, speechSec: meta.speechSec ?? (probeDurationSec(finalWav) || dur), speechStart: meta.speechStart, speechEnd: meta.speechEnd };
          console.log(`[Cache] Cảnh "${scene.id}" (${dur}s) — ${label}`);
          break;
        }
        try {
          const rawPath = await synthRaw(engine, spoken, rawBase, dur);
          if (!rawPath) continue;
          const fit = fitAndMeasure(rawPath, finalWav, dur, { hasBgm: bgmPresent, sceneId: scene.id });
          fs.rmSync(rawPath, { force: true });
          putCachedVoice(cacheKey, fs.readFileSync(finalWav), { characterId: campaign.characterId, meta: fit });
          result = { engine, cacheKey, ...fit };
          console.log(`OK [${label}] Cảnh "${scene.id}" (${dur}s)`);
          break;
        } catch (e) {
          console.warn(`[${label} lỗi → thử engine tiếp] Cảnh "${scene.id}": ${e.message}`);
        }
      }

      if (!result) {
        throw new Error(
          route.mustBeLocal
            ? `Không sinh được giọng KOL "${character.id}" bằng ${ENGINE_LABELS[route.engines[0]]} (cảnh "${scene.id}"). Kiểm tra VoiceStudio đang chạy với engine VoxCPM2, hoặc chạy lại với --allow-generic-voice để dùng giọng tạm (video sẽ gắn nhãn "GIỌNG TẠM").`
            : `Không sinh được giọng cho cảnh "${scene.id}".`
        );
      }
      if (isCloneCharacter(character) && !LOCAL_TTS_ENGINES.has(result.engine)) usedGeneric = true;

      scene.audioSrc = path.posix.join('media', 'audio', `${scene.id}.wav`);
      sceneWavs.push(finalWav);
      manifest.push({
        sceneId: scene.id,
        wav: scene.audioSrc,
        text,
        spoken,
        tokens,
        engine: result.fromCache ? `${result.engine} (cache)` : result.engine,
        cacheKey: result.cacheKey,
        speechSec: result.speechSec,
        ...(Number.isFinite(result.speechStart) && Number.isFinite(result.speechEnd)
          ? { speechStart: result.speechStart, speechEnd: result.speechEnd }
          : {})
      });
    }
  };

  if (localCfg && manageLocalTts) {
    try {
      await withManagedLocalTts(localCfg, runScenes);
    } finally {
      await unloadLocalTts(localCfg).catch(() => false);
    }
  } else {
    await runScenes();
  }

  // Nối toàn bộ thành voiceover-full.mp3 để nghe thử trên trình duyệt
  const concatList = path.join(audioDir, 'concat-audio.txt');
  fs.writeFileSync(concatList, sceneWavs.map((w) => `file '${w.replace(/\\/g, '/')}'`).join('\n') + '\n', 'utf8');
  const fullMp3 = path.join(audioDir, 'voiceover-full.mp3');
  execFileSync('ffmpeg', ['-y', '-v', 'error', '-f', 'concat', '-safe', '0', '-i', concatList, '-c:a', 'libmp3lame', '-b:a', '192k', fullMp3]);

  const manifestPath = path.join(audioDir, 'voice-manifest.json');
  const manifestTmp = `${manifestPath}.tmp-${process.pid}`;
  fs.writeFileSync(manifestTmp, JSON.stringify(manifest, null, 2) + '\n', 'utf8');
  fs.renameSync(manifestTmp, manifestPath);

  // Gói 7 — T10/T11: căn thời gian từng từ → SRT theo cụm từ + ASS (highlight từng từ nếu bật)
  const aligned = await alignCampaignWords(campaignDir, { model: aiCfg.subtitleAlignModel || 'heuristic-silence', root: ROOT });
  const wordsByScene = Object.fromEntries(aligned.map((x) => [x.sceneId, x.words]));
  const subtitleStyle = (campaign.subtitleStyle || aiCfg.subtitleStyle) === 'word-highlight' ? 'word-highlight' : 'box';

  const srtPath = path.join(audioDir, 'subtitles.srt');
  fs.writeFileSync(srtPath, buildSrtFromWords(campaign.scenes, wordsByScene), 'utf8');
  const assPath = path.join(audioDir, 'subtitles.ass');
  generateAssSubtitles(campaign.scenes, assPath, {
    width: 1080,
    height: 1920,
    wordsByScene: subtitleStyle === 'word-highlight' ? wordsByScene : null
  });

  if (usedGeneric) {
    campaign.voiceIsGeneric = true;
    console.warn(`[KOL] Đã dùng GIỌNG TẠM cho "${character.id}" (--allow-generic-voice) — video sẽ gắn nhãn "GIỌNG TẠM".`);
  } else {
    delete campaign.voiceIsGeneric;
  }
  campaign.voiceoverSrc = 'media/audio/voiceover-full.mp3';
  campaign.subtitlesSrtSrc = 'media/audio/subtitles.srt';
  campaign.subtitlesAssSrc = 'media/audio/subtitles.ass';
  campaign.subtitlesWordsSrc = 'media/audio/words.json';
  const campTmp = `${campaignPath}.tmp-${process.pid}`;
  fs.writeFileSync(campTmp, JSON.stringify(campaign, null, 2) + '\n', 'utf8');
  fs.renameSync(campTmp, campaignPath);
  console.log(`Đã tạo xong giọng đọc tại: ${path.relative(ROOT, fullMp3)} & phụ đề: .srt / .ass (căn từ: ${aligned[0]?.source || 'không có'})`);
  return { fullMp3, srtPath, assPath, manifestPath, sceneWavs };
}

if (import.meta.url === `file:///${process.argv[1].replace(/\\/g, '/')}` || process.argv[1]?.endsWith('generate-voiceover.mjs')) {
  const arg = process.argv[2] || 'campaigns/sample-campaign/campaign.json';
  const abs = path.isAbsolute(arg) ? arg : path.join(ROOT, arg);
  generateCampaignVoiceover(abs).catch((e) => {
    console.error('LỖI tạo giọng đọc:', e.message);
    process.exit(1);
  });
}
