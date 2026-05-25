import { NextRequest, NextResponse } from 'next/server'
import { put } from '@vercel/blob'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const MAX = 15 * 1024 * 1024
const TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']

export async function POST(request: NextRequest) {
  try {
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      return NextResponse.json({ error: 'Blob niet geconfigureerd' }, { status: 500 })
    }
    const form = await request.formData()
    const file = form.get('file')
    const folder = (form.get('folder') as string) || 'cms'
    if (!(file instanceof File)) return NextResponse.json({ error: 'Geen bestand' }, { status: 400 })
    if (file.size > MAX) return NextResponse.json({ error: `Max ${MAX / 1024 / 1024} MB` }, { status: 413 })
    if (!TYPES.includes(file.type)) return NextResponse.json({ error: `Type niet toegestaan: ${file.type}` }, { status: 415 })

    const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 80)
    const filename = `${folder}/${Date.now()}-${safe}`
    const blob = await put(filename, file, { access: 'public', contentType: file.type, addRandomSuffix: false })
    return NextResponse.json({ url: blob.url, size: file.size, type: file.type })
  } catch (err) {
    return NextResponse.json({ error: 'Upload mislukt: ' + String(err) }, { status: 500 })
  }
}
