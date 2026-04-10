/**
 * Generate time slots between startTime and endTime with given duration (minutes).
 * e.g. generateSlots("09:00", "17:00", 45) => ["09:00","09:45","10:30",...]
 */
export function generateTimeSlots(
  startTime: string,
  endTime: string,
  durationMinutes: number
): string[] {
  const slots: string[] = []

  const [startH, startM] = startTime.split(':').map(Number)
  const [endH, endM] = endTime.split(':').map(Number)

  let currentMinutes = startH * 60 + startM
  const endMinutes = endH * 60 + endM

  while (currentMinutes < endMinutes) {
    const h = Math.floor(currentMinutes / 60)
    const m = currentMinutes % 60
    slots.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`)
    currentMinutes += durationMinutes
  }

  return slots
}

/**
 * Format a date string (YYYY-MM-DD) to Dutch locale.
 */
export function formatDutchDate(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00')
  return date.toLocaleDateString('nl-NL', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

/**
 * Format a date string (YYYY-MM-DD) to short Dutch locale.
 */
export function formatDutchDateShort(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00')
  return date.toLocaleDateString('nl-NL', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
}

/**
 * Get YYYY-MM-DD from a Date object in local time.
 */
export function toLocalDateString(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/**
 * Get an array of dates (YYYY-MM-DD strings) for a given month.
 */
export function getDaysInMonth(year: number, month: number): string[] {
  const days: string[] = []
  const date = new Date(year, month, 1)
  while (date.getMonth() === month) {
    days.push(toLocalDateString(date))
    date.setDate(date.getDate() + 1)
  }
  return days
}

/**
 * Get the first day of week (0=Mon) for a given month.
 */
export function getFirstDayOfWeek(year: number, month: number): number {
  const date = new Date(year, month, 1)
  // Convert Sunday=0 to Monday=0
  return (date.getDay() + 6) % 7
}

/**
 * Convert bookings array to CSV string.
 */
export function bookingsToCsv(bookings: Record<string, unknown>[]): string {
  if (bookings.length === 0) return ''
  const headers = [
    'Klantnummer',
    'Voornaam',
    'Achternaam',
    'Email',
    'Telefoon',
    'Datum',
    'Tijdslot',
    'Regio',
    'Adres',
    'Postcode',
    'Woonplaats',
    'Weken zwanger',
    'Opmerkingen',
    'Status',
    'Aangemaakt op',
  ]
  const rows = bookings.map((b) => [
    b.customer_number,
    b.first_name,
    b.last_name,
    b.email,
    b.phone,
    b.date,
    b.time_slot,
    b.region,
    b.address,
    b.zip_code,
    b.city,
    b.pregnancy_weeks ?? '',
    b.notes ?? '',
    b.status,
    b.created_at,
  ])
  const escape = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`
  return [headers.map(escape).join(','), ...rows.map((r) => r.map(escape).join(','))].join('\n')
}
