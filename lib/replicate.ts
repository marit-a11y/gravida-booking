// Replicate API client, used as a Rodin-trial fallback for the in-app
// 3D preview. Same shape as lib/rodin.ts: a thin wrapper around three
// network calls (create, status, fetch-mesh) that never throws to the
// caller — returns null on transport failures so the cron-poll can retry.
//
// Configured via env:
//   REPLICATE_API_TOKEN   - r8_xxx... from replicate.com/account/api-tokens
//   REPLICATE_MODEL       - model spec, default 'tencent/hunyuan3d-2:<latest>'
//                           Override to swap to Tripo SR or Stable Fast 3D.
//   REPLICATE_API_BASE    - default 'https://api.replicate.com/v1'
//
// Hunyuan3D-2 limitation: takes ONE image as input. We pick the front-angle
// photo. Quality is good enough for the preview-to-conversion funnel; the
// multi-image atelier-grade work happens via Rodin once Business unlocks.

const BASE  = (process.env.REPLICATE_API_BASE ?? 'https://api.replicate.com/v1').replace(/\/$/, '')
const TOKEN = process.env.REPLICATE_API_TOKEN ?? ''

// Pinned latest Hunyuan3D-2 model version as of writing. Replicate model
// versions are immutable; this should stay valid until Tencent ships v3.
// Override REPLICATE_MODEL to use a different version or different model.
// Tencent hunyuan3d-2 returns a single GLB URL via the `output` field.
const DEFAULT_MODEL_SPEC = 'tencent/hunyuan3d-2'

export interface ReplicateJob {
  prediction_id: string
}

export interface ReplicateStatus {
  state: 'queued' | 'generating' | 'done' | 'failed'
  raw:   string
  glb_url?: string
  error?: string
}

function authHeaders(): Record<string, string> {
  if (!TOKEN) throw new Error('REPLICATE_API_TOKEN env var is not set; cannot call Replicate.')
  return { 'Authorization': `Bearer ${TOKEN}` }
}

/**
 * Resolve the model spec to a {model, version} pair. Accepts:
 *   "owner/name"                      → fetch latest version from API
 *   "owner/name:versionhash"          → use that version directly
 */
async function resolveModelVersion(): Promise<string | null> {
  const spec = (process.env.REPLICATE_MODEL || DEFAULT_MODEL_SPEC).trim()
  // Already pinned version?
  if (spec.includes(':')) return spec.split(':')[1]
  try {
    const res = await fetch(`${BASE}/models/${spec}`, { headers: authHeaders() })
    if (!res.ok) {
      console.error('replicate.resolveModelVersion failed:', res.status, await res.text().catch(() => ''))
      return null
    }
    const data = await res.json()
    return data?.latest_version?.id ?? null
  } catch (err) {
    console.error('replicate.resolveModelVersion threw:', err)
    return null
  }
}

/**
 * Kick off a Hunyuan3D generation from ONE image URL (the front-angle
 * photo). Returns the prediction_id the cron job will poll on.
 */
export async function createGeneration(opts: {
  imageUrls: string[]
}): Promise<ReplicateJob | null> {
  const versionId = await resolveModelVersion()
  if (!versionId) return null
  // Pick the front photo if available, otherwise just the first one.
  // The caller passes the URLs in angle order (front, right, back, left).
  const image = opts.imageUrls[0]
  if (!image) {
    console.error('replicate.createGeneration: no image URLs supplied')
    return null
  }
  try {
    const res = await fetch(`${BASE}/predictions`, {
      method: 'POST',
      headers: { ...authHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        version: versionId,
        input: {
          // Common Hunyuan3D-2 input names. The model accepts `image` for the
          // input photo. Some forks expose extra params; we leave them at
          // defaults to keep this provider-agnostic.
          image,
        },
      }),
    })
    if (!res.ok) {
      const text = await res.text().catch(() => '')
      console.error('replicate.createGeneration failed:', res.status, text.slice(0, 400))
      return null
    }
    const data = await res.json()
    if (!data?.id) {
      console.error('replicate.createGeneration: no id in response', data)
      return null
    }
    return { prediction_id: data.id }
  } catch (err) {
    console.error('replicate.createGeneration threw:', err)
    return null
  }
}

/**
 * Poll a prediction. Replicate returns one of:
 *   starting | processing | succeeded | failed | canceled
 * which we normalise to our internal four-state.
 */
export async function checkStatus(predictionId: string): Promise<ReplicateStatus | null> {
  try {
    const res = await fetch(`${BASE}/predictions/${encodeURIComponent(predictionId)}`, {
      headers: authHeaders(),
    })
    if (!res.ok) {
      const text = await res.text().catch(() => '')
      console.error('replicate.checkStatus failed:', res.status, text.slice(0, 400))
      return null
    }
    const data = await res.json()
    const raw = (data?.status ?? '').toString()
    let state: ReplicateStatus['state']
    if (raw === 'succeeded')                             state = 'done'
    else if (raw === 'failed' || raw === 'canceled')     state = 'failed'
    else if (raw === 'starting')                         state = 'queued'
    else                                                  state = 'generating'

    // Hunyuan3D-2 returns the GLB URL as `output` (string), or an object
    // with multiple format URLs. Normalise both.
    let glb_url: string | undefined
    const out = data?.output
    if (typeof out === 'string')           glb_url = out
    else if (Array.isArray(out) && out[0]) glb_url = typeof out[0] === 'string' ? out[0] : undefined
    else if (out && typeof out === 'object') {
      // try common shapes: { mesh: url } | { glb: url }
      glb_url = out.mesh ?? out.glb ?? out.url ?? undefined
    }

    return {
      state,
      raw,
      glb_url,
      error: data?.error ?? undefined,
    }
  } catch (err) {
    console.error('replicate.checkStatus threw:', err)
    return null
  }
}

/**
 * Download the mesh file at a URL into a Buffer for Vercel Blob storage.
 * Mirrors lib/rodin.fetchMesh.
 */
export async function fetchMesh(url: string): Promise<Buffer | null> {
  try {
    const res = await fetch(url)
    if (!res.ok) {
      console.error('replicate.fetchMesh failed:', res.status, url)
      return null
    }
    const arr = await res.arrayBuffer()
    return Buffer.from(arr)
  } catch (err) {
    console.error('replicate.fetchMesh threw:', err)
    return null
  }
}
