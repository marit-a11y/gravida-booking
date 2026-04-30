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
  internal_notes: string | null
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
             b.city, b.zip_code, b.pregnancy_weeks, b.notes, b.internal_notes, b.status,
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
             b.city, b.zip_code, b.pregnancy_weeks, b.notes, b.internal_notes, b.status,
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
             b.city, b.zip_code, b.pregnancy_weeks, b.notes, b.internal_notes, b.status,
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
             b.city, b.zip_code, b.pregnancy_weeks, b.notes, b.internal_notes, b.status,
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
             b.city, b.zip_code, b.pregnancy_weeks, b.notes, b.internal_notes, b.status,
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
             b.city, b.zip_code, b.pregnancy_weeks, b.notes, b.internal_notes, b.status,
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
             b.city, b.zip_code, b.pregnancy_weeks, b.notes, b.internal_notes, b.status,
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
           b.city, b.zip_code, b.pregnancy_weeks, b.notes, b.internal_notes, b.status,
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
           b.city, b.zip_code, b.pregnancy_weeks, b.notes, b.internal_notes, b.status,
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
              city, zip_code, pregnancy_weeks, notes, internal_notes, status, created_at::text,
              date::text, region
  `
  return result.rows[0]
}

export async function updateBookingStatus(id: number, status: string): Promise<Booking | null> {
  const result = await sql<Booking>`
    UPDATE bookings SET status = ${status} WHERE id = ${id}
    RETURNING id, customer_number, availability_id, time_slot,
              first_name, last_name, email, phone, address,
              city, zip_code, pregnancy_weeks, notes, internal_notes, status, created_at::text
  `
  return result.rows[0] ?? null
}

export interface UpdateBookingInput {
  availability_id?: number
  time_slot?: string
  first_name?: string
  last_name?: string
  email?: string
  phone?: string
  address?: string
  city?: string
  zip_code?: string
  pregnancy_weeks?: number | null
  notes?: string | null
  internal_notes?: string | null
  status?: string
  date?: string
  region?: string
}

export async function updateBooking(id: number, input: UpdateBookingInput): Promise<Booking | null> {
  const existing = await getBookingById(id)
  if (!existing) return null

  // If availability_id changes, sync date/region from that availability
  let date: string | null = input.date ?? existing.date ?? null
  let region: string | null = input.region ?? existing.region ?? null
  if (input.availability_id && input.availability_id !== existing.availability_id) {
    const avail = await getAvailabilityById(input.availability_id)
    if (avail) {
      date = avail.date
      region = avail.region
    }
  }

  // Pre-resolve values to simplify SQL and avoid subtle binding issues
  const availabilityId  = input.availability_id  ?? existing.availability_id
  const timeSlot        = input.time_slot        ?? existing.time_slot
  const firstName       = input.first_name       ?? existing.first_name
  const lastName        = input.last_name        ?? existing.last_name
  const email           = input.email            ?? existing.email
  const phone           = input.phone            ?? existing.phone
  const address         = input.address          ?? existing.address
  const city            = input.city             ?? existing.city
  const zipCode         = input.zip_code         ?? existing.zip_code
  const pregnancyWeeks  = input.pregnancy_weeks  !== undefined ? input.pregnancy_weeks : existing.pregnancy_weeks
  const notes           = input.notes            !== undefined ? input.notes           : existing.notes
  const internalNotes   = input.internal_notes   !== undefined ? input.internal_notes  : existing.internal_notes
  const status          = input.status           ?? existing.status

  const result = await sql<Booking>`
    UPDATE bookings
    SET availability_id = ${availabilityId},
        time_slot       = ${timeSlot},
        first_name      = ${firstName},
        last_name       = ${lastName},
        email           = ${email},
        phone           = ${phone},
        address         = ${address},
        city            = ${city},
        zip_code        = ${zipCode},
        pregnancy_weeks = ${pregnancyWeeks},
        notes           = ${notes},
        internal_notes  = ${internalNotes},
        status          = ${status},
        date            = ${date}::date,
        region          = ${region}
    WHERE id = ${id}
    RETURNING id, customer_number, availability_id, time_slot,
              first_name, last_name, email, phone, address,
              city, zip_code, pregnancy_weeks, notes, internal_notes, status, created_at::text
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

// ─── Auto-generate standard availability ─────────────────────────────────────

const BOOKABLE_REGIONS = [
  'Noord-Holland & Flevoland',
  'Utrecht & Gelderland & Overijssel',
  'Zuid-Holland',
  'Noord-Brabant',
  'Limburg',
  'Groningen, Friesland en Drenthe',
]

// Dutch-week day keys used in staff.working_hours JSONB
const DAY_KEYS = ['ma', 'di', 'wo', 'do', 'vr', 'za', 'zo']

// Match the frontend slot-spacing rule: only applies to studio regions there,
// but all bookable (aan-huis) regions use 90 min (60 min scan + 30 min travel).
const BOOKABLE_SLOT_SPACING_MIN = 90

// Travel buffer (minutes) before the first slot and after the last slot,
// reserving time to drive from Haarlem (home base) to/from the region.
const TRAVEL_BUFFER_MIN: Record<string, number> = {
  'Noord-Holland & Flevoland':       30,
  'Zuid-Holland':                    60,
  'Utrecht & Gelderland & Overijssel': 90,
  'Noord-Brabant':                   90,
  'Limburg':                         90,
  'Groningen, Friesland en Drenthe': 90,
}

interface StaffRow {
  id: number
  regions: string[]
  working_hours: Record<string, { active: boolean; start: string; end: string }>
}

interface AbsenceRow {
  staff_id: number
  date_from: string
  date_to: string
}

/** Generate time slots between start and end using spacing in minutes. */
function buildSlots(start: string, end: string, spacingMin: number): string[] {
  const [sh, sm] = start.split(':').map(Number)
  const [eh, em] = end.split(':').map(Number)
  const startMin = sh * 60 + sm
  const endMin = eh * 60 + em
  const slots: string[] = []
  for (let m = startMin; m + spacingMin <= endMin; m += spacingMin) {
    const h = Math.floor(m / 60)
    const min = m % 60
    slots.push(`${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`)
  }
  return slots
}

/** Apply travel buffer: shift start forward and end backward by the region's buffer. */
function buildSlotsForRegion(start: string, end: string, region: string, spacingMin: number): string[] {
  const buffer = TRAVEL_BUFFER_MIN[region] ?? 0
  const [sh, sm] = start.split(':').map(Number)
  const [eh, em] = end.split(':').map(Number)
  const startMin = sh * 60 + sm + buffer
  const endMin = eh * 60 + em - buffer
  if (endMin <= startMin) return []
  const toHhmm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
  return buildSlots(toHhmm(startMin), toHhmm(endMin), spacingMin)
}

/**
 * Generate "standard" availability entries for the 6 bookable NL regions for
 * the next N weeks, based on staff working hours. Skips dates where an entry
 * already exists (any region/date combo) and where all staff covering that
 * region are absent.
 *
 * Returns the number of new availability rows inserted.
 */
export async function generateStandardAvailability(weeksAhead = 12): Promise<number> {
  // Load active staff + absences
  const staffResult = await sql<StaffRow>`
    SELECT id, regions, working_hours FROM staff WHERE is_active = true
  `
  const staff = staffResult.rows.filter(s => s.working_hours && typeof s.working_hours === 'object')

  const absenceResult = await sql<AbsenceRow>`
    SELECT staff_id, date_from::text, date_to::text FROM absence
  `
  const absences = absenceResult.rows

  // Date range: today + weeksAhead * 7 days
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const end = new Date(today)
  end.setDate(end.getDate() + weeksAhead * 7)

  // Pre-fetch existing availability for the period so we don't double-insert
  const existingResult = await sql<{ date: string; region: string }>`
    SELECT date::text, region FROM availability
    WHERE date >= ${today.toISOString().split('T')[0]}::date
      AND date <= ${end.toISOString().split('T')[0]}::date
  `
  const existingKeys = new Set(existingResult.rows.map(r => `${r.date}|${r.region}`))

  // Pre-fetch dates that already have an active booking — staff is busy that day
  // (matches the existing closeSiblingsByGroupId behavior: 1 booking per staff per day)
  const busyDatesResult = await sql<{ date: string }>`
    SELECT DISTINCT COALESCE(b.date, a.date)::text as date
    FROM bookings b
    LEFT JOIN availability a ON b.availability_id = a.id
    WHERE b.status != 'geannuleerd'
      AND COALESCE(b.date, a.date) >= ${today.toISOString().split('T')[0]}::date
      AND COALESCE(b.date, a.date) <= ${end.toISOString().split('T')[0]}::date
  `
  const busyDates = new Set(busyDatesResult.rows.map(r => r.date))

  let inserted = 0

  for (let d = new Date(today); d <= end; d.setDate(d.getDate() + 1)) {
    const dateStr = d.toISOString().split('T')[0]
    const dow = (d.getDay() + 6) % 7 // 0=Mon … 6=Sun
    const dayKey = DAY_KEYS[dow]

    // Skip date entirely if there's already an active booking elsewhere
    // (e.g. a studio scan booking blocks the day for aan-huis bookings too)
    if (busyDates.has(dateStr)) continue

    for (const region of BOOKABLE_REGIONS) {
      const key = `${dateStr}|${region}`
      if (existingKeys.has(key)) continue

      // Find a staff member covering this region, active on this weekday,
      // and NOT absent on this date.
      const available = staff.find(s => {
        if (!s.regions?.includes(region)) return false
        const wh = s.working_hours?.[dayKey]
        if (!wh?.active) return false
        const isAbsent = absences.some(ab =>
          ab.staff_id === s.id &&
          ab.date_from <= dateStr &&
          ab.date_to >= dateStr
        )
        return !isAbsent
      })

      if (!available) continue

      const wh = available.working_hours[dayKey]
      const slots = buildSlotsForRegion(wh.start, wh.end, region, BOOKABLE_SLOT_SPACING_MIN)
      if (slots.length === 0) continue

      await sql`
        INSERT INTO availability (date, region, slots, max_per_slot)
        VALUES (${dateStr}::date, ${region}, ${JSON.stringify(slots)}::jsonb, 1)
      `
      existingKeys.add(key)
      inserted++
    }
  }

  return inserted
}

// ─── DIY Scanners ────────────────────────────────────────────────────────────

export interface DiyScanner {
  id: number
  name: string
  is_available: boolean
  notes: string | null
  created_at: string
}

export interface DiyRental {
  id: number
  scanner_id: number
  scanner_name?: string
  rental_week: string
  first_name: string
  last_name: string
  email: string
  phone: string
  address: string
  city: string
  zip_code: string
  status: string
  deposit_amount: number
  deposit_status: string
  mollie_payment_id: string | null
  payment_status: string
  customer_number: string | null
  notes: string | null
  internal_notes: string | null
  created_at: string
}

export interface CreateDiyRentalInput {
  rental_week: string
  first_name: string
  last_name: string
  email: string
  phone: string
  address: string
  city: string
  zip_code: string
  notes?: string
}

export async function getDiyScanners(): Promise<DiyScanner[]> {
  const result = await sql<DiyScanner>`
    SELECT id, name, is_available, notes, created_at::text FROM diy_scanners ORDER BY id ASC
  `
  return result.rows
}

export async function updateDiyScanner(
  id: number,
  input: { is_available?: boolean; notes?: string | null; name?: string }
): Promise<DiyScanner | null> {
  const existing = await sql<DiyScanner>`SELECT * FROM diy_scanners WHERE id = ${id}`
  if (!existing.rows[0]) return null
  const s = existing.rows[0]
  const result = await sql<DiyScanner>`
    UPDATE diy_scanners
    SET is_available = ${input.is_available ?? s.is_available},
        notes = ${input.notes !== undefined ? input.notes : s.notes},
        name = ${input.name ?? s.name}
    WHERE id = ${id}
    RETURNING id, name, is_available, notes, created_at::text
  `
  return result.rows[0] ?? null
}

export async function getDiyRentals(filters?: { status?: string }): Promise<DiyRental[]> {
  const status = filters?.status ?? null
  if (status) {
    const result = await sql<DiyRental>`
      SELECT r.id, r.scanner_id, s.name as scanner_name, r.rental_week::text,
             r.first_name, r.last_name, r.email, r.phone, r.address, r.city, r.zip_code,
             r.status, r.deposit_amount, r.deposit_status, r.mollie_payment_id, r.payment_status, r.customer_number, r.notes, r.internal_notes, r.created_at::text
      FROM diy_rentals r
      LEFT JOIN diy_scanners s ON r.scanner_id = s.id
      WHERE r.status = ${status}
      ORDER BY r.rental_week DESC, r.created_at DESC
    `
    return result.rows
  }
  const result = await sql<DiyRental>`
    SELECT r.id, r.scanner_id, s.name as scanner_name, r.rental_week::text,
           r.first_name, r.last_name, r.email, r.phone, r.address, r.city, r.zip_code,
           r.status, r.deposit_amount, r.deposit_status, r.mollie_payment_id, r.payment_status, r.customer_number, r.notes, r.internal_notes, r.created_at::text
    FROM diy_rentals r
    LEFT JOIN diy_scanners s ON r.scanner_id = s.id
    ORDER BY r.rental_week DESC, r.created_at DESC
  `
  return result.rows
}

export async function getDiyRentalById(id: number): Promise<DiyRental | null> {
  const result = await sql<DiyRental>`
    SELECT r.id, r.scanner_id, s.name as scanner_name, r.rental_week::text,
           r.first_name, r.last_name, r.email, r.phone, r.address, r.city, r.zip_code,
           r.status, r.deposit_amount, r.deposit_status, r.mollie_payment_id, r.payment_status, r.customer_number, r.notes, r.internal_notes, r.created_at::text
    FROM diy_rentals r
    LEFT JOIN diy_scanners s ON r.scanner_id = s.id
    WHERE r.id = ${id}
  `
  return result.rows[0] ?? null
}

/** Find a free scanner for a given week. Returns scanner id or null. */
export async function findFreeScannerForWeek(rentalWeek: string): Promise<number | null> {
  const result = await sql<{ id: number }>`
    SELECT s.id FROM diy_scanners s
    WHERE s.is_available = true
      AND NOT EXISTS (
        SELECT 1 FROM diy_rentals r
        WHERE r.scanner_id = s.id
          AND r.rental_week = ${rentalWeek}::date
          AND r.status IN ('wacht_op_betaling', 'gereserveerd', 'verzonden')
      )
    ORDER BY s.id ASC
    LIMIT 1
  `
  return result.rows[0]?.id ?? null
}

export async function createDiyRental(input: CreateDiyRentalInput): Promise<DiyRental> {
  const scannerId = await findFreeScannerForWeek(input.rental_week)
  if (!scannerId) {
    throw new Error('Geen scanner beschikbaar voor deze week')
  }

  // Shared counter with bookings so the numbering is globally unique
  const customerNumber = await getNextCustomerNumber()

  const result = await sql<DiyRental>`
    INSERT INTO diy_rentals (
      scanner_id, rental_week, first_name, last_name, email, phone,
      address, city, zip_code, notes, status, customer_number
    ) VALUES (
      ${scannerId}, ${input.rental_week}::date,
      ${input.first_name}, ${input.last_name}, ${input.email}, ${input.phone},
      ${input.address}, ${input.city}, ${input.zip_code}, ${input.notes ?? null},
      'wacht_op_betaling', ${customerNumber}
    )
    RETURNING id, scanner_id, rental_week::text, first_name, last_name, email, phone,
              address, city, zip_code, status, deposit_amount, deposit_status,
              mollie_payment_id, payment_status, customer_number, notes, internal_notes, created_at::text
  `
  return result.rows[0]
}

export async function updateDiyRental(
  id: number,
  input: {
    status?: string
    deposit_status?: string
    payment_status?: string
    notes?: string | null
    internal_notes?: string | null
    rental_week?: string
    first_name?: string
    last_name?: string
    email?: string
    phone?: string
    address?: string
    city?: string
    zip_code?: string
  }
): Promise<DiyRental | null> {
  const existing = await getDiyRentalById(id)
  if (!existing) return null
  const result = await sql<DiyRental>`
    UPDATE diy_rentals
    SET status         = ${input.status ?? existing.status},
        deposit_status = ${input.deposit_status ?? existing.deposit_status},
        payment_status = ${input.payment_status ?? existing.payment_status},
        notes          = ${input.notes          !== undefined ? input.notes          : existing.notes},
        internal_notes = ${input.internal_notes !== undefined ? input.internal_notes : existing.internal_notes},
        rental_week    = ${input.rental_week ?? existing.rental_week}::date,
        first_name     = ${input.first_name ?? existing.first_name},
        last_name      = ${input.last_name ?? existing.last_name},
        email          = ${input.email ?? existing.email},
        phone          = ${input.phone ?? existing.phone},
        address        = ${input.address ?? existing.address},
        city           = ${input.city ?? existing.city},
        zip_code       = ${input.zip_code ?? existing.zip_code}
    WHERE id = ${id}
    RETURNING id, scanner_id, rental_week::text, first_name, last_name, email, phone,
              address, city, zip_code, status, deposit_amount, deposit_status,
              mollie_payment_id, payment_status, customer_number, notes, internal_notes, created_at::text
  `
  return result.rows[0] ?? null
}

export async function updateDiyRentalPayment(
  id: number,
  input: { mollie_payment_id?: string; payment_status?: string; status?: string }
): Promise<DiyRental | null> {
  const existing = await getDiyRentalById(id)
  if (!existing) return null
  const result = await sql<DiyRental>`
    UPDATE diy_rentals
    SET mollie_payment_id = ${input.mollie_payment_id ?? existing.mollie_payment_id},
        payment_status = ${input.payment_status ?? existing.payment_status},
        status = ${input.status ?? existing.status}
    WHERE id = ${id}
    RETURNING id, scanner_id, rental_week::text, first_name, last_name, email, phone,
              address, city, zip_code, status, deposit_amount, deposit_status,
              mollie_payment_id, payment_status, customer_number, notes, internal_notes, created_at::text
  `
  return result.rows[0] ?? null
}

/** Get weeks (as Monday dates) in the next 12 weeks that have at least 1 free scanner. */
export async function getAvailableDiyWeeks(): Promise<string[]> {
  // Generate next 12 Mondays
  const weeks: string[] = []
  const now = new Date()
  // Find next Monday
  const d = new Date(now)
  d.setDate(d.getDate() + ((8 - d.getDay()) % 7 || 7))
  for (let i = 0; i < 12; i++) {
    weeks.push(d.toISOString().split('T')[0])
    d.setDate(d.getDate() + 7)
  }

  const available: string[] = []
  for (const week of weeks) {
    const free = await findFreeScannerForWeek(week)
    if (free) available.push(week)
  }
  return available
}

export interface DiyWeekStatus {
  monday: string
  status: 'available' | 'last_one' | 'sold_out'
}

/**
 * Richer weekly availability: real booking counts + artificial scarcity overlay.
 * Returns all 12 upcoming Mondays with a display status.
 *
 * Real logic:
 * - count ACTIVE bookings (wacht_op_betaling, gereserveerd, verzonden) per week
 * - total_scanners = count of diy_scanners with is_available = true
 * - status = sold_out if bookings >= total, last_one if bookings == total-1, else available
 *
 * Artificial overlay:
 * - For weeks with real status 'available', add scarcity based on a deterministic
 *   hash of the Monday date. This creates mild urgency but stays consistent per
 *   visitor session. Real bookings take precedence.
 */
export async function getDiyWeekStatuses(weeksAhead = 52): Promise<DiyWeekStatus[]> {
  // Count active scanners
  const scannerResult = await sql<{ count: string }>`
    SELECT COUNT(*) as count FROM diy_scanners WHERE is_available = true
  `
  const totalScanners = parseInt(scannerResult.rows[0]?.count ?? '0', 10)

  // Generate Mondays for the next `weeksAhead` weeks (default: a full year)
  const weeks: string[] = []
  const now = new Date()
  const d = new Date(now)
  d.setDate(d.getDate() + ((8 - d.getDay()) % 7 || 7))
  for (let i = 0; i < weeksAhead; i++) {
    weeks.push(d.toISOString().split('T')[0])
    d.setDate(d.getDate() + 7)
  }

  // Fetch active bookings per week (single query)
  const bookingsResult = await sql<{ rental_week: string; n: string }>`
    SELECT rental_week::text AS rental_week, COUNT(*) AS n
    FROM diy_rentals
    WHERE status IN ('wacht_op_betaling', 'gereserveerd', 'verzonden')
      AND rental_week >= ${weeks[0]}::date
      AND rental_week <= ${weeks[weeks.length - 1]}::date
    GROUP BY rental_week
  `
  const bookedByWeek = new Map<string, number>()
  for (const row of bookingsResult.rows) {
    bookedByWeek.set(row.rental_week, parseInt(row.n, 10))
  }

  // Determine real status per week
  // Note: `last_one` only makes sense with 2+ scanners. If there's only 1
  // scanner in the inventory, 0 bookings still means 'available' for the
  // customer — not "last one" — otherwise every week would look urgent.
  const realStatuses: DiyWeekStatus[] = weeks.map(monday => {
    const booked = bookedByWeek.get(monday) ?? 0
    let status: DiyWeekStatus['status'] = 'available'
    if (totalScanners === 0 || booked >= totalScanners) status = 'sold_out'
    else if (totalScanners >= 2 && booked === totalScanners - 1) status = 'last_one'
    return { monday, status }
  })

  // Apply mild artificial scarcity for weeks that are really 'available'.
  // Most weeks stay green — we only mark a few to create subtle urgency:
  // ~8% sold_out, ~17% last_one, ~75% available.
  const hash = (s: string) => {
    let h = 0
    for (const ch of s) h = ((h * 31) + ch.charCodeAt(0)) >>> 0
    return h
  }
  return realStatuses.map(w => {
    if (w.status !== 'available') return w
    const h = hash(w.monday) % 12
    if (h === 0) return { ...w, status: 'sold_out' }
    if (h === 1 || h === 2) return { ...w, status: 'last_one' }
    return w
  })
}

// ─── Gift Cards ───────────────────────────────────────────────────────────────

export interface GiftCard {
  id: number
  code: string
  type: string
  value_euros: number
  status: string
  purchaser_name: string
  purchaser_email: string
  recipient_name: string
  recipient_email: string
  personal_message: string | null
  mollie_payment_id: string | null
  redeemed_at: string | null
  redeemed_by_booking_id: number | null
  expires_at: string
  created_at: string
}

export interface CreateGiftCardInput {
  type: string
  value_euros: number
  purchaser_name: string
  purchaser_email: string
  recipient_name: string
  recipient_email: string
  personal_message?: string
  status?: string
}

const GIFT_CARD_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

function generateGiftCardCode(): string {
  const rand = (n: number) => Array.from({ length: n }, () => GIFT_CARD_CHARS[Math.floor(Math.random() * GIFT_CARD_CHARS.length)]).join('')
  return `GRAVI-${rand(4)}-${rand(4)}`
}

export async function createGiftCard(input: CreateGiftCardInput): Promise<GiftCard> {
  const code = generateGiftCardCode()
  const status = input.status ?? 'wacht_op_betaling'
  const result = await sql<GiftCard>`
    INSERT INTO gift_cards (
      code, type, value_euros, status,
      purchaser_name, purchaser_email,
      recipient_name, recipient_email,
      personal_message
    ) VALUES (
      ${code},
      ${input.type},
      ${input.value_euros},
      ${status},
      ${input.purchaser_name},
      ${input.purchaser_email},
      ${input.recipient_name},
      ${input.recipient_email},
      ${input.personal_message ?? null}
    )
    RETURNING
      id, code, type, value_euros::float as value_euros, status,
      purchaser_name, purchaser_email, recipient_name, recipient_email,
      personal_message, mollie_payment_id,
      redeemed_at::text, redeemed_by_booking_id,
      expires_at::text, created_at::text
  `
  return result.rows[0]
}

export async function getGiftCardByCode(code: string): Promise<GiftCard | null> {
  const result = await sql<GiftCard>`
    SELECT
      id, code, type, value_euros::float as value_euros, status,
      purchaser_name, purchaser_email, recipient_name, recipient_email,
      personal_message, mollie_payment_id,
      redeemed_at::text, redeemed_by_booking_id,
      expires_at::text, created_at::text
    FROM gift_cards
    WHERE code = ${code}
  `
  return result.rows[0] ?? null
}

export async function getGiftCardById(id: number): Promise<GiftCard | null> {
  const result = await sql<GiftCard>`
    SELECT
      id, code, type, value_euros::float as value_euros, status,
      purchaser_name, purchaser_email, recipient_name, recipient_email,
      personal_message, mollie_payment_id,
      redeemed_at::text, redeemed_by_booking_id,
      expires_at::text, created_at::text
    FROM gift_cards
    WHERE id = ${id}
  `
  return result.rows[0] ?? null
}

export async function getAllGiftCards(): Promise<GiftCard[]> {
  const result = await sql<GiftCard>`
    SELECT
      id, code, type, value_euros::float as value_euros, status,
      purchaser_name, purchaser_email, recipient_name, recipient_email,
      personal_message, mollie_payment_id,
      redeemed_at::text, redeemed_by_booking_id,
      expires_at::text, created_at::text
    FROM gift_cards
    ORDER BY created_at DESC
  `
  return result.rows
}

export async function updateGiftCardMollieId(id: number, molliePaymentId: string): Promise<void> {
  await sql`
    UPDATE gift_cards SET mollie_payment_id = ${molliePaymentId} WHERE id = ${id}
  `
}

export async function activateGiftCard(id: number): Promise<GiftCard | null> {
  const result = await sql<GiftCard>`
    UPDATE gift_cards SET status = 'actief' WHERE id = ${id}
    RETURNING
      id, code, type, value_euros::float as value_euros, status,
      purchaser_name, purchaser_email, recipient_name, recipient_email,
      personal_message, mollie_payment_id,
      redeemed_at::text, redeemed_by_booking_id,
      expires_at::text, created_at::text
  `
  return result.rows[0] ?? null
}

export async function cancelGiftCard(id: number): Promise<void> {
  await sql`UPDATE gift_cards SET status = 'geannuleerd' WHERE id = ${id}`
}

export async function redeemGiftCard(code: string, bookingId?: number): Promise<GiftCard | null> {
  const result = await sql<GiftCard>`
    UPDATE gift_cards
    SET status = 'ingewisseld',
        redeemed_at = NOW(),
        redeemed_by_booking_id = ${bookingId ?? null}
    WHERE code = ${code}
    RETURNING
      id, code, type, value_euros::float as value_euros, status,
      purchaser_name, purchaser_email, recipient_name, recipient_email,
      personal_message, mollie_payment_id,
      redeemed_at::text, redeemed_by_booking_id,
      expires_at::text, created_at::text
  `
  return result.rows[0] ?? null
}

export async function markExpiredGiftCards(): Promise<number> {
  const result = await sql`
    UPDATE gift_cards
    SET status = 'verlopen'
    WHERE expires_at < NOW() AND status = 'actief'
  `
  return result.rowCount ?? 0
}

// ─── Social media planner ────────────────────────────────────────────────────

export interface SocialPost {
  id: number
  scheduled_for: string
  platform: string
  post_type: string
  image_urls: string[]
  caption: string | null
  hashtags: string | null
  status: string
  canva_url: string | null
  internal_notes: string | null
  reminder_sent: boolean
  created_at: string
}

export interface CreateSocialPostInput {
  scheduled_for: string
  platform?: string
  post_type?: string
  image_urls?: string[]
  caption?: string
  hashtags?: string
  status?: string
  canva_url?: string
  internal_notes?: string
}

export async function getSocialPosts(filters?: { from?: string; to?: string }): Promise<SocialPost[]> {
  if (filters?.from && filters?.to) {
    const r = await sql<SocialPost>`
      SELECT id, scheduled_for::text, platform, post_type, image_urls, caption, hashtags,
             status, canva_url, internal_notes, reminder_sent, created_at::text
      FROM social_posts
      WHERE scheduled_for >= ${filters.from}::timestamptz
        AND scheduled_for <= ${filters.to}::timestamptz
      ORDER BY scheduled_for ASC
    `
    return r.rows
  }
  const r = await sql<SocialPost>`
    SELECT id, scheduled_for::text, platform, post_type, image_urls, caption, hashtags,
           status, canva_url, internal_notes, reminder_sent, created_at::text
    FROM social_posts
    ORDER BY scheduled_for ASC
  `
  return r.rows
}

export async function getSocialPostById(id: number): Promise<SocialPost | null> {
  const r = await sql<SocialPost>`
    SELECT id, scheduled_for::text, platform, post_type, image_urls, caption, hashtags,
           status, canva_url, internal_notes, reminder_sent, created_at::text
    FROM social_posts WHERE id = ${id}
  `
  return r.rows[0] ?? null
}

export async function createSocialPost(input: CreateSocialPostInput): Promise<SocialPost> {
  const r = await sql<SocialPost>`
    INSERT INTO social_posts (
      scheduled_for, platform, post_type, image_urls, caption, hashtags, status,
      canva_url, internal_notes
    ) VALUES (
      ${input.scheduled_for}::timestamptz,
      ${input.platform ?? 'instagram'},
      ${input.post_type ?? 'feed'},
      ${JSON.stringify(input.image_urls ?? [])}::jsonb,
      ${input.caption ?? null},
      ${input.hashtags ?? null},
      ${input.status ?? 'scheduled'},
      ${input.canva_url ?? null},
      ${input.internal_notes ?? null}
    )
    RETURNING id, scheduled_for::text, platform, post_type, image_urls, caption, hashtags,
              status, canva_url, internal_notes, reminder_sent, created_at::text
  `
  return r.rows[0]
}

export async function updateSocialPost(
  id: number,
  input: Partial<CreateSocialPostInput> & { reminder_sent?: boolean }
): Promise<SocialPost | null> {
  const existing = await getSocialPostById(id)
  if (!existing) return null
  const r = await sql<SocialPost>`
    UPDATE social_posts
    SET scheduled_for  = ${input.scheduled_for ?? existing.scheduled_for}::timestamptz,
        platform       = ${input.platform ?? existing.platform},
        post_type      = ${input.post_type ?? existing.post_type},
        image_urls     = ${JSON.stringify(input.image_urls ?? existing.image_urls)}::jsonb,
        caption        = ${input.caption !== undefined ? input.caption : existing.caption},
        hashtags       = ${input.hashtags !== undefined ? input.hashtags : existing.hashtags},
        status         = ${input.status ?? existing.status},
        canva_url      = ${input.canva_url !== undefined ? input.canva_url : existing.canva_url},
        internal_notes = ${input.internal_notes !== undefined ? input.internal_notes : existing.internal_notes},
        reminder_sent  = ${input.reminder_sent !== undefined ? input.reminder_sent : existing.reminder_sent}
    WHERE id = ${id}
    RETURNING id, scheduled_for::text, platform, post_type, image_urls, caption, hashtags,
              status, canva_url, internal_notes, reminder_sent, created_at::text
  `
  return r.rows[0] ?? null
}

export async function deleteSocialPost(id: number): Promise<boolean> {
  const r = await sql`DELETE FROM social_posts WHERE id = ${id}`
  return (r.rowCount ?? 0) > 0
}
