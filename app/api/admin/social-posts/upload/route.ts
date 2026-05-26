import { NextRequest, NextResponse } from 'next/server'
import { handleUpload, type HandleUploadBody } from '@vercel/blob/client'
import { put } from '@vercel/blob'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const MAX_FILE_BYTES = 200 * 1024 * 1024 // 200 MB (videos)
const ALLOWED_TYPES = [
  'image/jpeg', 'image/png', 'image/webp', 'image/gif',
  'video/mp4', 'video/quicktime', 'video/webm',
]

/**
 * Twee upload-paden:
 *
 * 1. Direct upload (client → Blob, voor grote bestanden zoals mp4):
 *    Client gebruikt `upload()` van @vercel/blob/client. Die roept dit
 *    endpoint aan om een token op te halen, uploadt rechtstreeks naar
 *    Vercel Blob, en stuurt callback hierheen. Geen 4.5 MB limit.
 *
 * 2. Server upload (legacy multipart/form-data via deze function):
 *    Werkt alleen voor kleine bestanden (<4 MB) door Vercel function
 *    body limit. Houden voor backwards compat met oude client-code.
 */
export async function POST(request: NextRequest) {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json({
      error: 'Vercel Blob niet geconfigureerd. Voeg BLOB_READ_WRITE_TOKEN toe.',
    }, { status: 500 })
  }

  const contentType = request.headers.get('content-type') ?? ''

  // Pad 1: client-side direct upload flow
  if (contentType.includes('application/json')) {
    try {
      const body = (await request.json()) as HandleUploadBody
      const jsonResponse = await handleUpload({
        body,
        request,
        onBeforeGenerateToken: async (pathname, clientPayload) => {
          return {
            allowedContentTypes: ALLOWED_TYPES,
            maximumSizeInBytes: MAX_FILE_BYTES,
            addRandomSuffix: true,
            tokenPayload: clientPayload ?? null,
          }
        },
        onUploadCompleted: async () => {
          // Geen extra werk; client krijgt de blob URL terug
        },
      })
      return NextResponse.json(jsonResponse)
    } catch (err) {
      console.error('client-upload handler error:', err)
      const msg = err instanceof Error ? err.message : String(err)
      return NextResponse.json({ error: 'Upload mislukt: ' + msg }, { status: 500 })
    }
  }

  // Pad 2: legacy server-side upload (multipart/form-data)
  try {
    const form = await request.formData()
    const file = form.get('file')
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'Geen bestand ontvangen' }, { status: 400 })
    }
    if (file.size > MAX_FILE_BYTES) {
      return NextResponse.json({ error: `Bestand te groot (max ${MAX_FILE_BYTES / 1024 / 1024} MB)` }, { status: 413 })
    }
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json({ error: `Type niet toegestaan: ${file.type}` }, { status: 415 })
    }
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 80)
    const filename = `social/${Date.now()}-${safeName}`
    const blob = await put(filename, file, {
      access: 'public',
      contentType: file.type,
      addRandomSuffix: false,
    })
    return NextResponse.json({ url: blob.url, size: file.size, type: file.type })
  } catch (err) {
    console.error('upload error:', err)
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: 'Upload mislukt: ' + msg }, { status: 500 })
  }
}
