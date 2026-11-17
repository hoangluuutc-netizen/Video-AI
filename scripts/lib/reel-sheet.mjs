// Sổ vận hành Reel (campaigns/reel-sheet.json) — một kiểu dòng duy nhất cho pipeline, Batch và Dashboard.
// Trước đây pipeline ghi campaignId/status/videoLink còn Dashboard ghi id/qcStatus/outputPath → bảng hiện
// "undefined", CSV trống cột, và cùng 1 chiến dịch có 2 dòng (dòng "PASS" của giao diện che dòng "CHỜ KOL DUYỆT").

export function normalizeReelRow(r = {}) {
  return {
    code: r.code || '',
    id: r.id ?? r.campaignId ?? '',
    mode: r.mode || '',
    productName: r.productName ?? '',
    hook: r.hook ?? '',
    durationSec: Number(r.durationSec || 0),
    qcStatus: r.qcStatus ?? r.status ?? '',
    outputPath: r.outputPath ?? r.videoLink ?? '',
    type: r.type || '',
    updatedAt: r.updatedAt || ''
  };
}

export function upsertReel(rows = [], record) {
  const id = normalizeReelRow(record).id;
  const kept = rows.map(normalizeReelRow).filter((r) => r.id !== id);
  return [normalizeReelRow(record), ...kept];
}
