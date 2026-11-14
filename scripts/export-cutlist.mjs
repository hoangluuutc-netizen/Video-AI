import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { ROOT, VERTICAL_FILTER, loadCatalog, resolveFootageScenes } from './lib/footage.mjs';
import { readJson } from './lib/prompt-builder.mjs';

function csvCell(v) {
  return `"${String(v ?? '').replace(/"/g, '""')}"`;
}

function fmt(t) {
  const m = Math.floor(t / 60);
  const s = (t - m * 60).toFixed(2).padStart(5, '0');
  return `${String(m).padStart(2, '0')}:${s}`;
}

function renderFfmpeg(items, outDir) {
  const tmpDir = path.join(outDir, '_segments');
  fs.mkdirSync(tmpDir, { recursive: true });
  const listLines = [];

  items.forEach((it, i) => {
    const seg = path.join(tmpDir, `seg-${String(i).padStart(2, '0')}.mp4`);
    const args = ['-y', '-v', 'error', '-ss', String(it.start), '-t', String(it.dur), '-i', it.absPath];
    if (!it.clip.hasAudio) args.push('-f', 'lavfi', '-i', 'anullsrc=r=48000:cl=stereo');
    args.push(
      '-vf', VERTICAL_FILTER,
      '-map', '0:v:0', '-map', it.clip.hasAudio ? '0:a:0' : '1:a:0',
      '-c:v', 'libx264', '-crf', '16', '-preset', 'medium', '-pix_fmt', 'yuv420p',
      '-c:a', 'aac', '-ar', '48000', '-ac', '2', '-shortest', seg
    );
    execFileSync('ffmpeg', args, { stdio: 'inherit' });
    listLines.push(`file '${seg.replace(/\\/g, '/')}'`);
  });

  const listPath = path.join(tmpDir, 'concat.txt');
  fs.writeFileSync(listPath, listLines.join('\n') + '\n', 'utf8');
  const outFile = path.join(outDir, 'ffmpeg-9x16.mp4');
  execFileSync(
    'ffmpeg',
    ['-y', '-v', 'error', '-f', 'concat', '-safe', '0', '-i', listPath, '-c', 'copy', outFile],
    { stdio: 'inherit' }
  );
  return outFile;
}

function main() {
  const args = process.argv.slice(2);
  const render = args.includes('--render-ffmpeg');
  const argPath = args.find((a) => !a.startsWith('--')) || '';
  if (!argPath) {
    console.error('Cách dùng: node scripts/export-cutlist.mjs <campaign.json> [--render-ffmpeg]');
    process.exit(1);
  }
  const campaignPath = path.isAbsolute(argPath) ? argPath : path.join(ROOT, argPath);
  const campaign = readJson(campaignPath);
  const dir = path.dirname(campaignPath);

  const { items, errors } = resolveFootageScenes(campaign, loadCatalog());
  if (errors.length > 0) {
    console.error('KHÔNG THỂ XUẤT CUTLIST:');
    errors.forEach((e) => console.error(' - ' + e));
    process.exit(1);
  }
  if (items.length === 0) {
    console.error('Chiến dịch không có cảnh "real-footage" nào.');
    process.exit(1);
  }

  let t = 0;
  const rows = items.map((it, i) => {
    const row = {
      stt: i + 1,
      scene: it.scene.id,
      file: it.clip.filePath,
      in: it.start,
      out: it.end,
      dur: it.dur,
      timelineStart: t,
      subtitle: it.scene.subtitle
    };
    t += it.dur;
    return row;
  });

  const md = [
    `# Cutlist CapCut — ${campaign.title}`,
    ``,
    `> Chỉ cắt/ghép/phóng to-thu nhỏ/phụ đề. KHÔNG dùng AI làm đẹp da, đổi mặt, tăng nét, sinh/xóa vật thể, giọng AI.`,
    `> Khung dọc 9:16 (1080x1920). Cảnh thông số & CTA dựng bằng Remotion hoặc thêm tay.`,
    ``,
    `| # | Cảnh | File gốc | In | Out | Dài (s) | Vị trí timeline | Phụ đề |`,
    `|---|---|---|---|---|---|---|---|`,
    ...rows.map((r) => `| ${r.stt} | ${r.scene} | ${r.file} | ${fmt(r.in)} | ${fmt(r.out)} | ${r.dur.toFixed(2)} | ${fmt(r.timelineStart)} | ${r.subtitle} |`),
    ``,
    `Tổng thời lượng cảnh quay thật: **${t.toFixed(2)}s**`,
    ``
  ].join('\n');
  fs.writeFileSync(path.join(dir, 'cutlist.md'), md, 'utf8');

  const csv = [
    ['stt', 'scene', 'file', 'in_sec', 'out_sec', 'duration_sec', 'timeline_start_sec', 'subtitle'].join(','),
    ...rows.map((r) => [r.stt, r.scene, r.file, r.in, r.out, r.dur, r.timelineStart, r.subtitle].map(csvCell).join(','))
  ].join('\n');
  fs.writeFileSync(path.join(dir, 'cutlist.csv'), '\uFEFF' + csv + '\n', 'utf8');
  console.log(`Đã xuất ${path.relative(ROOT, path.join(dir, 'cutlist.md'))} và cutlist.csv`);

  if (render) {
    const outDir = path.join(dir, 'out');
    fs.mkdirSync(outDir, { recursive: true });
    try {
      const out = renderFfmpeg(items, outDir);
      console.log(`Đã dựng bằng ffmpeg: ${path.relative(ROOT, out)}`);
    } catch (e) {
      console.error(`ffmpeg lỗi (${e.message}). Dùng cutlist.md/csv để dựng tay trong CapCut.`);
      process.exit(1);
    }
  }
}

main();
