import { NextRequest, NextResponse } from 'next/server'
import { handleUpload, type HandleUploadBody } from '@vercel/blob/client'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// STL bestanden hebben geen vaste content-type; sommige browsers sturen
// 'model/stl' of 'application/sla', anderen application/octet-stream of leeg.
// We accepteren ze allemaal en valideren extensie aan client zijde.
const MAX_BYTES = 500 * 1024 * 1024 // 500 MB per scan

export async function POST(request: NextRequest) {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json({ error: 'Vercel Blob niet geconfigureerd' }, { status: 500 })
  }
  try {
    const body = (await request.json()) as HandleUploadBody
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async () => ({
        allowedContentTypes: [
          'model/stl', 'application/sla', 'application/vnd.ms-pki.stl',
          'application/octet-stream', 'application/x-tgif',
          '', // sommige browsers sturen geen content-type voor .stl
        ],
        maximumSizeInBytes: MAX_BYTES,
        addRandomSuffix: true,
      }),
      onUploadCompleted: async () => { /* niets */ },
    })
    return NextResponse.json(jsonResponse)
  } catch (err) {
    return NextResponse.json({ error: 'Upload mislukt: ' + String(err) }, { status: 500 })
  }
}
