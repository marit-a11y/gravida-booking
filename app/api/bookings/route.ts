import { NextRequest, NextResponse } from 'next/server'
import { createBooking, getAvailabilityById, getBookingCountForSlot } from '@/lib/db'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    const {
      availability_id,
      time_slot,
      first_name,
      last_name,
      email,
      phone,
      address,
      city,
      zip_code,
      pregnancy_weeks,
      notes,
    } = body

    // Validate required fields
    if (!availability_id || !time_slot || !first_name || !last_name || !email || !phone || !address || !city || !zip_code) {
      return NextResponse.json(
        { error: 'Verplichte velden ontbreken' },
        { status: 400 }
      )
    }

    // Validate email
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: 'Ongeldig e-mailadres' }, { status: 400 })
    }

    // Check availability still exists and is active
    const availability = await getAvailabilityById(availability_id)
    if (!availability || !availability.is_active) {
      return NextResponse.json(
        { error: 'Deze beschikbaarheid bestaat niet meer. Kies een andere datum.' },
        { status: 400 }
      )
    }

    // Check the requested slot is in the availability
    if (!availability.slots.includes(time_slot)) {
      return NextResponse.json(
        { error: 'Dit tijdslot is niet beschikbaar.' },
        { status: 400 }
      )
    }

    // Check slot capacity
    const currentCount = await getBookingCountForSlot(availability_id, time_slot)
    if (currentCount >= availability.max_per_slot) {
      return NextResponse.json(
        { error: 'Dit tijdslot is helaas al vol. Kies een ander tijdslot.' },
        { status: 409 }
      )
    }

    // Create booking
    const booking = await createBooking({
      availability_id,
      time_slot,
      first_name: first_name.trim(),
      last_name: last_name.trim(),
      email: email.trim().toLowerCase(),
      phone: phone.trim(),
      address: address.trim(),
      city: city.trim(),
      zip_code: zip_code.trim(),
      pregnancy_weeks: pregnancy_weeks ? parseInt(pregnancy_weeks) : undefined,
      notes: notes?.trim() || undefined,
    })

    return NextResponse.json(booking, { status: 201 })
  } catch (err) {
    console.error('POST /api/bookings error:', err)
    const msg = err instanceof Error ? err.message : 'Onbekende fout'
    if (msg.includes('klantnummer')) {
      return NextResponse.json({ error: msg }, { status: 500 })
    }
    return NextResponse.json({ error: 'Boeking aanmaken mislukt. Probeer het opnieuw.' }, { status: 500 })
  }
}
