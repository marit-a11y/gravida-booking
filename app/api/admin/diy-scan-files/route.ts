import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@vercel/postgres'

export const dynamic = 'force-dynamic'

// GET /api/admin/diy-scan-files?rental_id=123
// → lijst van actieve scan-bestanden voor een rental, plus de klantkeuze
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const rentalId = searchParams.get('rental_id')
    if (!rentalId) return NextResponse.json({ error: 'rental_id verplicht' }, { status: 400 })

    const files = await sql`
      SELECT id, rental_id, scan_label, blob_url, blob_pathname, filename,
             size_bytes, notes, is_chosen, created_at::text
      FROM diy_scan_files
      WHERE rental_id = ${parseInt(rentalId, 10)} AND deleted_at IS NULL
      ORDER BY scan_label ASC, created_at ASC
    `

    // Klantkeuze uit scan_consents (kan nog null zijn)
    const consent = await sql`
      SELECT preferred_scan_number, submitted_at::text
      FROM scan_consents
      WHERE diy_rental_id = ${parseInt(rentalId, 10)}
      ORDER BY id DESC LIMIT 1
    `
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

// POST /api/admin/diy-scan-files
// → registreer een nieuw geüpload bestand (na client-upload naar Blob)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { rental_id, scan_label, blob_url, blob_pathname, filename, size_bytes, notes } = body
    if (!rental_id || !blob_url) {
      return NextResponse.json({ error: 'rental_id en blob_url verplicht' }, { status: 400 })
    }
    const label = [1, 2].includes(Number(scan_label)) ? Number(scan_label) : 1
    const r = await sql`
      INSERT INTO diy_scan_files (rental_id, scan_label, blob_url, blob_pathname, filename, size_bytes, notes)
      VALUES (${rental_id}, ${label}, ${blob_url}, ${blob_pathname ?? null}, ${filename ?? null},
              ${size_bytes ?? null}, ${notes ?? null})
      RETURNING id, scan_label, blob_url, filename, size_bytes, created_at::text
    `
    return NextResponse.json({ file: r.rows[0] }, { status: 201 })
  } catch (err) {
    return NextResponse.json({ error: 'Toevoegen mislukt: ' + String(err) }, { status: 500 })
  }
}
