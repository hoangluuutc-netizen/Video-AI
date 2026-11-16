import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { ALLOWLIST_ENV_KEYS, maskEnvStatus, upsertEnvFile } from '../lib/env-keys.mjs';

test('maskEnvStatus chỉ trả boolean, không bao giờ lộ giá trị key thật', () => {
  const raw = 'GEMINI_API_KEY=secret-123\n# VBEE_API_KEY=commented\nFAL_KEY=\n';
  const status = maskEnvStatus(raw, { VBEE_API_KEY: 'vbee-xyz' });
  assert.equal(status.GEMINI_API_KEY, true);
  assert.equal(status.VBEE_API_KEY, true);
  assert.equal(status.FAL_KEY, false);
  assert.equal(status.FPT_API_KEY, false);
  for (const k of ALLOWLIST_ENV_KEYS) {
    assert.equal(typeof status[k], 'boolean');
  }
});

test('upsertEnvFile tạo từ .env.example, giữ nguyên comment và không xóa key cũ khi ô trống', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'env-keys-'));
  const ex = path.join(dir, '.env.example');
  const env = path.join(dir, '.env');
  fs.writeFileSync(ex, '# Comment quan trong\nGEMINI_API_KEY=\nVBEE_API_KEY=old-vbee\n', 'utf8');

  const r1 = upsertEnvFile(env, { GEMINI_API_KEY: 'new-gem', VBEE_API_KEY: '', UNKNOWN_KEY: 'hack' }, { examplePath: ex });
  assert.deepEqual(r1.applied, ['GEMINI_API_KEY']);

  const content = fs.readFileSync(env, 'utf8');
  assert.match(content, /# Comment quan trong/);
  assert.match(content, /GEMINI_API_KEY=new-gem/);
  assert.match(content, /VBEE_API_KEY=old-vbee/);
  assert.doesNotMatch(content, /UNKNOWN_KEY/);
});
