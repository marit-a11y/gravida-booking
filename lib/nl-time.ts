/**
 * Tijdzone-helpers die ALTIJD Europe/Amsterdam (NL) gebruiken,
 * ongeacht waar de browser-gebruiker zich bevindt.
 *
 * Gebruik dit overal waar tijden voor klanten/team worden getoond
 * of opgeslagen, zodat een post die op 20:00 staat ook echt om 20:00
 * NL tijd verschijnt — niet 22:00 als iemand in Tokio inlogt.
 */

const TZ = 'Europe/Amsterdam'

function pad(n: number) { return String(n).padStart(2, '0') }

/** Ontleed een ISO/Date naar NL-componenten via Intl. */
function nlParts(input: string | Date) {
  const d = typeof input === 'string' ? new Date(input) : input
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false,
  }).formatToParts(d)
  const o: Record<string, string> = {}
  for (const p of parts) o[p.type] = p.value
  return {
    year: parseInt(o.year, 10),
    month: parseInt(o.month, 10),
    day: parseInt(o.day, 10),
    hour: parseInt(o.hour === '24' ? '0' : o.hour, 10),
    minute: parseInt(o.minute, 10),
    second: parseInt(o.second, 10),
  }
}

/** "YYYY-MM-DDTHH:MM" in NL → ISO UTC string voor opslag in DB. */
export function nlLocalToIso(localStr: string): string {
  if (!localStr) return ''
  const [datePart, timePart] = localStr.split('T')
  const [Y, M, D] = datePart.split('-').map(Number)
  const [h, m] = (timePart ?? '00:00').split(':').map(Number)

  // Begin met de waarde alsof het UTC is.
  const guess = new Date(Date.UTC(Y, M - 1, D, h, m, 0))
  // Wat is dit moment in NL?
  const nl = nlParts(guess)
  // Verschil in minuten tussen wat NL liet zien en wat we wilden.
  const wantedMinutes = h * 60 + m
  const actualMinutes = nl.hour * 60 + nl.minute
  // Als de datum verschilt (rond middernacht) compenseren we dat ook.
  const dayDiff = (Date.UTC(nl.year, nl.month - 1, nl.day) - Date.UTC(Y, M - 1, D)) / 86400000
  const totalDiffMin = (dayDiff * 24 * 60) + (actualMinutes - wantedMinutes)
  return new Date(guess.getTime() - totalDiffMin * 60000).toISOString()
}

/** ISO/Date → "YYYY-MM-DDTHH:MM" in NL (voor <input type="datetime-local">). */
export function isoToNlLocal(input: string | Date): string {
  const p = nlParts(input)
  return `${p.year}-${pad(p.month)}-${pad(p.day)}T${pad(p.hour)}:${pad(p.minute)}`
}

/** ISO/Date → uur en minuut in NL. */
export function getNlHourMinute(input: string | Date): { hour: number; minute: number } {
  const p = nlParts(input)
  return { hour: p.hour, minute: p.minute }
}

/** ISO/Date → "HH:MM" in NL. */
export function formatNlTime(input: string | Date): string {
  const { hour, minute } = getNlHourMinute(input)
  return `${pad(hour)}:${pad(minute)}`
}

/** ISO/Date → "YYYY-MM-DD" key in NL (voor groeperen op datum). */
export function getNlDateKey(input: string | Date): string {
  const p = nlParts(input)
  return `${p.year}-${pad(p.month)}-${pad(p.day)}`
}

/** ISO/Date → Date-object met daar/maand/jaar in NL (uur 00:00). */
export function getNlDate(input: string | Date): Date {
  const p = nlParts(input)
  return new Date(p.year, p.month - 1, p.day)
}

/** Vergelijk twee ISO datums in NL en check of zelfde dag. */
export function isSameNlDay(a: string | Date, b: string | Date): boolean {
  return getNlDateKey(a) === getNlDateKey(b)
}
