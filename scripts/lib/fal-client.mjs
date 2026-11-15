// Fal.ai REST & Queue client (FLUX Kontext, Wan I2V, Kling Turbo) — không cần cài SDK.
import fs from 'node:fs';
import path from 'node:path';

const FAL_QUEUE_BASE = 'https://queue.fal.run';

export const FAL_IMAGE_ENDPOINTS = {
  'fal-flux-kontext': 'fal-ai/flux-pro/kontext'
};

export const FAL_VIDEO_ENDPOINTS = {
  'fal-wan-i2v': 'fal-ai/wan/v2.2-a14b/image-to-video',
  'fal-kling-turbo': 'fal-ai/kling-video/v2.5-turbo/pro/image-to-video'
};

function guessMime(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.png') return 'image/png';
  if (ext === '.webp') return 'image/webp';
  return 'image/jpeg';
}

export function fileToDataUri(absPath) {
  const mime = guessMime(absPath);
  const b64 = fs.readFileSync(absPath).toString('base64');
  return `data:${mime};base64,${b64}`;
}

async function runFalQueue(apiKey, endpoint, input, { maxPolls = 120, intervalMs = 3000 } = {}) {
  const submitRes = await fetch(`${FAL_QUEUE_BASE}/${endpoint}`, {
    method: 'POST',
    headers: {
      Authorization: `Key ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(input)
  });

  if (!submitRes.ok) {
    const txt = await submitRes.text().catch(() => '');
    throw new Error(`Fal.ai submit (${endpoint}) HTTP ${submitRes.status}: ${txt.slice(0, 350)}`);
  }

  const job = await submitRes.json();
  if (job.images || job.video) return job;

  const statusUrl = job.status_url || `${FAL_QUEUE_BASE}/${endpoint}/requests/${job.request_id}/status`;
  const responseUrl = job.response_url || `${FAL_QUEUE_BASE}/${endpoint}/requests/${job.request_id}`;

  for (let i = 0; i < maxPolls; i++) {
    await new Promise((r) => setTimeout(r, intervalMs));
    const stRes = await fetch(statusUrl, {
      headers: { Authorization: `Key ${apiKey}` }
    });
    if (!stRes.ok) continue;
    const st = await stRes.json();
    if (st.status === 'COMPLETED') {
      const outRes = await fetch(responseUrl, {
        headers: { Authorization: `Key ${apiKey}` }
      });
      if (!outRes.ok) {
        const err = await outRes.text().catch(() => '');
        throw new Error(`Fal.ai result HTTP ${outRes.status}: ${err.slice(0, 300)}`);
      }
      return outRes.json();
    }
    if (st.status === 'FAILED' || st.status === 'ERROR') {
      throw new Error(`Fal.ai job thất bại: ${JSON.stringify(st.error || st).slice(0, 300)}`);
    }
  }
  throw new Error(`Fal.ai timeout khi chờ endpoint ${endpoint}`);
}

export async function downloadToBuffer(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Không tải được media từ Fal.ai (HTTP ${res.status})`);
  return Buffer.from(await res.arrayBuffer());
}

export async function generateFalImage({ apiKey, modelKey = 'fal-flux-kontext', prompt, referenceImagePaths = [], aspectRatio = '9:16' }) {
  const endpoint = FAL_IMAGE_ENDPOINTS[modelKey] || FAL_IMAGE_ENDPOINTS['fal-flux-kontext'];
  const validPaths = referenceImagePaths.filter((p) => p && fs.existsSync(p));
  const payload = {
    prompt,
    aspect_ratio: aspectRatio,
    output_format: 'png'
  };
  if (validPaths.length > 0) {
    payload.image_url = fileToDataUri(validPaths[0]);
  }
  const data = await runFalQueue(apiKey, endpoint, payload, { maxPolls: 60, intervalMs: 2000 });
  const imgUrl = data?.images?.[0]?.url || data?.image?.url;
  if (!imgUrl) throw new Error('Fal.ai không trả về URL ảnh.');
  return downloadToBuffer(imgUrl);
}

export async function generateFalVideo({ apiKey, modelKey = 'fal-wan-i2v', prompt, startImagePath, endImagePath = '', durationSec = 5 }) {
  const endpoint = FAL_VIDEO_ENDPOINTS[modelKey] || FAL_VIDEO_ENDPOINTS['fal-wan-i2v'];
  if (!startImagePath || !fs.existsSync(startImagePath)) {
    throw new Error('Thiếu ảnh Start Frame hợp lệ cho Fal.ai Image-to-Video.');
  }

  const payload = {
    prompt,
    image_url: fileToDataUri(startImagePath)
  };

  if (modelKey === 'fal-kling-turbo') {
    payload.duration = durationSec >= 8 ? '10' : '5';
    payload.aspect_ratio = '9:16';
  } else {
    payload.aspect_ratio = '9:16';
    payload.resolution = '720p';
    if (endImagePath && fs.existsSync(endImagePath)) {
      payload.end_image_url = fileToDataUri(endImagePath);
    }
  }

  const data = await runFalQueue(apiKey, endpoint, payload, { maxPolls: 150, intervalMs: 3000 });
  const vidUrl = data?.video?.url || data?.output?.url;
  if (!vidUrl) throw new Error('Fal.ai không trả về URL video.');
  return downloadToBuffer(vidUrl);
}
