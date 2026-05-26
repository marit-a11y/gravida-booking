/**
 * Nederlandse nationale feestdagen.
 * Geeft per jaar een Set van YYYY-MM-DD strings terug.
 *
 * Inbegrepen:
 *  - Nieuwjaarsdag (1 jan)
 *  - Goede Vrijdag (2 dagen voor Pasen)
 *  - Eerste + Tweede Paasdag
 *  - Koningsdag (27 april, of 26 april als 27 op zondag valt)
 *  - Bevrijdingsdag (5 mei)
 *  - Hemelvaartsdag (39 dagen na Pasen)
 *  - Eerste + Tweede Pinksterdag (49 + 50 dagen na Pasen)
 *  - Eerste + Tweede Kerstdag (25, 26 december)
 */

function pad(n: number) { return String(n).padStart(2, '0') }
function fmt(d: Date) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` }
function addDays(d: Date, n: number) { const r = new Date(d); r.setDate(r.getDate() + n); return r }

// Computus (anonymous Gregorian) voor Pasen-zondag
function easterSunday(year: number): Date {
  const a = year % 19
  const b = Math.floor(year / 100)
  const c = year % 100
  const d = Math.floor(b / 4)
  const e = b % 4
  const f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4)
  const k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const month = Math.floor((h + l - 7 * m + 114) / 31)
  const day = ((h + l - 7 * m + 114) % 31) + 1
  return new Date(year, month - 1, day)
}

const holidayCache = new Map<number, Set<string>>()

export function getDutchHolidays(year: number): Set<string> {
  const cached = holidayCache.get(year)
  if (cached) return cached

  const dates = new Set<string>()
  // Vaste data
  dates.add(`${year}-01-01`)                  // Nieuwjaarsdag

  // Koningsdag: 27 april, of 26 april als 27 op zondag valt
  const koningsdag = new Date(year, 3, 27)
  if (koningsdag.getDay() === 0) {
    dates.add(`${year}-04-26`)
  } else {
    dates.add(`${year}-04-27`)
  }

  dates.add(`${year}-05-05`)                  // Bevrijdingsdag
  dates.add(`${year}-12-25`)                  // Eerste Kerstdag
  dates.add(`${year}-12-26`)                  // Tweede Kerstdag

  // Pasen-gebaseerd
  const easter = easterSunday(year)
  dates.add(fmt(addDays(easter, -2)))         // Goede Vrijdag
  dates.add(fmt(easter))                      // Eerste Paasdag
  dates.add(fmt(addDays(easter, 1)))          // Tweede Paasdag
  dates.add(fmt(addDays(easter, 39)))         // Hemelvaartsdag
  dates.add(fmt(addDays(easter, 49)))         // Eerste Pinksterdag
  dates.add(fmt(addDays(easter, 50)))         // Tweede Pinksterdag

  holidayCache.set(year, dates)
  return dates
}

/** Check of een YYYY-MM-DD datum een Nederlandse nationale feestdag is. */
export function isDutchHoliday(dateStr: string): boolean {
  const year = parseInt(dateStr.slice(0, 4), 10)
  return getDutchHolidays(year).has(dateStr)
}
