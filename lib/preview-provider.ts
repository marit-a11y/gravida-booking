// Thin dispatcher over lib/rodin and lib/replicate so the rest of the app
// can stay provider-agnostic. Pick which one by setting `PREVIEW_PROVIDER`
// in the environment (default = 'replicate' while we wait for the Rodin
// Business subscription to come through).
//
// API contract — all functions return null on failure and never throw at
// callers. The cron-poll job retries on null; complete() marks the scan
// as 'failed' so Laila sees the row and can handle it by hand.

import * as rodin     from './rodin'
import * as replicate from './replicate'

export type ProviderName = 'rodin' | 'replicate'

export function activeProvider(): ProviderName {
  const env = (process.env.PREVIEW_PROVIDER ?? 'replicate').toLowerCase().trim()
  return env === 'rodin' ? 'rodin' : 'replicate'
}

export interface PreviewJob {
  jobKey: string
}

export interface PreviewStatus {
  state: 'queued' | 'generating' | 'done' | 'failed'
  glb_url?: string
  stl_url?: string
  error?: string
}

/**
 * Starts a preview generation job with the active provider. Returns the
 * opaque jobKey we'll later poll for status. Caller persists the jobKey on
 * ai_scans.rodin_subscription_key (the column name predates the
 * provider-agnostic refactor — works fine for both).
 */
export async function startPreviewJob(opts: {
  imageUrls: string[]
}): Promise<PreviewJob | null> {
  const provider = activeProvider()
  if (provider === 'rodin') {
    const job = await rodin.createGeneration({
      imageUrls: opts.imageUrls,
      tier:      'Sketch',
    })
    return job ? { jobKey: job.subscription_key } : null
  }
  // replicate
  const job = await replicate.createGeneration({ imageUrls: opts.imageUrls })
  return job ? { jobKey: job.prediction_id } : null
}

/**
 * Polls the active provider for the job's current status. Returns a
 * normalised four-state plus any output URLs once done.
 */
export async function checkPreviewJob(jobKey: string): Promise<PreviewStatus | null> {
  const provider = activeProvider()
  if (provider === 'rodin') {
    const status = await rodin.checkStatus(jobKey)
    if (!status) return null
    if (status.state !== 'done') {
      return { state: status.state, error: status.error }
    }
    const urls = await rodin.downloadFormats(jobKey)
    return {
      state:   'done',
      glb_url: urls?.glb_url,
      stl_url: urls?.stl_url,
    }
  }
  // replicate
  const status = await replicate.checkStatus(jobKey)
  if (!status) return null
  return {
    state:   status.state,
    glb_url: status.glb_url,
    // Replicate's Hunyuan3D returns GLB only; STL comes back once Rodin is live.
    stl_url: undefined,
    error:   status.error,
  }
}

/**
 * Provider-agnostic mesh download into a Buffer for Vercel Blob storage.
 */
export async function fetchPreviewMesh(url: string): Promise<Buffer | null> {
  // The fetch implementations are identical; both providers serve direct
  // URLs. Use either's fetchMesh.
  return rodin.fetchMesh(url)
}
