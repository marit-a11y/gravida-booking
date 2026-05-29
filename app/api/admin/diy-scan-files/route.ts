import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@vercel/postgres'

export const dynamic = 'force-dynamic'

function parseOwner(searchParams: URLSearchParams): { kind: 'rental' | 'booking'; id: number } | null {
  const r = searchParams.get('rental_id')
  const b = searchParams.get('booking_id')
  if (r) return { kind: 'rental', id: parseInt(r, 10) }
  if (b) return { kind: 'booking', id: parseInt(b, 10) }
  return null
}

// GET ?rental_id=X | ?booking_id=X → bestanden + klantkeuze
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const owner = parseOwner(searchParams)
    if (!owner) return NextResponse.json({ error: 'rental_id of booking_id verplicht' }, { status: 400 })

    const files = owner.kind === 'rental'
      ? await sql`
          SELECT id, rental_id, booking_id, scan_label, blob_url, blob_pathname, filename,
                 size_bytes, notes, is_chosen, created_at::text
          FROM diy_scan_files
          WHERE rental_id = ${owner.id} AND deleted_at IS NULL
          ORDER BY scan_label ASC, created_at ASC
        `
      : await sql`
          SELECT id, rental_id, booking_id, scan_label, blob_url, blob_pathname, filename,
                 size_bytes, notes, is_chosen, created_at::text
          FROM diy_scan_files
          WHERE booking_id = ${owner.id} AND deleted_at IS NULL
          ORDER BY scan_label ASC, created_at ASC
        `

    const consent = owner.kind === 'rental'
      ? await sql`SELECT preferred_scan_number, submitted_at::text FROM scan_consents
                  WHERE diy_rental_id = ${owner.id} ORDER BY id DESC LIMIT 1`
      : await sql`SELECT preferred_scan_number, submitted_at::text FROM scan_consents
                  WHERE booking_id = ${owner.id} ORDER BY id DESC LIMIT 1`
    const chosenLabel = consent.rows[0]?.preferred_scan_number ?? null
    const consentSubmittedAt = consent.rows[0]?.submitted_at ?? null

    return NextResponse.json({
      files: files.rows,
      chosen_label: chosenLabel,
      consent_submitted_at: consentSubmittedAt,
    })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

// POST → registreer een geüpload bestand (rental_id OF booking_id)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { rental_id, booking_id, scan_label, blob_url, blob_pathname, filename, size_bytes, notes } = body
    if (!blob_url) {
      return NextResponse.json({ error: 'blob_url verplicht' }, { status: 400 })
    }
    if (!rental_id && !booking_id) {
      return NextResponse.json({ error: 'rental_id of booking_id verplicht' }, { status: 400 })
    }
    const label = [1, 2].includes(Number(scan_label)) ? Number(scan_label) : 1
    const r = await sql`
      INSERT INTO diy_scan_files (rental_id, booking_id, scan_label, blob_url, blob_pathname, filename, size_bytes, notes)
      VALUES (${rental_id ?? null}, ${booking_id ?? null}, ${label}, ${blob_url}, ${blob_pathname ?? null},
              ${filename ?? null}, ${size_bytes ?? null}, ${notes ?? null})
      RETURNING id, rental_id, booking_id, scan_label, blob_url, filename, size_bytes, created_at::text
    `
    return NextResponse.json({ file: r.rows[0] }, { status: 201 })
  } catch (err) {
    return NextResponse.json({ error: 'Toevoegen mislukt: ' + String(err) }, { status: 500 })
  }
}
