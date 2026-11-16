import fs from 'node:fs';
import path from 'node:path';
import { parseCsv } from '../batch-from-csv.mjs';
import { estimateVideoCost } from './cost-ledger.mjs';

export function summarizeCostLedgers(campaignsDir) {
  if (!fs.existsSync(campaignsDir)) {
    return { totalUsd: 0, entriesCount: 0, recent: [] };
  }
  const entries = [];
  for (const dirent of fs.readdirSync(campaignsDir, { withFileTypes: true })) {
    if (!dirent.isDirectory()) continue;
    const ledgerPath = path.join(campaignsDir, dirent.name, 'out', 'cost-ledger.jsonl');
    if (!fs.existsSync(ledgerPath)) continue;
    const lines = fs.readFileSync(ledgerPath, 'utf8').split(/\r?\n/).filter(Boolean);
    for (const line of lines) {
      try {
        const obj = JSON.parse(line);
        entries.push({ campaignId: dirent.name, ...obj });
      } catch {
        // Bỏ qua dòng hỏng
      }
    }
  }
  entries.sort((a, b) => String(b.at || '').localeCompare(String(a.at || '')));
  const totalUsd = Number(entries.reduce((s, e) => s + Number(e.usd || 0), 0).toFixed(4));
  return { totalUsd, entriesCount: entries.length, recent: entries.slice(0, 10) };
}

export function previewBatchCsv(csvText = '', aiCfg = {}) {
  const rows = parseCsv(csvText);
  const est = estimateVideoCost(aiCfg);
  const totalEstimatedUsd = Number((rows.length * Number(est.totalUsd || 0)).toFixed(4));
  return {
    count: rows.length,
    perVideoUsd: est.totalUsd,
    totalEstimatedUsd,
    withinBudget: est.withinBudget,
    rows: rows.map((r) => ({
      id: r.id || '',
      name: r.name || '',
      sku: r.sku || '',
      category: r.category || 'general',
      salePrice: r.salePrice || r.price || ''
    }))
  };
}
