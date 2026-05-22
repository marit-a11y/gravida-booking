import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@vercel/postgres'
import { createGiftCard } from '@/lib/db'
import { sendDiyBorgKortingEmail, sendDiyBorgCadeaubonEmail } from '@/lib/email'
import { createWooCoupon, isWooCommerceConfigured } from '@/lib/woocommerce'

export const dynamic = 'force-dynamic'

export async function GET(_request: NextRequest, { params }: { params: { token: string } }) {
  try {
    const r = await sql`
      SELECT id, first_name, last_name, email, scanner_issues, scan_preference, deposit_choice,
             feedback_submitted_at::text
      FROM diy_rentals WHERE feedback_token = ${params.token} LIMIT 1
    `
    if (r.rows.length === 0) return NextResponse.json({ error: 'Niet gevonden' }, { status: 404 })
    return NextResponse.json({ rental: r.rows[0] })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

export async function POST(request: NextRequest, { params }: { params: { token: string } }) {
  try {
    const body = await request.json()
    const { scanner_issues, deposit_choice, scan_preference } = body as {
      scanner_issues?: string
      deposit_choice: 'order_credit' | 'giftcard'
      scan_preference?: string
    }

    if (!deposit_choice || !['order_credit', 'giftcard'].includes(deposit_choice)) {
      return NextResponse.json({ error: 'Maak een keuze voor je aanbetaling.' }, { status: 400 })
    }

    // Find rental
    const r = await sql`
      SELECT id, first_name, last_name, email
      FROM diy_rentals WHERE feedback_token = ${params.token} LIMIT 1
    `
    if (r.rows.length === 0) return NextResponse.json({ error: 'Niet gevonden' }, { status: 404 })
    const rental = r.rows[0]

    // Automatisch aanmaken: kortingscode (order_credit) OF cadeaubon (giftcard)
    // In beide gevallen gebruiken we de gift_cards tabel met verschillende types.
    let giftCardId: number | null = null
    let createdCode: string | null = null

    let wooCouponCreated = false

    if (deposit_choice === 'order_credit') {
      // Kortingscode €200 voor verrekenen met beeldje-bestelling
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
      giftCardId = card?.id ?? null
      createdCode = card?.code ?? null

      // Sync naar WooCommerce als coupon
      if (card?.code) {
        const wc = await createWooCoupon({
          code: card.code,
          discount_type: 'fixed_cart',
          amount: '200.00',
          description: `Borg-verrekening DIY scan kit - ${rental.first_name} ${rental.last_name}`,
          email_restrictions: [rental.email],
          usage_limit: 1,
        })
        wooCouponCreated = wc.ok

        sendDiyBorgKortingEmail({
          first_name: rental.first_name,
          email: rental.email,
          code: card.code,
          value_euros: 200,
        }).catch(err => console.error('Kortingscode mail error:', err))
      }
    } else if (deposit_choice === 'giftcard') {
      // Cadeaubon €100 (andere €100 borg storten we terug)
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
      giftCardId = card?.id ?? null
      createdCode = card?.code ?? null

      if (card?.code) {
        // Cadeaubon als WC coupon, vervaldatum doorgeven indien beschikbaar
        const wc = await createWooCoupon({
          code: card.code,
          discount_type: 'fixed_cart',
          amount: '100.00',
          description: `Cadeaubon - ${rental.first_name} ${rental.last_name}`,
          date_expires: card.expires_at,
          usage_limit: 1,
        })
        wooCouponCreated = wc.ok

        sendDiyBorgCadeaubonEmail({
          first_name: rental.first_name,
          email: rental.email,
          code: card.code,
          value_euros: 100,
          expires_at: card.expires_at,
        }).catch(err => console.error('Cadeaubon mail error:', err))
      }
    }

    await sql`
      UPDATE diy_rentals SET
        scanner_issues = ${scanner_issues?.trim() || null},
        scan_preference = ${scan_preference?.trim() || null},
        deposit_choice = ${deposit_choice},
        giftcard_id = ${giftCardId},
        feedback_submitted_at = NOW()
      WHERE feedback_token = ${params.token}
    `

    // Inbox notify
    const wcStatus = createdCode
      ? (wooCouponCreated ? ' (sync naar WooCommerce gelukt)' : ' (LET OP: niet gesynced naar WooCommerce, handmatig toevoegen)')
      : ''
    const choiceLabel: Record<string, string> = {
      order_credit: `volledig verrekenen met beeldje, kortingscode ${createdCode ?? '?'} (200 euro) automatisch aangemaakt en gemaild${wcStatus}`,
      giftcard: `cadeaubon ${createdCode ?? '?'} (100 euro) automatisch aangemaakt en gemaild, 100 euro borg nog terugstorten${wcStatus}`,
    }
    for (const recipient of ['Marit', 'Laila']) {
      await sql`
        INSERT INTO inbox_items (recipient, type, title, body, link)
        VALUES (
          ${recipient},
          'diy_feedback',
          ${'DIY feedback van ' + rental.first_name + ' ' + rental.last_name},
          ${'Borg-keuze: ' + choiceLabel[deposit_choice] + (scanner_issues ? '\n\nBijzonderheden: ' + scanner_issues : '')},
          '/admin/diy-scanners'
        )
      `.catch(err => console.error('Inbox notify error (diy feedback):', err))
    }

    return NextResponse.json({ ok: true, giftcard_id: giftCardId })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: 'Opslaan mislukt: ' + msg }, { status: 500 })
  }
}
