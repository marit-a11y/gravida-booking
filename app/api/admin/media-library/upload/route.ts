import { NextRequest, NextResponse } from 'next/server'
import { handleUpload, type HandleUploadBody } from '@vercel/blob/client'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const ALLOWED = [
  'image/jpeg', 'image/png', 'image/webp', 'image/gif',
  'video/mp4', 'video/quicktime', 'video/webm',
]
const MAX_BYTES = 500 * 1024 * 1024 // 500 MB voor video's

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
        allowedContentTypes: ALLOWED,
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
