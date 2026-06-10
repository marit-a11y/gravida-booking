/** Standalone version of the cron-poll logic: no internal imports so it
 *  runs straight under npx ts-node without ESM resolution headaches.
 *  Mirrors the production /api/cron/rodin-poll behaviour for the Replicate
 *  provider — Rodin path elided since we're on the temp fallback.
 */
import { sql } from '@vercel/postgres'
import { put } from '@vercel/blob'

async function checkReplicate(predictionId: string) {
  const token = process.env.REPLICATE_API_TOKEN ?? ''
  const res = await fetch(`https://api.replicate.com/v1/predictions/${encodeURIComponent(predictionId)}`, {
    headers: { 'Authorization': `Bearer ${token}` },
  })
  if (!res.ok) return null
  const data: any = await res.json()
  const raw = (data?.status ?? '').toString()
  let state: 'queued' | 'generating' | 'done' | 'failed'
  if (raw === 'succeeded')                          state = 'done'
  else if (raw === 'failed' || raw === 'canceled')  state = 'failed'
  else if (raw === 'starting')                      state = 'queued'
  else                                               state = 'generating'

  let glb_url: string | undefined
  const out = data?.output
  if (typeof out === 'string')                       glb_url = out
  else if (Array.isArray(out) && out[0])             glb_url = typeof out[0] === 'string' ? out[0] : undefined
  else if (out && typeof out === 'object')           glb_url = out.mesh ?? out.glb ?? out.url
  return { state, raw, glb_url, error: data?.error as string | undefined }
}

async function fetchBuf(url: string): Promise<Buffer | null> {
  const res = await fetch(url); if (!res.ok) return null
  return Buffer.from(await res.arrayBuffer())
}

async function main() {
  const rows = await sql<{
    id: number, session_id: string, rodin_subscription_key: string | null,
    preview_status: string,
  }>`SELECT id, session_id, rodin_subscription_key, preview_status
     FROM ai_scans WHERE preview_status IN ('queued','generating') LIMIT 25`
  console.log('inflight:', rows.rows.length)

  for (const scan of rows.rows) {
    console.log(`\n#${scan.id} key=${scan.rodin_subscription_key}`)
    if (!scan.rodin_subscription_key) continue
    const status = await checkReplicate(scan.rodin_subscription_key)
    if (!status) { console.log('  fetch failed'); continue }
    console.log('  replicate says:', status.state, 'glb=', !!status.glb_url)
    if (status.state === 'failed') {
      await sql`UPDATE ai_scans SET preview_status='failed', preview_error=${status.error ?? 'failed'} WHERE id=${scan.id}`
      console.log('  marked failed'); continue
    }
    if (status.state !== 'done') {
      console.log('  still working'); continue
    }
    if (!status.glb_url) { console.log('  no glb url'); continue }
    const buf = await fetchBuf(status.glb_url)
    if (!buf) { console.log('  download failed'); continue }
    const blob = await put(`ai-scans/${scan.session_id}/preview.glb`, buf, {
      access: 'public', contentType: 'model/gltf-binary', addRandomSuffix: false,
    })
    await sql`
      UPDATE ai_scans
         SET preview_status='ready', preview_glb_url=${blob.url},
             preview_completed_at=NOW(), preview_error=NULL
       WHERE id=${scan.id}
    `
    console.log('  -> READY at', blob.url)
  }
  process.exit(0)
}
main().catch(e => { console.error(e); process.exit(1) })
