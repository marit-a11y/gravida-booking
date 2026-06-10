// Rodin (Hyperhuman by Deemos) API client.
//
// Three operations matter for our flow:
//
//   1. createGeneration(images, tier) → kicks off a job, returns subscription_key
//   2. checkStatus(subscription_key)  → returns 'queued' | 'generating' | 'done' | 'failed'
//   3. downloadResult(subscription_key) → returns { glb: Blob, stl: Blob } when done
//
// Configured via env:
//   RODIN_API_KEY     - Bearer token from hyperhuman.deemos.com console
//   RODIN_API_BASE    - default 'https://hyperhuman.deemos.com/api/v2'
//
// The library never throws on a network error directly to callers — it
// returns null + logs so the cron-poll keeps moving. The caller decides what
// to do with a null (retry next minute, mark failed after N attempts).

const BASE      = (process.env.RODIN_API_BASE  ?? 'https://hyperhuman.deemos.com/api/v2').replace(/\/$/, '')
const API_KEY   = process.env.RODIN_API_KEY    ?? ''

// Tier names per Rodin API: Sketch | Regular | Detail | Smooth. Sketch is the
// cheapest+fastest, ideal for the in-app preview the customer sees before
// paying the deposit.
export type RodinTier = 'Sketch' | 'Regular' | 'Detail' | 'Smooth'

export interface CreateGenerationResult {
  subscription_key: string
  task_uuid?: string
}

export interface StatusResult {
  // Normalised across Rodin's status string variants.
  state: 'queued' | 'generating' | 'done' | 'failed'
  raw:   string
  result_url?: string
  error?: string
}

// Per-format URLs after a finished generation. Both come from the same mesh,
// just requested in different download formats.
export interface MeshUrls {
  glb_url?: string
  stl_url?: string
  obj_url?: string
}

function authHeaders(): Record<string, string> {
  if (!API_KEY) {
    throw new Error('RODIN_API_KEY env var is not set; cannot call Rodin.')
  }
  return { 'Authorization': `Bearer ${API_KEY}` }
}

/**
 * Kick off a Sketch-tier generation from N image URLs. We pass Vercel Blob
 * URLs directly (Rodin downloads them, no need to re-upload from our side).
 *
 * Returns the subscription_key the cron job will poll on, or null on
 * transport failure (caller retries).
 */
export async function createGeneration(opts: {
  imageUrls:     string[]
  tier:          RodinTier
  prompt?:       string
  addons?:       string[]              // e.g. ['HighPack']
}): Promise<CreateGenerationResult | null> {
  try {
    // Rodin accepts image_urls as an array of public URLs. Vercel Blob URLs
    // are public so this works without us proxying the bytes.
    const body = {
      images: opts.imageUrls,
      tier:    opts.tier,
      mesh_mode: 'Raw',
      material:  'PBR',
      // Request multiple output formats from the one generation. Rodin
      // returns a result_url that, on download, contains all of them.
      output_format: 'glb',
      addons:        opts.addons ?? [],
      prompt:        opts.prompt ?? '',
    }
    const res = await fetch(`${BASE}/rodin`, {
      method: 'POST',
      headers: { ...authHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!res.ok) {
      const text = await res.text().catch(() => '')
      console.error('rodin.createGeneration failed:', res.status, text.slice(0, 400))
      return null
    }
    const data = await res.json()
    if (!data?.subscription_key) {
      console.error('rodin.createGeneration: no subscription_key in response', data)
      return null
    }
    return { subscription_key: data.subscription_key, task_uuid: data.uuid }
  } catch (err) {
    console.error('rodin.createGeneration threw:', err)
    return null
  }
}

/**
 * Poll the status endpoint. Returns a normalised state we can compare
 * against in SQL ('queued', 'generating', 'done', 'failed').
 */
export async function checkStatus(subscriptionKey: string): Promise<StatusResult | null> {
  try {
    const res = await fetch(`${BASE}/status`, {
      method: 'POST',
      headers: { ...authHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ subscription_key: subscriptionKey }),
    })
    if (!res.ok) {
      const text = await res.text().catch(() => '')
      console.error('rodin.checkStatus failed:', res.status, text.slice(0, 400))
      return null
    }
    const data = await res.json()
    // Rodin returns either { status: 'Done', list: [...] } or { jobs: { ... } }
    // depending on version. Normalise.
    const raw = (data?.status ?? data?.state ?? '').toString()
    const r   = raw.toLowerCase()
    let state: StatusResult['state']
    if (r === 'done' || r === 'success' || r === 'completed') state = 'done'
    else if (r === 'failed' || r === 'error')                 state = 'failed'
    else if (r === 'queued' || r === 'pending')               state = 'queued'
    else                                                       state = 'generating'

    return {
      state,
      raw,
      result_url: data?.result_url ?? data?.download_url ?? undefined,
      error:      data?.error      ?? data?.message      ?? undefined,
    }
  } catch (err) {
    console.error('rodin.checkStatus threw:', err)
    return null
  }
}

/**
 * Download endpoint - asks Rodin for direct format URLs.
 * Some Rodin tiers return all formats in one zip; others expose per-format
 * download endpoints. We try the per-format endpoint first and fall back to
 * the result_url from the status check.
 */
export async function downloadFormats(subscriptionKey: string): Promise<MeshUrls | null> {
  try {
    const res = await fetch(`${BASE}/download`, {
      method: 'POST',
      headers: { ...authHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ subscription_key: subscriptionKey }),
    })
    if (!res.ok) {
      const text = await res.text().catch(() => '')
      console.error('rodin.downloadFormats failed:', res.status, text.slice(0, 400))
      return null
    }
    const data = await res.json()
    // Rodin returns a list of files; pick the glb + stl.
    const list: Array<{ name?: string; url?: string }> = data?.list ?? data?.files ?? []
    const byExt = (ext: string) => list.find((f) => (f.name ?? '').toLowerCase().endsWith('.' + ext))?.url
    return {
      glb_url: byExt('glb'),
      stl_url: byExt('stl'),
      obj_url: byExt('obj'),
    }
  } catch (err) {
    console.error('rodin.downloadFormats threw:', err)
    return null
  }
}

/**
 * Fetch a mesh file from a URL into a Buffer, for storing in Vercel Blob.
 * Used by the cron job after Rodin reports 'done'.
 */
export async function fetchMesh(url: string): Promise<Buffer | null> {
  try {
    const res = await fetch(url)
    if (!res.ok) {
      console.error('rodin.fetchMesh failed:', res.status, url)
      return null
    }
    const arr = await res.arrayBuffer()
    return Buffer.from(arr)
  } catch (err) {
    console.error('rodin.fetchMesh threw:', err)
    return null
  }
}
