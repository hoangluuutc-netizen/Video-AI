import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { analyzeSampleVideo } from './analyze-sample-video.mjs';
import { generateCampaignVoiceover } from './generate-voiceover.mjs';
import { readJson } from './lib/prompt-builder.mjs';
import { prepareForHeavyPhase } from './lib/resource-gate.mjs';
import { getApprovalState } from './lib/kol-consent.mjs';

const ROOT = process.cwd();

function runStep(title, scriptRelPath, args = []) {
  console.log(`\n==========================================================`);
  console.log(`⚡ [AUTO-PILOT] ${title}`);
  console.log(`==========================================================`);
  const scriptAbs = path.join(ROOT, scriptRelPath);
  const out = execFileSync(process.execPath, [scriptAbs, ...args], {
    cwd: ROOT,
    encoding: 'utf8'
  });
  if (out) process.stdout.write(out);
}

export async function runOptimalPipeline(
  campaignRelPath = 'campaigns/sample-campaign/campaign.json',
  { skipSampleAnalysis = false, skipPrompts = false } = {}
) {
  const t0 = Date.now();
  const campaignPath = path.isAbsolute(campaignRelPath)
    ? campaignRelPath
    : path.join(ROOT, campaignRelPath);

  if (!fs.existsSync(campaignPath)) {
    throw new Error(`Không tìm thấy chiến dịch: ${campaignPath}`);
  }

  const campaign = readJson(campaignPath);

  // Bước 1: Quét kho footage & Phân tích Video Mẫu để lấy nhịp + ý tưởng gốc
  if (!skipSampleAnalysis) {
    runStep('BƯỚC 1/6: Quét kho video & Phân tích Video Mẫu (ffprobe + 4 khung hình)', 'scripts/ingest-footage.mjs');
    runStep('Phân tích nhịp & khung hình Video Mẫu (analyze-sample-video.mjs)', 'scripts/analyze-sample-video.mjs');
  } else {
    console.log('⚡ [AUTO-PILOT] BƯỚC 1/6: Dùng lại kết quả phân tích Video Mẫu (skipSampleAnalysis=true).');
  }

  // Bước 2: Sinh bộ Prompt Veo 3.1 / Omni 1.2 (chuẩn ToolKichBan 7 trụ cột) & Cắt Clip Mẫu 3 giây
  if (!skipPrompts) {
    runStep(
      'BƯỚC 2/6: Sinh Bộ Prompt Veo 3.1 / Omni 1.2 & Cắt Clip Mẫu 3s',
      'scripts/generate-prompts.mjs',
      [campaignRelPath]
    );
  }

  // Bước 3: Kiểm tra/Chuẩn bị nguyên liệu Veo 3.1 (Ingredients-to-Video)
  if (campaign.mode !== 'real-footage') {
    runStep(
      'BƯỚC 3/6: Khóa nguyên liệu Veo 3.1 / Omni 1.2 (Ảnh Người thật + Sản phẩm thật + Clip mẫu 3s)',
      'scripts/generate-media.mjs',
      [campaignRelPath, '--mode', 'video', '--dry-run']
    );
  } else {
    console.log(`\n==========================================================`);
    console.log(`⚡ [AUTO-PILOT] BƯỚC 3/6: Đã khóa chế độ Bảo Toàn Gốc 100% (Ảnh Người thật + SP thật + 4 Clip mẫu 3s)`);
    console.log(`==========================================================`);
  }

  // Bước 4: Sinh giọng đọc thuyết minh tiếng Việt tự nhiên & Dựng Video 1080x1920 Bokeh Cinema
  console.log(`\n==========================================================`);
  console.log(`⚡ [AUTO-PILOT] BƯỚC 4/6: Sinh Giọng Đọc Tiếng Việt & Dựng Video 1080×1920 Bokeh Cinema`);
  console.log(`==========================================================`);
  const aiCfgPath = path.join(ROOT, 'assets', 'brand-kit', 'ai-config.json');
  const aiCfg = fs.existsSync(aiCfgPath) ? readJson(aiCfgPath) : {};
  const ttsModel = aiCfg.ttsModel || process.env.TTS_MODEL || 'google-vi-natural';
  const isLocalHeavyTts = /^(voicestudio|sidecar)-/i.test(ttsModel);
  await prepareForHeavyPhase({
    label: 'TTS',
    minFreeGb: isLocalHeavyTts ? (aiCfg.ttsMinFreeGb ?? 10) : 2
  });
  await generateCampaignVoiceover(campaignPath);
  runStep(
    'Dựng MP4 1080×1920 (Phông Bokeh Video Mẫu + 100% Người & SP Thật + Lồng Tiếng Việt)',
    'scripts/export-cutlist.mjs',
    [campaignRelPath, '--render-ffmpeg']
  );

  // Bước 5: Đồng bộ sang Remotion Studio
  runStep(
    'BƯỚC 5/6: Đồng bộ dữ liệu & âm thanh sang Remotion Studio (studio/)',
    'scripts/sync-studio.mjs',
    [campaignRelPath]
  );

  // Bước 6: Kiểm duyệt độ nguyên vẹn (verify-integrity + validate-assets) & Ghi Sổ Vận Hành
  runStep(
    'BƯỚC 6/6: Kiểm định chất lượng Video/Audio & Cấu trúc toàn dự án',
    'scripts/verify-integrity.mjs',
    [campaignRelPath]
  );
  runStep('Kiểm tra toàn bộ schema dự án (validate-assets.mjs)', 'scripts/validate-assets.mjs');

  const latestCampaign = recordReelSheet(campaignPath);

  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`\n==========================================================`);
  console.log(`✅ HOÀN TẤT DÂY CHUYỀN TỐI ƯU TỰ ĐỘNG TRONG ${elapsed}s!`);
  console.log(`🎬 Video MP4 (1080×1920, Có Tiếng): campaigns/${latestCampaign.id}/out/ffmpeg-9x16.mp4`);
  console.log(`📋 Gói Prompt Veo 3.1 / ToolKichBan: campaigns/${latestCampaign.id}/veo3-prompts.json`);
  console.log(`🎙️ File Âm thanh thuyết minh:       campaigns/${latestCampaign.id}/media/audio/voiceover-full.mp3`);
  console.log(`==========================================================\n`);
}

// Tự động cập nhật Sổ Vận Hành Reel (campaigns/reel-sheet.json) — dùng chung cho Auto-Pilot và lô theo pha
export function recordReelSheet(campaignPath) {
  const latestCampaign = readJson(campaignPath);
  const sheetPath = path.join(ROOT, 'campaigns', 'reel-sheet.json');
  const rawSheet = fs.existsSync(sheetPath) ? readJson(sheetPath) : { reels: [] };
  const existing = Array.isArray(rawSheet) ? rawSheet : (rawSheet.reels || []);
  const totalSec = (latestCampaign.scenes || []).reduce((acc, s) => acc + Number(s.durationSec || 0), 0);
  const charPath = path.join(ROOT, 'assets', 'characters', latestCampaign.characterId || '', 'character.json');
  const character = fs.existsSync(charPath) ? readJson(charPath) : {};
  const approvalState = getApprovalState(latestCampaign, character);
  const needsKolApproval = approvalState === 'pending' || approvalState === 'stale';
  const record = {
    code: `REEL-${String(existing.length + 1).padStart(2, '0')}`,
    campaignId: latestCampaign.id,
    type: `Veo3.1 + Bokeh Cinema (${totalSec}s)`,
    hook: latestCampaign.hookText,
    durationSec: totalSec,
    mode: latestCampaign.mode || 'real-footage',
    status: needsKolApproval
      ? 'CHỜ KOL DUYỆT'
      : latestCampaign.voiceIsGeneric
        ? 'PASS (GIỌNG TẠM)'
        : 'PASS (100% Gốc + Có Tiếng)',
    videoLink: `campaigns/${latestCampaign.id}/out/ffmpeg-9x16.mp4`,
    updatedAt: new Date().toISOString().slice(0, 16).replace('T', ' ')
  };
  const filtered = existing.filter((r) => r.campaignId !== latestCampaign.id);
  filtered.unshift(record);
  fs.writeFileSync(sheetPath, JSON.stringify({ reels: filtered }, null, 2) + '\n', 'utf8');
  return latestCampaign;
}

if (
  import.meta.url === `file:///${process.argv[1]?.replace(/\\/g, '/')}` ||
  process.argv[1]?.endsWith('run-optimal-pipeline.mjs')
) {
  const arg = process.argv[2] || 'campaigns/sample-campaign/campaign.json';
  runOptimalPipeline(arg).catch((err) => {
    console.error('❌ LỖI AUTO-PILOT:', err.message);
    process.exit(1);
  });
}
