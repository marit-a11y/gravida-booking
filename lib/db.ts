import { sql } from '@vercel/postgres'

// ─── Types ───────────────────────────────────────────────────────────────────

export interface Availability {
  id: number
  date: string
  region: string
  slots: string[]
  max_per_slot: number
  notes: string | null
  is_active: boolean
  group_id: string | null
  is_closed: boolean
  created_at: string
}

export interface Booking {
  id: number
  customer_number: string
  availability_id: number
  time_slot: string
  first_name: string
  last_name: string
  email: string
  phone: string
  address: string
  city: string
  zip_code: string
  pregnancy_weeks: number | null
  notes: string | null
  status: string
  created_at: string
  // joined fields
  date?: string
  region?: string
}

export interface CreateAvailabilityInput {
  date: string
  region: string
  slots: string[]
  max_per_slot: number
  notes?: string
  group_id?: string | null
  is_closed?: boolean
}

export interface CreateBookingInput {
  availability_id: number
  time_slot: string
  first_name: string
  last_name: string
  email: string
  phone: string
  address: string
  city: string
  zip_code: string
  pregnancy_weeks?: number
  notes?: string
}

// ─── Availability ─────────────────────────────────────────────────────────────

export async function getAvailability(date?: string): Promise<Availability[]> {
  if (date) {
    const result = await sql<Availability>`
      SELECT id, date::text, region, slots, max_per_slot, notes, is_active, group_id::text, is_closed, created_at::text
      FROM availability
      WHERE date = ${date}::date AND is_active = true
      ORDER BY date ASC
    `
    return result.rows
  }
  const result = await sql<Availability>`
    SELECT id, date::text, region, slots, max_per_slot, notes, is_active, group_id::text, is_closed, created_at::text
    FROM availability
    WHERE is_active = true AND date >= CURRENT_DATE
    ORDER BY date ASC
  `
  return result.rows
}

export async function getAllAvailability(): Promise<Availability[]> {
  const result = await sql<Availability>`
    SELECT id, date::text, region, slots, max_per_slot, notes, is_active, group_id::text, is_closed, created_at::text
    FROM availability
    ORDER BY date DESC
  `
  return result.rows
}

export async function getAvailabilityById(id: number): Promise<Availability | null> {
  const result = await sql<Availability>`
    SELECT id, date::text, region, slots, max_per_slot, notes, is_active, group_id::text, is_closed, created_at::text
    FROM availability
    WHERE id = ${id}
  `
  return result.rows[0] ?? null
}

export async function createAvailability(input: CreateAvailabilityInput): Promise<Availability> {
  const result = await sql<Availability>`
    INSERT INTO availability (date, region, slots, max_per_slot, notes)
    VALUES (
      ${input.date}::date,
      ${input.region},
      ${JSON.stringify(input.slots)}::jsonb,
      ${input.max_per_slot},
      ${input.notes ?? null}
    )
    RETURNING id, date::text, region, slots, max_per_slot, notes, is_active, group_id::text, is_closed, created_at::text
  `
  return result.rows[0]
}

export async function updateAvailability(
  id: number,
  input: Partial<CreateAvailabilityInput> & { is_active?: boolean; is_closed?: boolean }
): Promise<Availability | null> {
  const existing = await getAvailabilityById(id)
  if (!existing) return null

  const date       = input.date       ?? existing.date
  const region     = input.region     ?? existing.region
  const slots      = input.slots      ?? existing.slots
  const max_per_slot = input.max_per_slot ?? existing.max_per_slot
  const notes      = input.notes !== undefined      ? input.notes      : existing.notes
  const is_active  = input.is_active  !== undefined ? input.is_active  : existing.is_active
  const is_closed  = input.is_closed  !== undefined ? input.is_closed  : existing.is_closed

  const result = await sql<Availability>`
    UPDATE availability
    SET
      date = ${date}::date,
      region = ${region},
      slots = ${JSON.stringify(slots)}::jsonb,
      max_per_slot = ${max_per_slot},
      notes = ${notes},
      is_active = ${is_active},
      is_closed = ${is_closed}
    WHERE id = ${id}
    RETURNING id, date::text, region, slots, max_per_slot, notes, is_active, group_id::text, is_closed, created_at::text
  `
  return result.rows[0] ?? null
}

// ─── Group helpers ────────────────────────────────────────────────────────────

/** Close all entries in a group except the one that was just booked. */
export async function closeSiblingsByGroupId(groupId: string, exceptId: number): Promise<number> {
  const result = await sql`
    UPDATE availability
    SET is_closed = true
    WHERE group_id = ${groupId}
      AND id != ${exceptId}
      AND is_closed = false
  `
  return result.rowCount ?? 0
}

/** Get all availability IDs that share a group_id. */
export async function getGroupMemberIds(groupId: string): Promise<number[]> {
  const result = await sql<{ id: number }>`
    SELECT id FROM availability WHERE group_id = ${groupId}
  `
  return result.rows.map(r => r.id)
}

/** Assign a group_id to all given IDs. */
export async function setGroupForIds(ids: number[], groupId: string): Promise<void> {
  for (const id of ids) {
    await sql`UPDATE availability SET group_id = ${groupId} WHERE id = ${id}`
  }
}

/** Clear group_id from all given IDs. */
export async function clearGroupForIds(ids: number[]): Promise<void> {
  for (const id of ids) {
    await sql`UPDATE availability SET group_id = NULL WHERE id = ${id}`
  }
}

export async function deleteAvailability(id: number): Promise<boolean> {
  const result = await sql`
    DELETE FROM availability WHERE id = ${id}
  `
  return (result.rowCount ?? 0) > 0
}

// ─── Bookings ─────────────────────────────────────────────────────────────────

export async function getBookings(filters?: {
  date?: string
  region?: string
  status?: string
}): Promise<Booking[]> {
  // Build dynamic query via template — safest approach with @vercel/postgres
  // is to handle each filter combination explicitly.
  const date = filters?.date ?? null
  const region = filters?.region ?? null
  const status = filters?.status ?? null

  if (date && region && status) {
    const result = await sql<Booking>`
      SELECT b.id, b.customer_number, b.availability_id, b.time_slot,
             b.first_name, b.last_name, b.email, b.phone, b.address,
             b.city, b.zip_code, b.pregnancy_weeks, b.notes, b.status,
             b.created_at::text, COALESCE(b.date, a.date)::text as date, COALESCE(b.region, a.region) as region
      FROM bookings b
      LEFT JOIN availability a ON b.availability_id = a.id
      WHERE COALESCE(b.date, a.date) = ${date}::date AND COALESCE(b.region, a.region) ILIKE ${'%' + region + '%'} AND b.status = ${status}
      ORDER BY b.created_at DESC
    `
    return result.rows
  }
  if (date && region) {
    const result = await sql<Booking>`
      SELECT b.id, b.customer_number, b.availability_id, b.time_slot,
             b.first_name, b.last_name, b.email, b.phone, b.address,
             b.city, b.zip_code, b.pregnancy_weeks, b.notes, b.status,
             b.created_at::text, COALESCE(b.date, a.date)::text as date, COALESCE(b.region, a.region) as region
      FROM bookings b
      LEFT JOIN availability a ON b.availability_id = a.id
      WHERE COALESCE(b.date, a.date) = ${date}::date AND COALESCE(b.region, a.region) ILIKE ${'%' + region + '%'}
      ORDER BY b.created_at DESC
    `
    return result.rows
  }
  if (date && status) {
    const result = await sql<Booking>`
      SELECT b.id, b.customer_number, b.availability_id, b.time_slot,
             b.first_name, b.last_name, b.email, b.phone, b.address,
             b.city, b.zip_code, b.pregnancy_weeks, b.notes, b.status,
             b.created_at::text, COALESCE(b.date, a.date)::text as date, COALESCE(b.region, a.region) as region
      FROM bookings b
      LEFT JOIN availability a ON b.availability_id = a.id
      WHERE COALESCE(b.date, a.date) = ${date}::date AND b.status = ${status}
      ORDER BY b.created_at DESC
    `
    return result.rows
  }
  if (region && status) {
    const result = await sql<Booking>`
      SELECT b.id, b.customer_number, b.availability_id, b.time_slot,
             b.first_name, b.last_name, b.email, b.phone, b.address,
             b.city, b.zip_code, b.pregnancy_weeks, b.notes, b.status,
             b.created_at::text, COALESCE(b.date, a.date)::text as date, COALESCE(b.region, a.region) as region
      FROM bookings b
      LEFT JOIN availability a ON b.availability_id = a.id
      WHERE COALESCE(b.region, a.region) ILIKE ${'%' + region + '%'} AND b.status = ${status}
      ORDER BY b.created_at DESC
    `
    return result.rows
  }
  if (date) {
    const result = await sql<Booking>`
      SELECT b.id, b.customer_number, b.availability_id, b.time_slot,
             b.first_name, b.last_name, b.email, b.phone, b.address,
             b.city, b.zip_code, b.pregnancy_weeks, b.notes, b.status,
             b.created_at::text, COALESCE(b.date, a.date)::text as date, COALESCE(b.region, a.region) as region
      FROM bookings b
      LEFT JOIN availability a ON b.availability_id = a.id
      WHERE COALESCE(b.date, a.date) = ${date}::date
      Order BY b.created_at DESC
    `
    return result.rows
  }
  if (region) {
    const result = await sql<Booking>`
      SELECT b.id, b.customer_number, b.availability_id, b.time_slot,
             b.first_name, b.last_name, b.email, b.phone, b.address,
             b.city, b.zip_code, b.pregnancy_weeks, b.notes, b.status,
             b.created_at::text, COALESCE(b.date, a.date)::text as date, COALESCE(b.region, a.region) as region
      FROM bookings b
      LEFT JOIN availability a ON b.availability_id = a.id
      WHERE COALESCE(b.region, a.region) ILIKE ${'%' + region + '%'}
      ORDER BY b.created_at DESC
    `
    return result.rows
  }
  if (status) {
    const result = await sql<Booking>`
      SELECT b.id, b.customer_number, b.availability_id, b.time_slot,
             b.first_name, b.last_name, b.email, b.phone, b.address,
             b.city, b.zip_code, b.pregnancy_weeks, b.notes, b.status,
             b.created_at::text, COALESCE(b.date, a.date)::text as date, COALESCE(b.region, a.region) as region
      FROM bookings b
      LEFT JOIN availability a ON b.availability_id = a.id
      WHERE b.status = ${status}
      ORDER BY b.created_at DESC
    `
    return result.rows
  }
  // No filters
  const result = await sql<Booking>`
    SELECT b.id, b.customer_number, b.availability_id, b.time_slot,
           b.first_name, b.last_name, b.email, b.phone, b.address,
           b.city, b.zip_code, b.pregnancy_weeks, b.notes, b.status,
           b.created_at::text, COALESCE(b.date, a.date)::text as date, COALESCE(b.region, a.region) as region
    FROM bookings b
    LEFT JOIN availability a ON b.availability_id = a.id
    ORDER BY b.created_at DESC
  `
  return result.rows
}

export async function getBookingById(id: number): Promise<Booking | null> {
  const result = await sql<Booking>`
    SELECT b.id, b.customer_number, b.availability_id, b.time_slot,
           b.first_name, b.last_name, b.email, b.phone, b.address,
           b.city, b.zip_code, b.pregnancy_weeks, b.notes, b.status,
           b.created_at::text, COALESCE(b.date, a.date)::text as date, COALESCE(b.region, a.region) as region
    FROM bookings b
    LEFT JOIN availability a ON b.availability_id = a.id
    WHERE b.id = ${id}
  `
  return result.rows[0] ?? null
}

export async function getNextCustomerNumber(): Promise<string> {
  const result = await sql<{ last_number: number }>`
    UPDATE customer_counter
    SET last_number = last_number + 1
    WHERE id = 1
    RETURNING last_number
  `
  const num = result.rows[0].last_number
  if (num > 9999) {
    throw new Error('Klantnummer limiet bereikt (9999)')
  }
  return String(num).padStart(4, '0')
}

export async function createBooking(input: CreateBookingInput): Promise<Booking> {
  const customerNumber = await getNextCustomerNumber()

  // Resolve date and region from availability so booking survives availability deletion
  const avail = await getAvailabilityById(input.availability_id)
  const date = avail?.date ?? null
  const region = avail?.region ?? null

  const result = await sql<Booking>`
    INSERT INTO bookings (
      customer_number, availability_id, time_slot,
      first_name, last_name, email, phone,
      address, city, zip_code, pregnancy_weeks, notes,
      date, region
    ) VALUES (
      ${customerNumber},
      ${input.availability_id},
      ${input.time_slot},
      ${input.first_name},
      ${input.last_name},
      ${input.email},
      ${input.phone},
      ${input.address},
      ${input.city},
      ${input.zip_code},
      ${input.pregnancy_weeks ?? null},
      ${input.notes ?? null},
      ${date}::date,
      ${region}
    )
    RETURNING id, customer_number, availability_id, time_slot,
              first_name, last_name, email, phone, address,
              city, zip_code, pregnancy_weeks, notes, status, created_at::text,
              date::text, region
  `
  return result.rows[0]
}

export async function updateBookingStatus(id: number, status: string): Promise<Booking | null> {
  const result = await sql<Booking>`
    UPDATE bookings SET status = ${status} WHERE id = ${id}
    RETURNING id, customer_number, availability_id, time_slot,
              first_name, last_name, email, phone, address,
              city, zip_code, pregnancy_weeks, notes, status, created_at::text
  `
  return result.rows[0] ?? null
}

export async function getBookingCountForSlot(
  availability_id: number,
  time_slot: string
): Promise<number> {
  const result = await sql<{ count: string }>`
    SELECT COUNT(*) as count
    FROM bookings
    WHERE availability_id = ${availability_id}
      AND time_slot = ${time_slot}
      AND status != 'geannuleerd'
  `
  return parseInt(result.rows[0].count, 10)
}

// ─── Stats ────────────────────────────────────────────────────────────────────

export async function getStats() {
  const [totalResult, weekResult, todayResult] = await Promise.all([
    sql<{ count: string }>`SELECT COUNT(*) as count FROM bookings WHERE status != 'geannuleerd'`,
    sql<{ count: string }>`
      SELECT COUNT(*) as count FROM bookings b
      LEFT JOIN availability a ON b.availability_id = a.id
      WHERE COALESCE(b.date, a.date) >= DATE_TRUNC('week', CURRENT_DATE)
        AND COALESCE(b.date, a.date) < DATE_TRUNC('week', CURRENT_DATE) + INTERVAL '7 days'
        AND b.status != 'geannuleerd'
    `,
    sql<{ count: string }>`
      SELECT COUNT(*) as count FROM bookings b
      LEFT JOIN availability a ON b.availability_id = a.id
      WHERE COALESCE(b.date, a.date) = CURRENT_DATE AND b.status != 'geannuleerd'
    `,
  ])

  return {
    total: parseInt(totalResult.rows[0].count, 10),
    thisWeek: parseInt(weekResult.rows[0].count, 10),
    today: parseInt(todayResult.rows[0].count, 10),
  }
}
