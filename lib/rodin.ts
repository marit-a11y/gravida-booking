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
 * Kick off a Sketch-tier generation from N image URLs.
 *
 * Rodin expects multipart/form-data with the image bytes attached as files
 * under the `images` field. We download each URL into a Blob first, then
 * forward through FormData. Vercel Blob URLs are public so the fetch needs
 * no auth.
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
    const form = new FormData()
    // Pull each image into a Blob and append as a multipart file. Rodin
    // requires the actual bytes, not a JSON array of URLs.
    let appended = 0
    for (const url of opts.imageUrls) {
      try {
        const imgRes = await fetch(url)
        if (!imgRes.ok) {
          console.error('rodin.createGeneration: image fetch failed', imgRes.status, url)
          continue
        }
        const blob = await imgRes.blob()
        const filename = (url.split('/').pop() || `image-${appended}.jpg`).split('?')[0]
        form.append('images', blob, filename)
        appended++
      } catch (err) {
        console.error('rodin.createGeneration: image fetch threw', err, url)
      }
    }
    if (appended === 0) {
      console.error('rodin.createGeneration: no images could be fetched, aborting')
      return null
    }

    // Remaining fields go as form values. Rodin's docs call them
    // multipart form fields, not JSON nested objects.
    form.append('tier',          opts.tier)
    form.append('mesh_mode',     'Raw')
    form.append('material',      'PBR')
    form.append('output_format', 'glb')
    if (opts.prompt)             form.append('prompt', opts.prompt)
    for (const addon of opts.addons ?? []) form.append('addons', addon)

    // IMPORTANT: do NOT set Content-Type ourselves; fetch picks the right
    // multipart boundary automatically. Manually setting application/json
    // here is what broke the first smoke test.
    const res = await fetch(`${BASE}/rodin`, {
      method: 'POST',
      headers: authHeaders(),
      body: form,
    })
    if (!res.ok) {
      const text = await res.text().catch(() => '')
      console.error('rodin.createGeneration failed:', res.status, text.slice(0, 400))
      return null
    }
    const data = await res.json()
    // Rodin nests the subscription_key under `jobs`. Top-level uuid is
    // the parent task id; the individual sub-jobs (one per output format
    // / addon) live under jobs.uuids. We only need subscription_key for
    // polling and the parent uuid for our records.
    const subscriptionKey = data?.jobs?.subscription_key ?? data?.subscription_key
    if (!subscriptionKey) {
      console.error('rodin.createGeneration: no subscription_key in response', data)
      return null
    }
    return { subscription_key: subscriptionKey, task_uuid: data.uuid }
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
