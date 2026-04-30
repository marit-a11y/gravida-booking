import { NextRequest, NextResponse } from 'next/server'
import { getDiyWeekStatuses, createDiyRental, updateDiyRentalPayment } from '@/lib/db'
import { getMollie } from '@/lib/mollie'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const weekStatuses = await getDiyWeekStatuses()
    // Also return `weeks` (bookable-only) for backwards compatibility with any
    // admin code that still expects a simple string list.
    const weeks = weekStatuses.filter(w => w.status !== 'sold_out').map(w => w.monday)
    return NextResponse.json({ weeks, weekStatuses })
  } catch (err) {
    console.error('GET /api/diy-rentals error:', err)
    return NextResponse.json({ error: 'Kan beschikbaarheid niet laden' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { rental_week, first_name, last_name, email, phone, address, city, zip_code, notes } = body

    if (!rental_week || !first_name || !last_name || !email || !phone || !address || !city || !zip_code) {
      return NextResponse.json({ error: 'Verplichte velden ontbreken' }, { status: 400 })
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: 'Ongeldig e-mailadres' }, { status: 400 })
    }

    // Create rental with status wacht_op_betaling
    const rental = await createDiyRental({
      rental_week,
      first_name: first_name.trim(),
      last_name: last_name.trim(),
      email: email.trim().toLowerCase(),
      phone: phone.trim(),
      address: address.trim(),
      city: city.trim(),
      zip_code: zip_code.trim(),
      notes: notes?.trim() || undefined,
    })

    // Create Mollie payment
    const origin = request.headers.get('origin') || request.headers.get('referer')?.replace(/\/[^/]*$/, '') || ''
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || origin || 'https://dashboard.gravida.nl'

    if (!process.env.MOLLIE_API_KEY) {
      return NextResponse.json({ error: 'Betalingssysteem niet geconfigureerd. Neem contact op.' }, { status: 500 })
    }
    const mollieClient = getMollie()
    const payment = await mollieClient.payments.create({
      amount: { currency: 'EUR', value: '200.00' },
      description: `Borg DIY 3D scan kit — ${rental.rental_week}`,
      redirectUrl: `${siteUrl}/diy-scan/bevestiging?rental_id=${rental.id}`,
      webhookUrl: `${siteUrl}/api/diy-rentals/webhook`,
      metadata: { rental_id: String(rental.id) },
    })

    // Store Mollie payment ID
    await updateDiyRentalPayment(rental.id, {
      mollie_payment_id: payment.id,
    })

    return NextResponse.json({ checkoutUrl: payment.getCheckoutUrl() }, { status: 201 })
  } catch (err) {
    console.error('POST /api/diy-rentals error:', err)
    const msg = err instanceof Error ? err.message : 'Onbekende fout'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
