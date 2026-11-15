import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { readJson } from './lib/prompt-builder.mjs';
import { generateAssSubtitles } from './lib/ass-subtitles.mjs';

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

function normalizeAndFitAudio(rawMediaPath, finalWavPath, targetDurationSec) {
  // Chuẩn hóa sang 48kHz stereo WAV, trộn thêm âm nền ấm rất nhẹ để giọng đọc tự nhiên và khớp đúng thời lượng cảnh
  const dur = Math.max(1, Number(targetDurationSec || 4));
  execFileSync('ffmpeg', [
    '-y', '-v', 'error',
    '-i', rawMediaPath,
    '-f', 'lavfi', '-i', `sine=frequency=196:duration=${dur}`,
    '-filter_complex',
    `[0:a]aresample=48000,aformat=sample_fmts=fltp:channel_layouts=stereo,apad=whole_dur=${dur}[v];` +
    `[1:a]volume=0.025,afade=t=in:st=0:d=0.3,afade=t=out:st=${Math.max(0.1, dur - 0.4)}:d=0.4[bg];` +
    `[v][bg]amix=inputs=2:duration=first:dropout_transition=0,atrim=0:${dur}`,
    '-ar', '48000', '-ac', '2', finalWavPath
  ]);
}

function formatSrtTime(sec) {
  const msTotal = Math.max(0, Math.round(sec * 1000));
  const h = Math.floor(msTotal / 3600000);
  const m = Math.floor((msTotal % 3600000) / 60000);
  const s = Math.floor((msTotal % 60000) / 1000);
  const ms = msTotal % 1000;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')},${String(ms).padStart(3, '0')}`;
}

export async function generateCampaignVoiceover(campaignPath) {
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
  const sceneWavs = [];
  const srtLines = [];
  let srtOffset = 0;

  for (let i = 0; i < campaign.scenes.length; i++) {
    const scene = campaign.scenes[i];
    const text = cleanSpeechText(scene.subtitle || campaign.hookText || 'Sản phẩm chính hãng chất lượng cao');
    const dur = Math.max(1, Number(scene.durationSec || 4));
    const wordCount = text.split(/\s+/).filter(Boolean).length;
    const maxWords = Math.round(dur * 2.8);
    if (wordCount > maxWords) {
      console.warn(`[Cảnh báo nhịp thoại] Cảnh "${scene.id}" (${dur}s) có ${wordCount} từ (khuyên dùng <= ${maxWords} từ để không bị đọc vội).`);
    }
    srtLines.push(`${i + 1}\n${formatSrtTime(srtOffset)} --> ${formatSrtTime(srtOffset + dur)}\n${text}\n`);
    srtOffset += dur;
    const rawTmp = path.join(audioDir, `_raw-${scene.id}.mp3`);
    const finalWav = path.join(audioDir, `${scene.id}.wav`);
    let synthesized = false;

    if (ttsEngine === 'vbee-vi' && vbeeKey) {
      try {
        const buf = await fetchVbeeTts(text, { apiKey: vbeeKey, appId: vbeeAppId, voiceCode: aiCfg.vbeeVoice || undefined });
        fs.writeFileSync(rawTmp, buf);
        normalizeAndFitAudio(rawTmp, finalWav, dur);
        synthesized = true;
        console.log(`OK [Vbee TTS] Cảnh "${scene.id}" (${dur}s)`);
      } catch (e) {
        console.warn(`[Vbee TTS fallback] Cảnh "${scene.id}": ${e.message}`);
      }
    } else if (ttsEngine === 'fpt-vi' && fptKey) {
      try {
        const buf = await fetchFptTts(text, { apiKey: fptKey, voice: aiCfg.fptVoice || 'banmai' });
        fs.writeFileSync(rawTmp, buf);
        normalizeAndFitAudio(rawTmp, finalWav, dur);
        synthesized = true;
        console.log(`OK [FPT.AI TTS] Cảnh "${scene.id}" (${dur}s)`);
      } catch (e) {
        console.warn(`[FPT.AI TTS fallback] Cảnh "${scene.id}": ${e.message}`);
      }
    } else if (ttsEngine.startsWith('gemini') && geminiKey) {
      try {
        const buf = await fetchGeminiTts(text, geminiKey, aiCfg.ttsVoice || 'Kore');
        fs.writeFileSync(rawTmp, buf);
        normalizeAndFitAudio(rawTmp, finalWav, dur);
        synthesized = true;
        console.log(`OK [Gemini TTS] Cảnh "${scene.id}" (${dur}s)`);
      } catch (e) {
        console.warn(`[Gemini TTS fallback] Cảnh "${scene.id}": ${e.message}`);
      }
    }

    if (!synthesized) {
      try {
        const buf = await fetchGoogleTranslateViTts(text);
        fs.writeFileSync(rawTmp, buf);
        normalizeAndFitAudio(rawTmp, finalWav, dur);
        synthesized = true;
        console.log(`OK [Giọng Việt Tự Nhiên] Cảnh "${scene.id}" (${dur}s)`);
      } catch (e) {
        console.warn(`[Offline TTS fallback] Cảnh "${scene.id}": ${e.message}`);
      }
    }

    if (!synthesized) {
      if (fs.existsSync(finalWav) && fs.statSync(finalWav).size > 15000) {
        console.log(`OK [Giữ Giọng Việt Tự Nhiên đã tạo] Cảnh "${scene.id}" (${dur}s)`);
        synthesized = true;
      } else {
        const fallbackRaw = path.join(audioDir, `_sapi-${scene.id}.wav`);
        generateWindowsSapiOrToneWav(text, fallbackRaw, dur);
        normalizeAndFitAudio(fallbackRaw, finalWav, dur);
        if (fs.existsSync(fallbackRaw)) fs.rmSync(fallbackRaw, { force: true });
        console.log(`OK [Local Voice/Audio] Cảnh "${scene.id}" (${dur}s)`);
      }
    }

    if (fs.existsSync(rawTmp)) fs.rmSync(rawTmp, { force: true });
    scene.audioSrc = path.posix.join('media', 'audio', `${scene.id}.wav`);
    sceneWavs.push(finalWav);
  }

  // Nối toàn bộ thành voiceover-full.mp3 để nghe thử trên trình duyệt
  const concatList = path.join(audioDir, 'concat-audio.txt');
  fs.writeFileSync(
    concatList,
    sceneWavs.map((w) => `file '${w.replace(/\\/g, '/')}'`).join('\n') + '\n',
    'utf8'
  );
  const fullMp3 = path.join(audioDir, 'voiceover-full.mp3');
  execFileSync('ffmpeg', [
    '-y', '-v', 'error',
    '-f', 'concat', '-safe', '0', '-i', concatList,
    '-c:a', 'libmp3lame', '-b:a', '192k', fullMp3
  ]);

  const srtPath = path.join(audioDir, 'subtitles.srt');
  fs.writeFileSync(srtPath, srtLines.join('\n'), 'utf8');

  const assPath = path.join(audioDir, 'subtitles.ass');
  generateAssSubtitles(campaign.scenes, assPath, { width: 1080, height: 1920 });

  campaign.voiceoverSrc = 'media/audio/voiceover-full.mp3';
  campaign.subtitlesSrtSrc = 'media/audio/subtitles.srt';
  campaign.subtitlesAssSrc = 'media/audio/subtitles.ass';
  fs.writeFileSync(campaignPath, JSON.stringify(campaign, null, 2) + '\n', 'utf8');
  console.log(`Đã tạo xong giọng đọc tại: ${path.relative(ROOT, fullMp3)} & phụ đề: .srt / .ass`);
  return { fullMp3, srtPath, assPath, sceneWavs };
}

if (import.meta.url === `file:///${process.argv[1].replace(/\\/g, '/')}` || process.argv[1]?.endsWith('generate-voiceover.mjs')) {
  const arg = process.argv[2] || 'campaigns/sample-campaign/campaign.json';
  const abs = path.isAbsolute(arg) ? arg : path.join(ROOT, arg);
  generateCampaignVoiceover(abs).catch((e) => {
    console.error('LỖI tạo giọng đọc:', e.message);
    process.exit(1);
  });
}
