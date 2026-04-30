import { NextRequest, NextResponse } from 'next/server'
import { put } from '@vercel/blob'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const MAX_FILE_BYTES = 50 * 1024 * 1024 // 50 MB
const ALLOWED_TYPES = [
  'image/jpeg', 'image/png', 'image/webp', 'image/gif',
  'video/mp4', 'video/quicktime', 'video/webm',
]

export async function POST(request: NextRequest) {
  try {
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      return NextResponse.json({
        error: 'Vercel Blob niet geconfigureerd. Voeg BLOB_READ_WRITE_TOKEN toe aan de Vercel env vars.',
      }, { status: 500 })
    }

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

    // Sanitise filename + add timestamp prefix to avoid collisions
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
