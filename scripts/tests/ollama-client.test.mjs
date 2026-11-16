import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {
  generateOllamaJson,
  listLoadedOllamaModels,
  unloadOllamaModels
} from '../lib/ollama-client.mjs';

function startMockServer(handler) {
  return new Promise((resolve) => {
    const srv = http.createServer((req, res) => {
      let raw = '';
      req.on('data', (c) => { raw += c; });
      req.on('end', () => {
        const body = raw ? JSON.parse(raw) : null;
        handler(req, res, body);
      });
    });
    srv.listen(0, '127.0.0.1', () => {
      const addr = srv.address();
      resolve({ server: srv, baseUrl: `http://127.0.0.1:${addr.port}` });
    });
  });
}

test('generateOllamaJson gửi keep_alive và num_ctx', async () => {
  let capturedBody = null;
  const { server, baseUrl } = await startMockServer((req, res, body) => {
    if (req.url === '/api/chat') {
      capturedBody = body;
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ message: { content: '{"ok":true}' } }));
      return;
    }
    res.writeHead(404);
    res.end();
  });

  try {
    const out = await generateOllamaJson({ prompt: 'test', baseUrl });
    assert.deepEqual(out, { ok: true });
    assert.equal(capturedBody.keep_alive, '2m');
    assert.equal(capturedBody.options.num_ctx, 8192);
  } finally {
    server.close();
  }
});

test('unloadOllamaModels gửi keep_alive 0 cho từng model đang nạp', async () => {
  let loadedModels = [
    { name: 'qwen3.5:9b', size: 100, size_vram: 0 },
    { name: 'llava:7b', size: 200, size_vram: 0 }
  ];
  const generateCalls = [];

  const { server, baseUrl } = await startMockServer((req, res, body) => {
    if (req.url === '/api/ps') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ models: loadedModels }));
      return;
    }
    if (req.url === '/api/generate') {
      generateCalls.push(body);
      loadedModels = loadedModels.filter((m) => m.name !== body.model);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ done: true }));
      return;
    }
    res.writeHead(404);
    res.end();
  });

  try {
    const before = await listLoadedOllamaModels({ baseUrl });
    assert.equal(before.length, 2);

    const unloaded = await unloadOllamaModels({ baseUrl, timeoutMs: 3000 });
    assert.deepEqual(unloaded, ['qwen3.5:9b', 'llava:7b']);
    assert.equal(generateCalls.length, 2);
    assert.ok(generateCalls.every((b) => b.keep_alive === 0));
  } finally {
    server.close();
  }
});

test('unloadOllamaModels trả [] khi Ollama không chạy', async () => {
  const res = await unloadOllamaModels({ baseUrl: 'http://127.0.0.1:1', timeoutMs: 1000 });
  assert.deepEqual(res, []);
});
