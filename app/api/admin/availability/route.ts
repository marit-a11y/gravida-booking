import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@vercel/postgres'
import { createAvailability, setGroupForIds, getGroupMemberIds } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const result = await sql`
      SELECT
        a.id,
        a.date::text,
        a.region,
        a.slots,
        a.max_per_slot,
        a.notes,
        a.is_active,
        a.group_id::text,
        a.is_closed,
        a.created_at::text,
        COALESCE(
          jsonb_agg(b.time_slot ORDER BY b.time_slot) FILTER (WHERE b.time_slot IS NOT NULL AND b.status != 'geannuleerd'),
          '[]'::jsonb
        ) AS booked_slots
      FROM availability a
      LEFT JOIN bookings b ON b.availability_id = a.id AND b.status != 'geannuleerd'
      GROUP BY a.id
      ORDER BY a.date ASC, a.id ASC
    `
    return NextResponse.json({ availability: result.rows })
  } catch (err) {
    console.error('GET /api/admin/availability error:', err)
    return NextResponse.json({ error: 'Kan beschikbaarheid niet laden' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { date, region, slots, max_per_slot, notes } = body

    if (!date || !region || !slots || !Array.isArray(slots) || slots.length === 0) {
      return NextResponse.json(
        { error: 'Datum, regio en tijdslots zijn verplicht' },
        { status: 400 }
      )
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json({ error: 'Ongeldig datumformaat (gebruik YYYY-MM-DD)' }, { status: 400 })
    }

    const availability = await createAvailability({
      date,
      region: region.trim(),
      slots,
      max_per_slot: max_per_slot ?? 2,
      notes: notes?.trim() || undefined,
    })

    // Auto-link: if another entry for the same region already exists on this date,
    // put them all in the same group automatically
    const siblings = await sql<{ id: number; group_id: string | null }>`
      SELECT id, group_id::text FROM availability
      WHERE date = ${date}::date AND region = ${region.trim()} AND id != ${availability.id} AND is_active = true
    `
    if (siblings.rows.length > 0) {
      // Use existing group if one of the siblings already has one, otherwise create new
      const existingGroupId = siblings.rows.find(r => r.group_id)?.group_id ?? null
      const groupId = existingGroupId ?? crypto.randomUUID()
      if (!existingGroupId) {
        // New group — collect all existing member IDs from each sibling's group
        const allIds = new Set<number>([availability.id])
        for (const sib of siblings.rows) {
          allIds.add(sib.id)
          if (sib.group_id) {
            const members = await getGroupMemberIds(sib.group_id)
            members.forEach(id => allIds.add(id))
          }
        }
        await setGroupForIds(Array.from(allIds), groupId)
      } else {
        // Add new entry to existing group
        await setGroupForIds([availability.id], groupId)
      }
    }

    return NextResponse.json({ availability }, { status: 201 })
  } catch (err) {
    console.error('POST /api/admin/availability error:', err)
    return NextResponse.json({ error: 'Aanmaken mislukt' }, { status: 500 })
  }
}
