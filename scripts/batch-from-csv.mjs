import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { ROOT } from './lib/footage.mjs';
import { readJson } from './lib/prompt-builder.mjs';
import { runOptimalPipeline, recordReelSheet } from './run-optimal-pipeline.mjs';
import { generateCampaignVoiceover } from './generate-voiceover.mjs';
import { runPhasedPipeline } from './lib/phased-batch.mjs';
import { prepareForHeavyPhase } from './lib/resource-gate.mjs';
import { resolveLocalTtsConfig, withManagedLocalTts, unloadLocalTts } from './lib/local-tts-client.mjs';

function parseCsvLine(line) {
  const out = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      out.push(cur.trim());
      cur = '';
    } else {
      cur += ch;
    }
  }
  out.push(cur.trim());
  return out;
}

export function parseCsv(text) {
  const lines = String(text || '')
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .filter((l) => l.trim().length > 0);
  if (lines.length < 2) return [];
  const headers = parseCsvLine(lines[0]);
  return lines.slice(1).map((line) => {
    const vals = parseCsvLine(line);
    const row = {};
    headers.forEach((h, i) => {
      row[h] = vals[i] ?? '';
    });
    return row;
  });
}

export function buildProductFromRow(row) {
  const id = String(row?.id || '')
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-|-$/g, '');
  if (!id || !row?.name) return null;

  return {
    id,
    name: row.name,
    sku: row.sku || id.toUpperCase(),
    category: row.category || 'home',
    price: row.price || '299.000đ',
    salePrice: row.salePrice || row.price || '199.000đ',
    discountBadge: row.discountBadge || 'ƯU ĐÃI HÔM NAY',
    highlights: String(row.highlights || '').split('|').map((s) => s.trim()).filter(Boolean),
    immutableFeatures: String(row.immutableFeatures || row.name).split('|').map((s) => s.trim()).filter(Boolean),
    forbiddenChanges: ['Do not alter product shape, colors, or brand logo'],
    referenceImages: {
      front: row.imagePath || `assets/products/${id}/front.png`
    }
  };
}

export function writeProductIfMissing(prodDir, productObj) {
  fs.mkdirSync(prodDir, { recursive: true });
  const prodPath = path.join(prodDir, 'product.json');
  if (fs.existsSync(prodPath)) {
    return 'kept';
  }
  const tmpPath = `${prodPath}.tmp-${process.pid}`;
  fs.writeFileSync(tmpPath, JSON.stringify(productObj, null, 2) + '\n', 'utf8');
  fs.renameSync(tmpPath, prodPath);
  return 'created';
}

export async function runBatch(rows, { runner, resume = false, root = ROOT } = {}) {
  const ok = [];
  const failed = [];
  const skipped = [];

  const sampleCampPath = path.join(root, 'campaigns', 'sample-campaign', 'campaign.json');
  const sampleCamp = fs.existsSync(sampleCampPath)
    ? readJson(sampleCampPath)
    : { id: 'sample-campaign', scenes: [] };

  for (const row of rows) {
    const productObj = buildProductFromRow(row);
    if (!productObj) continue;
    const { id } = productObj;

    try {
      const prodDir = path.join(root, 'assets', 'products', id);
      const status = writeProductIfMissing(prodDir, productObj);
      if (status === 'kept') {
        console.log(`[Giữ nguyên] Đã có product.json cho "${id}", không ghi đè.`);
      }

      const campId = `batch-${id}`;
      const campDir = path.join(root, 'campaigns', campId);
      fs.mkdirSync(campDir, { recursive: true });
      const campPath = path.join(campDir, 'campaign.json');
      const outMp4 = path.join(campDir, 'out', 'ffmpeg-9x16.mp4');

      if (resume && fs.existsSync(campPath) && fs.existsSync(outMp4)) {
        const campMtime = fs.statSync(campPath).mtimeMs;
        const mp4Mtime = fs.statSync(outMp4).mtimeMs;
        if (mp4Mtime > campMtime) {
          skipped.push(id);
          continue;
        }
      }

      const campObj = JSON.parse(JSON.stringify(sampleCamp));
      campObj.id = campId;
      campObj.title = `Chiến dịch ${productObj.name}`;
      campObj.productId = id;
      campObj.hookText = `Đừng mua ${productObj.name} nếu bạn chưa xem 3 chi tiết này!`;
      campObj.ctaText = `Chỉ ${productObj.salePrice} hôm nay — Đặt ngay!`;
      const tmpCamp = `${campPath}.tmp-${process.pid}`;
      fs.writeFileSync(tmpCamp, JSON.stringify(campObj, null, 2) + '\n', 'utf8');
      fs.renameSync(tmpCamp, campPath);

      if (runner) {
        await runner(campPath, productObj);
      }
      ok.push(id);
    } catch (err) {
      failed.push({ id, error: err?.message || String(err) });
      console.error(`[Lỗi SKU "${id}"]: ${err?.message || err}`);
    }
  }

  return { ok, failed, skipped };
}

async function main() {
  const args = process.argv.slice(2);
  const autoRun = args.includes('--run');
  const resume = args.includes('--resume');
  const csvArg = args.find((a) => !a.startsWith('--')) || 'assets/products/batch-template.csv';
  const csvAbs = path.isAbsolute(csvArg) ? csvArg : path.join(ROOT, csvArg);

  if (!fs.existsSync(csvAbs)) {
    console.error(`Không tìm thấy file CSV: ${csvAbs}`);
    process.exit(1);
  }

  const rows = parseCsv(fs.readFileSync(csvAbs, 'utf8'));

  if (autoRun) {
    execFileSync(process.execPath, [path.join(ROOT, 'scripts', 'ingest-footage.mjs')], { stdio: 'inherit' });
    execFileSync(process.execPath, [path.join(ROOT, 'scripts', 'analyze-sample-video.mjs')], { stdio: 'inherit' });
  }

  // --run --phased: tạo chiến dịch cho mọi SKU trước, rồi chạy theo PHA (Gói 7 — T9)
  const phased = autoRun && args.includes('--phased');
  const collected = [];
  const runner = phased
    ? async (campPath) => {
        collected.push(campPath);
      }
    : autoRun
      ? async (campPath) => {
          await runOptimalPipeline(campPath, { skipSampleAnalysis: true });
        }
      : async (campPath) => {
          execFileSync(process.execPath, [path.join(ROOT, 'scripts', 'generate-prompts.mjs'), campPath], { stdio: 'inherit' });
        };

  const summary = await runBatch(rows, { runner, resume, root: ROOT });
  if (phased && collected.length) {
    const node = (script, extra = []) => (c) =>
      execFileSync(process.execPath, [path.join(ROOT, 'scripts', script), c, ...extra], { stdio: 'inherit' });
    const aiCfgPath = path.join(ROOT, 'assets', 'brand-kit', 'ai-config.json');
    const aiCfg = fs.existsSync(aiCfgPath) ? readJson(aiCfgPath) : {};
    const usesLocalTts = /^(voicestudio|sidecar)-/.test(aiCfg.ttsModel || '');
    const localCfg = usesLocalTts
      ? resolveLocalTtsConfig({ ...aiCfg, localTts: { ...(aiCfg.localTts || {}), provider: aiCfg.ttsModel.startsWith('sidecar') ? 'sidecar' : 'voicestudio' } })
      : null;
    const result = await runPhasedPipeline(collected, {
      prompts: node('generate-prompts.mjs'),
      beforeVoice: () => prepareForHeavyPhase({ label: 'TTS (cả lô)', minFreeGb: usesLocalTts ? aiCfg.ttsMinFreeGb ?? 10 : 2 }),
      withTts: localCfg
        ? async (fn) => {
            try {
              return await withManagedLocalTts(localCfg, fn);
            } finally {
              await unloadLocalTts(localCfg).catch(() => false);
            }
          }
        : null,
      voice: (c) => generateCampaignVoiceover(c, { manageLocalTts: !localCfg }),
      render: node('export-cutlist.mjs', ['--render-ffmpeg']),
      verify: node('verify-integrity.mjs'),
      record: (c) => recordReelSheet(c)
    });
    // campPath = campaigns/batch-<id>/campaign.json → <id>
    const prodIdOf = (campPath) => path.basename(path.dirname(campPath)).replace(/^batch-/, '');
    const failedIds = new Set(result.failed.map((f) => prodIdOf(f.id)));
    summary.ok = summary.ok.filter((id) => !failedIds.has(id));
    summary.failed.push(...result.failed.map((f) => ({ id: prodIdOf(f.id), error: `pha ${f.phase}: ${f.error}` })));
    execFileSync(process.execPath, [path.join(ROOT, 'scripts', 'validate-assets.mjs')], { stdio: 'inherit' });
  }
  console.log(`\n=== TỔNG KẾT BATCH CSV ===`);
  console.log(`- Thành công (${summary.ok.length}): ${summary.ok.join(', ') || 'Không có'}`);
  console.log(`- Bỏ qua (--resume, ${summary.skipped.length}): ${summary.skipped.join(', ') || 'Không có'}`);
  console.log(`- Lỗi (${summary.failed.length}): ${summary.failed.map((f) => `${f.id} (${f.error})`).join('; ') || 'Không có'}`);

  if (summary.failed.length > 0) {
    process.exitCode = 1;
  }
}

const isDirectRun = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
if (isDirectRun) {
  main().catch((err) => {
    console.error('LỖI batch-from-csv:', err.message);
    process.exit(1);
  });
}
