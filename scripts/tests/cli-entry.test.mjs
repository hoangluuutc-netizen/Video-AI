// Thư mục dự án có dấu & khoảng trắng ("tạo video AI"): new URL(import.meta.url).pathname bị mã hóa %
// nên so với argv[1] không bao giờ bằng → main() không chạy, CLI thoát 0 im lặng (batch-from-csv từng dính).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const ROOT = process.cwd();

test('batch-from-csv: chạy trực tiếp thì main() thực sự chạy (CSV không tồn tại → báo lỗi, thoát ≠ 0)', () => {
  const r = spawnSync(process.execPath, [path.join(ROOT, 'scripts', 'batch-from-csv.mjs'), 'khong-ton-tai-xyz.csv'], {
    cwd: ROOT,
    encoding: 'utf8',
    windowsHide: true
  });
  assert.notEqual(r.status, 0, `CLI thoát 0 mà không làm gì. stdout=${r.stdout} stderr=${r.stderr}`);
  assert.match(r.stderr + r.stdout, /batch|csv|không/i);
});

test('Không script nào so argv[1] với new URL(import.meta.url).pathname (hỏng khi đường dẫn có dấu)', () => {
  const dirs = ['scripts', path.join('scripts', 'lib')];
  const offenders = dirs.flatMap((d) =>
    fs
      .readdirSync(path.join(ROOT, d))
      .filter((f) => f.endsWith('.mjs'))
      .map((f) => path.join(d, f))
      .filter((rel) => /new URL\(import\.meta\.url\)\.pathname/.test(fs.readFileSync(path.join(ROOT, rel), 'utf8')))
  );
  assert.deepEqual(offenders, []);
});
