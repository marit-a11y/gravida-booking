import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import crypto from 'crypto'
import { verifyToken, COOKIE_NAME } from '@/lib/auth'
import { sendDiyReviewEmail, DiyBijzonderheid } from '@/lib/email'
import { sql } from '@vercel/postgres'

export const dynamic = 'force-dynamic'

async function checkAuth(): Promise<boolean> {
  const cookieStore = cookies()
  const token = cookieStore.get(COOKIE_NAME)?.value
  if (!token) return false
  const secret = process.env.JWT_SECRET ?? process.env.ADMIN_PASSWORD ?? ''
  return verifyToken(token, secret)
}

export async function POST(request: NextRequest) {
  if (!(await checkAuth())) {
    return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const {
      klant_naam,
      klant_email,
      bijzonderheden,
      anders_tekst,
      bruikbaar,
      extra_wensen,
      images, // Array<{ filename: string; base64: string }>
      rental_id,
    } = body

    if (!klant_naam?.trim() || !klant_email?.trim()) {
      return NextResponse.json({ error: 'Naam en e-mailadres zijn verplicht' }, { status: 400 })
    }

    const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRe.test(klant_email)) {
      return NextResponse.json({ error: 'Ongeldig e-mailadres' }, { status: 400 })
    }

    if (!bruikbaar) {
      return NextResponse.json({ error: 'Scan is niet bruikbaar — stuur geen automatische mail' }, { status: 400 })
    }

    // Convert base64 images to Buffers
    const imageAttachments = (images ?? []).map((img: { filename: string; base64: string }) => ({
      filename: img.filename,
      content: Buffer.from(img.base64, 'base64'),
    }))

    // Probeer rental te vinden — eerst via meegegeven ID, anders via email
    let resolvedRentalId: number | null = (typeof rental_id === 'number') ? rental_id : null
    if (!resolvedRentalId) {
      const lookup = await sql<{ id: number }>`
        SELECT id FROM diy_rentals
        WHERE LOWER(email) = ${klant_email.trim().toLowerCase()}
          AND status IN ('uitzoeken', 'retour')
        ORDER BY rental_week DESC
        LIMIT 1
      `
      resolvedRentalId = lookup.rows[0]?.id ?? null
    }

    // Gekoppeld aan een rental? Maak/find scan_consent en bouw form-link
    let consentFormUrl: string | undefined = undefined
    if (resolvedRentalId) {
      try {
        const existing = await sql<{ token: string }>`
          SELECT token FROM scan_consents WHERE diy_rental_id = ${resolvedRentalId} LIMIT 1
        `
        let token: string
        if (existing.rows[0]?.token) {
          token = existing.rows[0].token
        } else {
          token = crypto.randomBytes(20).toString('hex')
          await sql`
            INSERT INTO scan_consents (diy_rental_id, token)
            VALUES (${resolvedRentalId}, ${token})
          `
          // Markeer sent_at zodat we weten dat de klant de URL nu krijgt
          await sql`
            UPDATE scan_consents SET sent_at = NOW()
            WHERE diy_rental_id = ${resolvedRentalId}
          `
        }
        consentFormUrl = `https://dashboard.gravida.nl/scan-toestemming/${token}`
      } catch (err) {
        console.error('Failed to prepare scan-consent token:', err)
      }
    }

    await sendDiyReviewEmail({
      klant_naam: klant_naam.trim(),
      klant_email: klant_email.trim().toLowerCase(),
      bijzonderheden: (bijzonderheden ?? []) as DiyBijzonderheid[],
      anders_tekst: anders_tekst?.trim() || undefined,
      bruikbaar,
      extra_wensen: extra_wensen?.trim() || undefined,
      images: imageAttachments,
      consent_form_url: consentFormUrl,
    })

    // Status-update naar 'scans_uitgezocht'
    if (resolvedRentalId) {
      try {
        await sql`UPDATE diy_rentals SET status = 'scans_uitgezocht' WHERE id = ${resolvedRentalId}`
      } catch (err) {
        console.error('Failed to update rental status after review:', err)
      }
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('DIY review email error:', err)
    const msg = err instanceof Error ? err.message : 'Onbekende fout'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
