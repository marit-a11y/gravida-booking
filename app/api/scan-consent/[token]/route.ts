import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@vercel/postgres'
import { createGiftCard } from '@/lib/db'
import { sendDiyBorgKortingEmail, sendDiyBorgCadeaubonEmail } from '@/lib/email'
import { createWooCoupon } from '@/lib/woocommerce'

export const dynamic = 'force-dynamic'

// GET: fetch consent by token (publiek, voor het invullen)
export async function GET(_request: NextRequest, { params }: { params: { token: string } }) {
  try {
    const r = await sql`
      SELECT id, token, material, finish, size, size_other, with_arms, weighted,
             consent_storage_files, consent_marketing_use, consent_interview,
             digital_wishes, shared_notes, preferred_scan_number, booking_id, diy_rental_id,
             submitted_at::text
      FROM scan_consents WHERE token = ${params.token} LIMIT 1
    `
    if (r.rows.length === 0) return NextResponse.json({ error: 'Niet gevonden' }, { status: 404 })
    const consent = r.rows[0]

    // Klantnaam + klantnummer + (bij DIY) bestaande deposit_choice
    let firstName: string | null = null
    let customerNumber: string | null = null
    let isDiy = false
    let depositChoice: string | null = null
    if (consent.booking_id) {
      const b = await sql`SELECT first_name, customer_number FROM bookings WHERE id = ${consent.booking_id}`
      firstName = b.rows[0]?.first_name ?? null
      customerNumber = b.rows[0]?.customer_number ?? null
    } else if (consent.diy_rental_id) {
      isDiy = true
      const x = await sql`SELECT first_name, customer_number, deposit_choice FROM diy_rentals WHERE id = ${consent.diy_rental_id}`
      firstName = x.rows[0]?.first_name ?? null
      customerNumber = x.rows[0]?.customer_number ?? null
      depositChoice = x.rows[0]?.deposit_choice ?? null
    }

    return NextResponse.json({
      consent,
      first_name: firstName,
      customer_number: customerNumber,
      is_diy: isDiy,
      deposit_choice: depositChoice,
    })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

// POST: klant submit antwoorden
export async function POST(request: NextRequest, { params }: { params: { token: string } }) {
  try {
    const body = await request.json()
    const {
      consent_storage_files,
      consent_marketing_use,
      consent_interview,
      digital_wishes,
      shared_notes,
      preferred_scan_number,
      deposit_choice,  // alleen relevant voor DIY rentals
    } = body

    const r = await sql`
      UPDATE scan_consents SET
        consent_storage_files = ${consent_storage_files ?? null},
        consent_marketing_use = ${consent_marketing_use ?? null},
        consent_interview = ${consent_interview ?? null},
        digital_wishes = ${digital_wishes ?? null},
        shared_notes = ${shared_notes ?? null},
        preferred_scan_number = ${preferred_scan_number ?? null},
        submitted_at = NOW(),
        updated_at = NOW()
      WHERE token = ${params.token}
      RETURNING id, booking_id, diy_rental_id
    `
    if (r.rows.length === 0) return NextResponse.json({ error: 'Niet gevonden' }, { status: 404 })
    const consentRow = r.rows[0]

    // ── Borg-afhandeling (alleen voor DIY rentals) ──────────────────────────
    let depositInfo: { code: string | null; type: 'order_credit' | 'giftcard'; value: number } | null = null
    if (consentRow.diy_rental_id && (deposit_choice === 'order_credit' || deposit_choice === 'giftcard')) {
      const rental = (await sql`
        SELECT id, first_name, last_name, email, deposit_choice
        FROM diy_rentals WHERE id = ${consentRow.diy_rental_id} LIMIT 1
      `).rows[0]
      // Alleen aanmaken bij EERSTE keer een keuze (idempotent)
      if (rental && !rental.deposit_choice) {
        if (deposit_choice === 'order_credit') {
          const card = await createGiftCard({
            type: 'borg_korting',
            value_euros: 200,
            purchaser_name: `${rental.first_name} ${rental.last_name}`,
            purchaser_email: rental.email,
            recipient_name: `${rental.first_name} ${rental.last_name}`,
            recipient_email: rental.email,
            personal_message: 'Borg-verrekening DIY scan kit',
            status: 'actief',
          }).catch(err => { console.error('Auto-kortingscode create error:', err); return null })

          if (card?.code) {
            await createWooCoupon({
              code: card.code,
              discount_type: 'fixed_cart',
              amount: '200.00',
              description: `Borg-verrekening DIY scan kit - ${rental.first_name} ${rental.last_name}`,
              email_restrictions: [rental.email],
              usage_limit: 1,
            }).catch(err => console.error('Woo coupon create error:', err))
            sendDiyBorgKortingEmail({
              first_name: rental.first_name,
              email: rental.email,
              code: card.code,
              value_euros: 200,
            }).catch(err => console.error('Kortingscode mail error:', err))
          }
          depositInfo = { code: card?.code ?? null, type: 'order_credit', value: 200 }
        } else {
          const card = await createGiftCard({
            type: 'digitaal',
            value_euros: 100,
            purchaser_name: `${rental.first_name} ${rental.last_name}`,
            purchaser_email: rental.email,
            recipient_name: `${rental.first_name} ${rental.last_name}`,
            recipient_email: rental.email,
            personal_message: 'Cadeaubon vanuit DIY borg-omzetting',
            status: 'actief',
          }).catch(err => { console.error('Auto-cadeaubon create error:', err); return null })

          if (card?.code) {
            await createWooCoupon({
              code: card.code,
              discount_type: 'fixed_cart',
              amount: '100.00',
              description: `Cadeaubon - ${rental.first_name} ${rental.last_name}`,
              date_expires: card.expires_at,
              usage_limit: 1,
            }).catch(err => console.error('Woo coupon create error:', err))
            sendDiyBorgCadeaubonEmail({
              first_name: rental.first_name,
              email: rental.email,
              code: card.code,
              value_euros: 100,
              expires_at: card.expires_at,
            }).catch(err => console.error('Cadeaubon mail error:', err))
          }
          depositInfo = { code: card?.code ?? null, type: 'giftcard', value: 100 }
        }
        await sql`
          UPDATE diy_rentals SET deposit_choice = ${deposit_choice}
          WHERE id = ${consentRow.diy_rental_id}
        `
      }
    }

    // Inbox notify
    const klantNaam = await (async () => {
      if (consentRow.booking_id) {
        const b = await sql`SELECT first_name, last_name FROM bookings WHERE id = ${consentRow.booking_id}`
        return b.rows[0] ? `${b.rows[0].first_name} ${b.rows[0].last_name}` : 'klant'
      }
      if (consentRow.diy_rental_id) {
        const x = await sql`SELECT first_name, last_name FROM diy_rentals WHERE id = ${consentRow.diy_rental_id}`
        return x.rows[0] ? `${x.rows[0].first_name} ${x.rows[0].last_name}` : 'klant'
      }
      return 'klant'
    })()

    const recipients = await (await import('@/lib/inbox-recipients')).getRecipientsForPage('boekingen')
    const depositLine = depositInfo
      ? `\n\nBorg-keuze: ${depositInfo.type === 'order_credit'
          ? `kortingscode ${depositInfo.code ?? '?'} (€200) automatisch aangemaakt en gemaild`
          : `cadeaubon ${depositInfo.code ?? '?'} (€100) automatisch aangemaakt en gemaild, €100 borg nog terugstorten`}`
      : ''
    for (const recipient of recipients) {
      await sql`
        INSERT INTO inbox_items (recipient, type, title, body, link)
        VALUES (
          ${recipient},
          'consent_submitted',
          ${'📝 Toestemmingsformulier ingevuld door ' + klantNaam},
          ${'De klant heeft het toestemmingsformulier ingevuld. Bekijk de antwoorden in het beheer.' + depositLine},
          ${consentRow.booking_id ? '/admin/boekingen' : '/admin/diy-scanners'}
        )
      `.catch(err => console.error('Inbox notify error (consent submit):', err))
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: 'Opslaan mislukt: ' + msg }, { status: 500 })
  }
}
