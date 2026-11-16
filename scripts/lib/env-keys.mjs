import fs from 'node:fs';
import path from 'node:path';

export const ALLOWLIST_ENV_KEYS = [
  'GEMINI_API_KEY',
  'FAL_KEY',
  'VBEE_API_KEY',
  'VBEE_APP_ID',
  'FPT_API_KEY',
  'ELEVENLABS_API_KEY',
  'PHOTOROOM_API_KEY'
];

export function parseEnvKeys(envRaw = '') {
  const map = {};
  for (const line of String(envRaw).split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const k = trimmed.slice(0, eq).trim();
    const v = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
    if (k) map[k] = v;
  }
  return map;
}

export function maskEnvStatus(envRaw = '', procEnv = process.env) {
  const parsed = parseEnvKeys(envRaw);
  const status = {};
  for (const key of ALLOWLIST_ENV_KEYS) {
    const val = procEnv[key] || parsed[key] || '';
    status[key] = Boolean(String(val).trim());
  }
  return status;
}

function formatEnvValue(val) {
  const s = String(val).trim();
  if (/[\s#"'`]/.test(s)) {
    return `"${s.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
  }
  return s;
}

export function upsertEnvFile(envPath, updates = {}, { examplePath = '' } = {}) {
  let raw = '';
  if (fs.existsSync(envPath)) {
    raw = fs.readFileSync(envPath, 'utf8');
  } else if (examplePath && fs.existsSync(examplePath)) {
    raw = fs.readFileSync(examplePath, 'utf8');
  }

  const applied = [];
  const lines = raw ? raw.split(/\r?\n/) : [];

  for (const key of ALLOWLIST_ENV_KEYS) {
    if (updates[key] === undefined || updates[key] === null) continue;
    const val = String(updates[key]).trim();
    if (!val) continue; // Không ghi đè nếu người dùng để trống ô nhập

    const formatted = `${key}=${formatEnvValue(val)}`;
    const idx = lines.findIndex((l) => {
      const t = l.trim();
      return !t.startsWith('#') && t.startsWith(`${key}=`);
    });
    if (idx >= 0) {
      lines[idx] = formatted;
    } else {
      lines.push(formatted);
    }
    applied.push(key);
  }

  fs.mkdirSync(path.dirname(envPath), { recursive: true });
  const content = lines.join('\n').replace(/\n*$/, '\n');
  fs.writeFileSync(envPath, content, 'utf8');
  return { ok: true, applied };
}
