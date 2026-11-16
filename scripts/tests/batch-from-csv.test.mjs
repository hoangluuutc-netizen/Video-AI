import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  parseCsv,
  buildProductFromRow,
  writeProductIfMissing,
  runBatch
} from '../batch-from-csv.mjs';

test('parseCsv và buildProductFromRow chuẩn', () => {
  const rows = parseCsv('id,name,price\nsp-1,"Sản phẩm A",199.000đ\n,Thiếu ID,100đ\n');
  assert.equal(rows.length, 2);
  assert.equal(buildProductFromRow(rows[0]).id, 'sp-1');
  assert.equal(buildProductFromRow(rows[1]), null);
});

test('không ghi đè product.json đã tồn tại', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'batch-prod-'));
  try {
    const f = path.join(tmp, 'product.json');
    fs.writeFileSync(f, JSON.stringify({ id: 'sp', name: 'GỐC' }), 'utf8');
    assert.equal(writeProductIfMissing(tmp, { id: 'sp', name: 'MỚI' }), 'kept');
    assert.equal(JSON.parse(fs.readFileSync(f, 'utf8')).name, 'GỐC');
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('1 dòng lỗi không dừng cả lô', async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'batch-run-'));
  try {
    const sampleDir = path.join(tmp, 'campaigns', 'sample-campaign');
    fs.mkdirSync(sampleDir, { recursive: true });
    fs.writeFileSync(path.join(sampleDir, 'campaign.json'), JSON.stringify({ id: 'sample-campaign', scenes: [] }));

    const rows3 = [
      { id: 'p1', name: 'SP 1' },
      { id: 'p2', name: 'SP 2' },
      { id: 'p3', name: 'SP 3' }
    ];
    const runner = async (p) => {
      if (p.includes('p2')) throw new Error('x');
    };
    const r = await runBatch(rows3, { runner, root: tmp });
    assert.equal(r.ok.length, 2);
    assert.equal(r.failed.length, 1);
    assert.equal(r.failed[0].id, 'p2');
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('--resume bỏ qua SKU đã có out/ffmpeg-9x16.mp4 mới hơn campaign.json', async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'batch-resume-'));
  try {
    const sampleDir = path.join(tmp, 'campaigns', 'sample-campaign');
    fs.mkdirSync(sampleDir, { recursive: true });
    fs.writeFileSync(path.join(sampleDir, 'campaign.json'), JSON.stringify({ id: 'sample-campaign', scenes: [] }));

    const campDir = path.join(tmp, 'campaigns', 'batch-p1');
    const outDir = path.join(campDir, 'out');
    fs.mkdirSync(outDir, { recursive: true });
    const campFile = path.join(campDir, 'campaign.json');
    const mp4File = path.join(outDir, 'ffmpeg-9x16.mp4');
    fs.writeFileSync(campFile, JSON.stringify({ id: 'batch-p1', scenes: [] }));
    const oldTime = new Date(Date.now() - 10000);
    fs.utimesSync(campFile, oldTime, oldTime);
    fs.writeFileSync(mp4File, 'fake-mp4');

    let called = 0;
    const r = await runBatch(
      [{ id: 'p1', name: 'SP 1' }, { id: 'p2', name: 'SP 2' }],
      { runner: async () => { called++; }, resume: true, root: tmp }
    );
    assert.deepEqual(r.skipped, ['p1']);
    assert.deepEqual(r.ok, ['p2']);
    assert.equal(called, 1);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});
