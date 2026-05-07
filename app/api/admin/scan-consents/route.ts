import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@vercel/postgres'
import crypto from 'crypto'

export const dynamic = 'force-dynamic'

// GET ?booking_id=X or ?diy_rental_id=X → fetch consent for booking/rental
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const bookingId = searchParams.get('booking_id')
    const rentalId = searchParams.get('diy_rental_id')

    if (bookingId) {
      const r = await sql`
        SELECT * FROM scan_consents WHERE booking_id = ${parseInt(bookingId, 10)} LIMIT 1
      `
      return NextResponse.json({ consent: r.rows[0] ?? null })
    }
    if (rentalId) {
      const r = await sql`
        SELECT * FROM scan_consents WHERE diy_rental_id = ${parseInt(rentalId, 10)} LIMIT 1
      `
      return NextResponse.json({ consent: r.rows[0] ?? null })
    }
    return NextResponse.json({ error: 'booking_id of diy_rental_id verplicht' }, { status: 400 })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

// POST: create or update scan-keuzes (door Laila/Marit)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      booking_id, diy_rental_id,
      material, finish, size, size_other,
      with_arms, weighted, internal_notes,
      digital_wishes, shared_notes,
    } = body

    if (!booking_id && !diy_rental_id) {
      return NextResponse.json({ error: 'booking_id of diy_rental_id verplicht' }, { status: 400 })
    }

    // Check if consent already exists
    const existing = booking_id
      ? await sql`SELECT id FROM scan_consents WHERE booking_id = ${booking_id} LIMIT 1`
      : await sql`SELECT id FROM scan_consents WHERE diy_rental_id = ${diy_rental_id} LIMIT 1`

    if (existing.rows.length > 0) {
      const id = existing.rows[0].id
      // Behoud bestaande klant-antwoorden bij digital_wishes update.
      // Als klant nog niet ingevuld heeft, mag admin de wensen aanpassen.
      const existingConsent = await sql`SELECT submitted_at, digital_wishes, shared_notes FROM scan_consents WHERE id = ${id}`
      const isSubmitted = existingConsent.rows[0]?.submitted_at !== null
      // Behoud klant-antwoorden na submit; daarvoor mag admin overschrijven
      const newWishes = !isSubmitted && digital_wishes !== undefined
        ? digital_wishes
        : existingConsent.rows[0]?.digital_wishes ?? null
      const newSharedNotes = !isSubmitted && shared_notes !== undefined
        ? shared_notes
        : existingConsent.rows[0]?.shared_notes ?? null

      await sql`
        UPDATE scan_consents SET
          material = ${material ?? null},
          finish = ${finish ?? null},
          size = ${size ?? null},
          size_other = ${size_other ?? null},
          with_arms = ${with_arms ?? null},
          weighted = ${weighted ?? null},
          internal_notes = ${internal_notes ?? null},
          digital_wishes = ${newWishes},
          shared_notes = ${newSharedNotes},
          updated_at = NOW()
        WHERE id = ${id}
      `
      const r = await sql`SELECT * FROM scan_consents WHERE id = ${id}`
      return NextResponse.json({ consent: r.rows[0] })
    } else {
      const token = crypto.randomBytes(20).toString('hex')
      const r = await sql`
        INSERT INTO scan_consents (
          booking_id, diy_rental_id, token,
          material, finish, size, size_other,
          with_arms, weighted, internal_notes, digital_wishes, shared_notes
        ) VALUES (
          ${booking_id ?? null},
          ${diy_rental_id ?? null},
          ${token},
          ${material ?? null},
          ${finish ?? null},
          ${size ?? null},
          ${size_other ?? null},
          ${with_arms ?? null},
          ${weighted ?? null},
          ${internal_notes ?? null},
          ${digital_wishes ?? null},
          ${shared_notes ?? null}
        )
        RETURNING *
      `
      return NextResponse.json({ consent: r.rows[0] }, { status: 201 })
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: 'Opslaan mislukt: ' + msg }, { status: 500 })
  }
}
