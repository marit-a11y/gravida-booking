import { NextRequest, NextResponse } from 'next/server'
import { getAvailableDiyWeeks, createDiyRental } from '@/lib/db'
import { sendDiyRentalEmails } from '@/lib/email'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const weeks = await getAvailableDiyWeeks()
    return NextResponse.json({ weeks })
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

    await sendDiyRentalEmails({
      first_name: rental.first_name,
      last_name: rental.last_name,
      email: rental.email,
      phone: rental.phone,
      address: rental.address,
      city: rental.city,
      zip_code: rental.zip_code,
      rental_week: rental.rental_week,
    }).catch(err => console.error('sendDiyRentalEmails error:', err))

    return NextResponse.json(rental, { status: 201 })
  } catch (err) {
    console.error('POST /api/diy-rentals error:', err)
    const msg = err instanceof Error ? err.message : 'Onbekende fout'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
