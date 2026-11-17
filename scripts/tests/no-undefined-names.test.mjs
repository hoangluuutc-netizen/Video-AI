// Chặn lớp lỗi "gọi hàm/biến không tồn tại" — node --check không bắt được, chỉ nổ khi người dùng bấm nút.
// Đã xảy ra thật: runNodeScript (4 endpoint), getSelectedCampaignId (nút render Remotion), cfg (chặn initDashboard)...
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const ROOT = process.cwd();
const TSC = path.join(ROOT, 'studio', 'node_modules', 'typescript', 'bin', 'tsc');
const NODE_TYPES = path.join(ROOT, 'studio', 'node_modules', '@types', 'node');
// TS2304: Cannot find name · TS2552: Cannot find name, did you mean · TS2448/TS2454: dùng trước khi khai báo/gán
const UNDEFINED_RE = /error (TS2304|TS2552|TS2448|TS2454):/;

function runTsc(args) {
  try {
    return execFileSync(process.execPath, [TSC, '--allowJs', '--checkJs', '--noEmit', '--skipLibCheck', '--target', 'es2022', ...args], {
      cwd: ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
      maxBuffer: 64 * 1024 * 1024
    });
  } catch (e) {
    return String(e.stdout || '') + String(e.stderr || ''); // tsc thoát mã ≠ 0 khi có lỗi kiểu (bình thường với JS)
  }
}

const undefinedLines = (out) => out.split(/\r?\n/).filter((l) => UNDEFINED_RE.test(l));
const listMjs = (dir) => fs.readdirSync(path.join(ROOT, dir)).filter((f) => f.endsWith('.mjs')).map((f) => path.posix.join(dir, f));

const noTsc = !fs.existsSync(TSC) && 'Chưa cài studio/node_modules (npm install trong studio/)';

test('Dashboard (trình duyệt): không gọi tên chưa định nghĩa', { skip: noTsc }, () => {
  // script-template.js nạp trước app.js trong index.html → cùng 1 lượt quét để thấy biến toàn cục ScriptTemplate
  const out = runTsc(['--lib', 'es2022,dom', '--module', 'esnext', 'dashboard/script-template.js', 'dashboard/app.js', 'dashboard/kol-studio.js']);
  assert.deepEqual(undefinedLines(out), []);
});

test('Pipeline Node (scripts/): không gọi tên chưa định nghĩa', { skip: noTsc || (!fs.existsSync(NODE_TYPES) && 'Thiếu @types/node') }, () => {
  const files = [...listMjs('scripts'), ...listMjs('scripts/lib')];
  const out = runTsc([
    '--lib', 'es2022',
    '--module', 'nodenext',
    '--moduleResolution', 'nodenext',
    '--typeRoots', path.join(ROOT, 'studio', 'node_modules', '@types'),
    '--types', 'node',
    ...files
  ]);
  assert.deepEqual(undefinedLines(out), []);
});

// onclick="foo()" trong HTML → foo phải được khai báo ở file JS của trang đó
function definedNames(js) {
  const names = new Set();
  for (const m of js.matchAll(/(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(/g)) names.add(m[1]);
  for (const m of js.matchAll(/(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=/g)) names.add(m[1]);
  for (const m of js.matchAll(/window\.([A-Za-z_$][\w$]*)\s*=/g)) names.add(m[1]);
  return names;
}

function inlineHandlerCalls(html) {
  const calls = new Set();
  for (const m of html.matchAll(/\son[a-z]+\s*=\s*"([^"]*)"/g)) {
    for (const c of m[1].matchAll(/(?:^|[^.\w$])([A-Za-z_$][\w$]*)\s*\(/g)) calls.add(c[1]);
  }
  return calls;
}

const BROWSER_BUILTINS = new Set(['if', 'return', 'function', 'alert', 'confirm', 'prompt', 'setTimeout', 'Number', 'String', 'Boolean', 'parseInt', 'parseFloat', 'encodeURIComponent']);

for (const [page, script] of [['dashboard/index.html', 'dashboard/app.js'], ['dashboard/kol-studio.html', 'dashboard/kol-studio.js']]) {
  test(`${page}: mọi onclick/onchange gọi hàm có thật trong ${script}`, () => {
    const html = fs.readFileSync(path.join(ROOT, page), 'utf8');
    const defined = definedNames(fs.readFileSync(path.join(ROOT, script), 'utf8'));
    const missing = [...inlineHandlerCalls(html)].filter((n) => !BROWSER_BUILTINS.has(n) && !defined.has(n));
    assert.deepEqual(missing, []);
  });
}
