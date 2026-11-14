import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { readJson } from './lib/prompt-builder.mjs';

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

export async function generateCampaignVoiceover(campaignPath) {
  loadEnvFile();
  const aiCfg = loadAiConfig();
  const campaign = readJson(campaignPath);
  const campaignDir = path.dirname(campaignPath);
  const audioDir = path.join(campaignDir, 'media', 'audio');
  fs.mkdirSync(audioDir, { recursive: true });

  const ttsEngine = aiCfg.ttsModel || process.env.TTS_MODEL || 'google-vi-natural';
  const geminiKey = aiCfg.geminiApiKey || process.env.GEMINI_API_KEY || '';
  const sceneWavs = [];

  for (const scene of campaign.scenes) {
    const text = cleanSpeechText(scene.subtitle || campaign.hookText || 'Sản phẩm chính hãng chất lượng cao');
    const dur = Math.max(1, Number(scene.durationSec || 4));
    const rawTmp = path.join(audioDir, `_raw-${scene.id}.mp3`);
    const finalWav = path.join(audioDir, `${scene.id}.wav`);
    let synthesized = false;

    if (ttsEngine.startsWith('gemini') && geminiKey) {
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
      const fallbackRaw = path.join(audioDir, `_sapi-${scene.id}.wav`);
      generateWindowsSapiOrToneWav(text, fallbackRaw, dur);
      normalizeAndFitAudio(fallbackRaw, finalWav, dur);
      if (fs.existsSync(fallbackRaw)) fs.rmSync(fallbackRaw, { force: true });
      console.log(`OK [Local Voice/Audio] Cảnh "${scene.id}" (${dur}s)`);
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

  campaign.voiceoverSrc = 'media/audio/voiceover-full.mp3';
  fs.writeFileSync(campaignPath, JSON.stringify(campaign, null, 2) + '\n', 'utf8');
  console.log(`Đã tạo xong giọng đọc & âm thanh tại: ${path.relative(ROOT, fullMp3)}`);
  return { fullMp3, sceneWavs };
}

if (import.meta.url === `file:///${process.argv[1].replace(/\\/g, '/')}` || process.argv[1]?.endsWith('generate-voiceover.mjs')) {
  const arg = process.argv[2] || 'campaigns/sample-campaign/campaign.json';
  const abs = path.isAbsolute(arg) ? arg : path.join(ROOT, arg);
  generateCampaignVoiceover(abs).catch((e) => {
    console.error('LỖI tạo giọng đọc:', e.message);
    process.exit(1);
  });
}
