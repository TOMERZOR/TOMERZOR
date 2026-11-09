// Tripo 3D (openapi.tripo3d.ai, v3): turns one product photo into a textured 3D model (GLB).
// Upload the photo, start an image-to-model task, then poll the task until the model is ready.

const base = env => (env.TRIPO_BASE || 'https://openapi.tripo3d.ai/v3').replace(/\/$/, '');
const auth = env => (env.TRIPO_API_KEY ? { authorization: `Bearer ${env.TRIPO_API_KEY}` } : {});
export const DEFAULT_TRIPO_MODEL = 'v3.1-20260211';

export class TripoError extends Error {
  constructor(message, code, status) { super(message); this.code = code; this.status = status; }
}

async function tripoJson(res) {
  const data = await res.json().catch(() => ({}));
  if (!res.ok || (data.code != null && data.code !== 0)) {
    // 2010: not enough credit on the Tripo account
    const code = data.code === 2010 ? 'no_credit' : data.code === 1004 ? 'bad_input' : `tripo_${data.code ?? res.status}`;
    throw new TripoError(data.message || `Tripo answered ${res.status}`, code, res.status);
  }
  return data.data ?? data;
}

export async function uploadImage(bytes, mime, env, fetchImpl = fetch) {
  const ext = mime.includes('png') ? 'png' : mime.includes('webp') ? 'webp' : 'jpg';
  const form = new FormData();
  form.append('file', new Blob([bytes], { type: mime }), `product.${ext}`);
  const data = await tripoJson(await fetchImpl(`${base(env)}/files`, { method: 'POST', headers: auth(env), body: form }));
  if (!data.file_token) throw new TripoError('Tripo did not return a file token', 'tripo_upload');
  return data.file_token;
}

export async function createTask(fileToken, env, fetchImpl = fetch) {
  const body = { model: env.TRIPO_MODEL || DEFAULT_TRIPO_MODEL, file: { file_token: fileToken } };
  const data = await tripoJson(await fetchImpl(`${base(env)}/generation/image-to-model`, {
    method: 'POST',
    headers: { ...auth(env), 'content-type': 'application/json' },
    body: JSON.stringify(body),
  }));
  const id = data.task_id || data.id || data.task?.id;
  if (!id) throw new TripoError('Tripo did not return a task id', 'tripo_task');
  return id;
}

export async function getTask(id, env, fetchImpl = fetch) {
  const data = await tripoJson(await fetchImpl(`${base(env)}/tasks/${encodeURIComponent(id)}`, { headers: auth(env) }));
  return normalizeTask(data);
}

const MODEL_KEYS = ['pbr_model', 'model', 'base_model', 'glb', 'model_url', 'glb_url'];
/** Finds the GLB download link anywhere in a task's output (field names differ between versions). */
export function findModelUrl(v, depth = 0) {
  if (!v || depth > 5) return null;
  if (typeof v === 'string') return /^https?:\/\//.test(v) && /\.glb(\?|$)/i.test(v) ? v : null;
  if (Array.isArray(v)) { for (const x of v) { const u = findModelUrl(x, depth + 1); if (u) return u; } return null; }
  if (typeof v === 'object') {
    for (const k of MODEL_KEYS) {
      const x = v[k];
      if (typeof x === 'string' && /^https?:\/\//.test(x)) return x;
      if (x && typeof x === 'object' && typeof x.url === 'string') return x.url;
    }
    for (const x of Object.values(v)) { const u = findModelUrl(x, depth + 1); if (u) return u; }
  }
  return null;
}

function findImageUrl(v, depth = 0) {
  if (!v || depth > 5) return null;
  if (typeof v === 'string') return /^https?:\/\//.test(v) && /\.(webp|png|jpe?g)(\?|$)/i.test(v) ? v : null;
  if (typeof v === 'object') for (const x of Object.values(v)) { const u = findImageUrl(x, depth + 1); if (u) return u; }
  return null;
}

/** { status: queued|running|success|failed, progress 0-100, glb, preview } */
export function normalizeTask(d) {
  const raw = String(d?.status ?? d?.state ?? '').toLowerCase();
  let status = /succe|complete|done|finish/.test(raw) ? 'success'
    : /fail|error|cancel|ban|expire|unknown/.test(raw) ? 'failed'
      : /run|process|progress|generat/.test(raw) ? 'running' : 'queued';
  const out = d?.output ?? d?.result ?? d?.outputs ?? d;
  const glb = findModelUrl(out);
  if (status === 'success' && !glb) status = 'failed';
  let progress = Number(d?.progress ?? d?.percent ?? 0);
  if (!Number.isFinite(progress)) progress = 0;
  if (progress <= 1 && progress > 0 && !Number.isInteger(progress)) progress *= 100;
  if (status === 'success') progress = 100;
  return { status, progress: Math.max(0, Math.min(100, Math.round(progress))), glb, preview: findImageUrl(out) };
}
