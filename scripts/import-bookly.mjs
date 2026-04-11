/**
 * Import Bookly future appointments into the gravida-booking Neon database.
 * Run with: node scripts/import-bookly.mjs
 *
 * - Creates availability entries for each unique date+time+region
 * - Creates booking entries linked to those availability entries
 * - Updates customer_counter to start numbering ABOVE existing Bookly customers (3163)
 */

import { neon } from '@neondatabase/serverless'

// ─── Neon connection ─────────────────────────────────────────────────────────
const POSTGRES_URL = 'postgresql://neondb_owner:npg_SNo0Y4ltfJiE@ep-delicate-violet-ambgdk5s-pooler.c-5.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require'
const sql = neon(POSTGRES_URL)

// ─── Service → Region mapping ─────────────────────────────────────────────────
const SERVICE_REGION = {
  '7':  'Showroom bezoek Haarlem',
  '29': 'Noord-Holland & Flevoland',
  '30': 'Zuid-Holland',
  '31': 'Utrecht & Gelderland & Overijssel',
  '32': 'Noord-Brabant',
  '33': 'Limburg',
  '34': 'Groningen, Friesland en Drenthe',
}

// ─── Bookly future appointments (from inspection on 2026-04-10) ──────────────
const APPOINTMENTS = [
  { bookly_id: 5241, service_id: '7',  start_date: '2026-04-10 09:30:00', first_name: 'Manuela',    last_name: 'Ruigrok',         email: 'mmbijwaard@gmail.com',              phone: '+31651987206', street: 'Bekslaan',              street_number: '28',  postcode: '2114ca',  city: 'Vogelenzang',      notes: 'Ik wil graag een zwangerschapsbeeldje laten maken :)' },
  { bookly_id: 5204, service_id: '7',  start_date: '2026-04-10 10:30:00', first_name: 'Timmy',      last_name: 'Beelen',           email: 'Timmy-b@hotmail.com',               phone: '+31653393688', street: 'Kopacker',              street_number: '16',  postcode: '6581 JW', city: 'Malden',           notes: '2e zwangerschap. 1e al bij jullie een beeld laten maken.' },
  { bookly_id: 5223, service_id: '7',  start_date: '2026-04-10 14:30:00', first_name: 'Michelle',   last_name: 'Spaan',            email: 'michellespaan1990@hotmail.com',     phone: '+31623870331', street: 'Rosa Spierstraat',      street_number: '147', postcode: '2135TS',  city: 'Hoofddorp',        notes: '' },
  { bookly_id: 5245, service_id: '30', start_date: '2026-04-14 10:00:00', first_name: 'Charlotte',  last_name: 'de Graaf',         email: 'charlottedegraaf1@gmail.com',       phone: '+31653808800', street: 'Pulpehoeve',            street_number: '2',   postcode: '2742 PM', city: 'Waddinxveen',      notes: 'Naam van zus en telnr van partner van zwangere. Dit betreft een verrassing voor haar.' },
  { bookly_id: 5253, service_id: '7',  start_date: '2026-04-14 12:30:00', first_name: 'Enny',       last_name: 'Breure',           email: 'enny_breure@hotmail.com',           phone: '+31612235833', street: 'Terrasweg',             street_number: '46',  postcode: '2071 BD', city: 'Santpoort-Noord',  notes: '' },
  { bookly_id: 5247, service_id: '30', start_date: '2026-04-16 10:00:00', first_name: 'Emma',       last_name: 'Alkemade',         email: 'emma.alkemade@gmail.com',           phone: '+31643928026', street: 'Spijkenisserstraat',    street_number: '5',   postcode: '3114 BW', city: 'Schiedam',         notes: '' },
  { bookly_id: 5187, service_id: '7',  start_date: '2026-04-17 09:30:00', first_name: 'Svetlana',   last_name: 'Helleward',        email: 'svetlanahelleward@hotmail.com',     phone: '+31614758822', street: 'Kruitopslag',           street_number: '12',  postcode: '1398 HW', city: 'Muiden',           notes: 'Ik ben al in 2024 bij jullie geweest ;)' },
  { bookly_id: 5073, service_id: '7',  start_date: '2026-04-17 11:00:00', first_name: 'Melanie',    last_name: 'van Grunsven',     email: 'melanievangrunsven@live.nl',        phone: '+31622928074', street: 'Weidekruidlaan',        street_number: '39',  postcode: '5232 KB', city: 'Den Bosch',        notes: 'Wil graag hetzelfde materiaal als vorige beeldjes. Brengt beeldjes mee naar afspraak.' },
  { bookly_id: 5230, service_id: '7',  start_date: '2026-04-17 12:30:00', first_name: 'Charlotte',  last_name: 'Oldenburg',        email: 'Charlotteoldenburg5@gmail.com',     phone: '+31633753537', street: 'Florrie Rodrigostraat', street_number: '28',  postcode: '1326SH',  city: 'Almere',           notes: '' },
  { bookly_id: 5234, service_id: '7',  start_date: '2026-05-08 10:30:00', first_name: 'Marion',     last_name: 'Rook',             email: 'marionrook93@gmail.com',            phone: '+31647618728', street: 'Rivierforel',           street_number: '31',  postcode: '2318MG',  city: 'Leiden',           notes: '' },
  { bookly_id: 5222, service_id: '7',  start_date: '2026-05-08 12:30:00', first_name: 'Sam',        last_name: 'Houtstra',         email: 'Samzantman@hotmail.com',            phone: '+0634155773',  street: 'Westerdam',             street_number: '25',  postcode: '8891GL',  city: 'Midsland',         notes: '' },
  { bookly_id: 5235, service_id: '7',  start_date: '2026-05-12 09:30:00', first_name: 'Sophie',     last_name: 'Duijkers',         email: 'Sophieduijkers@gmail.com',          phone: '+31618631489', street: 'Essenlaan',             street_number: '72',  postcode: '1161EH',  city: 'Zwanenburg',       notes: '' },
  { bookly_id: 5233, service_id: '7',  start_date: '2026-05-12 12:30:00', first_name: 'Kelley',     last_name: 'Neef',             email: 'Kelleyneef@hotmail.com',            phone: '+31613929660', street: 'Beneden tiendweg',      street_number: '6',   postcode: '2959ba',  city: 'Streefkerk',       notes: '' },
  { bookly_id: 5177, service_id: '7',  start_date: '2026-05-26 10:30:00', first_name: 'Chloë',      last_name: 'Leenart',          email: 'cb-leenart@hotmail.com',            phone: '+31628153851', street: 'Elzenhorst',            street_number: '97',  postcode: '2742cp',  city: 'Waddinxveen',      notes: '' },
  { bookly_id: 5243, service_id: '7',  start_date: '2026-05-29 10:30:00', first_name: 'Daphne',     last_name: 'Laboyrie',         email: 'Daphne.m.laboyrie@gmail.com',       phone: '+31611466852', street: 'Leuvenstraat',          street_number: '13',  postcode: '2313XW',  city: 'Leiden',           notes: '' },
  { bookly_id: 5229, service_id: '7',  start_date: '2026-05-29 12:30:00', first_name: 'Selena',     last_name: 'Basseluer',        email: 'Selenabasseluer@hotmail.com',       phone: '+31640196813', street: 'Wipmolen',              street_number: '2',   postcode: '3642AC',  city: 'Mijdrecht',        notes: '' },
  { bookly_id: 5231, service_id: '7',  start_date: '2026-05-30 10:30:00', first_name: 'Esther',     last_name: 'van der Kuij',     email: 'esthervdkuij@hotmai.com',           phone: '+31612265836', street: 'Jan de rijkelaan',      street_number: '37',  postcode: '3417 aw', city: 'Montfoort',        notes: '' },
  { bookly_id: 5250, service_id: '7',  start_date: '2026-05-30 13:30:00', first_name: 'Jolanda',    last_name: 'Sukel',            email: 'Jd.sukel@hotmail.com',              phone: '+31629033413', street: 'Chris soumokilstraat',  street_number: '6',   postcode: '2033 cm', city: 'Haarlem',          notes: '' },
  { bookly_id: 5185, service_id: '7',  start_date: '2026-06-05 09:30:00', first_name: 'Daniëlle',   last_name: 'Lebbe-Zoomer',     email: 'danielle.zoomer@outlook.com',       phone: '+0617933099',  street: 'Heemskerkerweg',        street_number: '174', postcode: '1945 TJ', city: 'Beverwijk',        notes: '' },
  { bookly_id: 5227, service_id: '7',  start_date: '2026-06-19 13:30:00', first_name: 'Michaela',   last_name: 'Spevacek',         email: 'spemiki@gmail.com',                 phone: '+31655544228', street: 'Weide',                 street_number: '18',  postcode: '3121XW',  city: 'Schiedam',         notes: 'Wil graag een scan doen en misschien later gaan bestellen.' },
  { bookly_id: 5237, service_id: '7',  start_date: '2026-06-27 11:30:00', first_name: 'Saskia',     last_name: 'Vieveen',          email: 'svieveen@hotmail.com',              phone: '+31637336398', street: 'Dodaarsoever',          street_number: '34',  postcode: '2492 TA', city: "'s-Gravenhage",    notes: 'Komt samen met vriend en dochter van 2 jaar.' },
  { bookly_id: 5251, service_id: '7',  start_date: '2026-08-22 11:30:00', first_name: 'Florine',    last_name: 'Kremer-Sukel',     email: 'florinekremer@hotmail.com',         phone: '+31620150174', street: 'De werven',             street_number: '55',  postcode: '1398 CD', city: 'Muiden',           notes: '' },
]

// ─── Helpers ─────────────────────────────────────────────────────────────────
function parseDateTime(dt) {
  // "2026-04-10 09:30:00" → { date: "2026-04-10", time: "09:30" }
  const [datePart, timePart] = dt.split(' ')
  const time = timePart.substring(0, 5) // "09:30"
  return { date: datePart, time }
}

function formatAddress(apt) {
  return `${apt.street.trim()} ${apt.street_number.trim()}`.trim()
}

// ─── Main import ─────────────────────────────────────────────────────────────
async function main() {
  console.log('=== Gravida Bookly Import ===\n')

  // Step 1: Bump customer_counter so new customers start ABOVE existing 3163 Bookly customers
  const counterRow = await sql`SELECT last_number FROM customer_counter WHERE id = 1`
  const currentCounter = counterRow[0].last_number
  console.log(`Current customer counter: ${currentCounter}`)
  if (currentCounter < 3163) {
    await sql`UPDATE customer_counter SET last_number = 3163 WHERE id = 1`
    console.log('→ Customer counter updated to 3163 (new customers start from #3164)\n')
  } else {
    console.log(`→ Counter already at ${currentCounter}, no update needed\n`)
  }

  let availCreated = 0
  let availReused = 0
  let bookingsCreated = 0
  let errors = 0

  // Cache: date+time+region → availability_id
  const availCache = new Map()

  for (const apt of APPOINTMENTS) {
    const { date, time } = parseDateTime(apt.start_date)
    const region = SERVICE_REGION[apt.service_id] ?? 'Showroom bezoek Haarlem'
    const address = formatAddress(apt)
    const cacheKey = `${date}|${time}|${region}`

    try {
      // ── Find or create availability entry ──────────────────────────────────
      let availId = availCache.get(cacheKey)

      if (!availId) {
        // Check if availability already exists
        const existing = await sql`
          SELECT id FROM availability
          WHERE date = ${date}::date
            AND region = ${region}
            AND slots @> ${JSON.stringify([time])}::jsonb
        `
        if (existing.length > 0) {
          availId = existing[0].id
          availReused++
          console.log(`  [reuse] availability #${availId} for ${date} ${time} (${region})`)
        } else {
          // Create new availability entry with just this one slot
          const created = await sql`
            INSERT INTO availability (date, region, slots, max_per_slot, notes)
            VALUES (
              ${date}::date,
              ${region},
              ${JSON.stringify([time])}::jsonb,
              1,
              'Geïmporteerd uit Bookly'
            )
            RETURNING id
          `
          availId = created[0].id
          availCreated++
          console.log(`  [+avail] #${availId} — ${date} ${time} — ${region}`)
        }
        availCache.set(cacheKey, availId)
      }

      // ── Create booking ─────────────────────────────────────────────────────
      // Get next customer number
      const counterUpdate = await sql`
        UPDATE customer_counter SET last_number = last_number + 1 WHERE id = 1 RETURNING last_number
      `
      const customerNumber = String(counterUpdate[0].last_number).padStart(4, '0')

      // Check if booking already exists (idempotency: same email + date)
      const existingBooking = await sql`
        SELECT id FROM bookings
        WHERE email = ${apt.email.trim().toLowerCase()}
          AND availability_id = ${availId}
          AND time_slot = ${time}
      `
      if (existingBooking.length > 0) {
        console.log(`  [skip] booking for ${apt.first_name} ${apt.last_name} — already exists`)
        // Undo the counter increment
        await sql`UPDATE customer_counter SET last_number = last_number - 1 WHERE id = 1`
        continue
      }

      const notesText = [apt.notes].filter(Boolean).join(' | ').trim() || null
      const zipClean = apt.postcode.trim().toUpperCase().replace(/\s+/g, ' ')

      await sql`
        INSERT INTO bookings (
          customer_number, availability_id, time_slot,
          first_name, last_name, email, phone,
          address, city, zip_code, pregnancy_weeks, notes, status
        ) VALUES (
          ${customerNumber},
          ${availId},
          ${time},
          ${apt.first_name.trim()},
          ${apt.last_name.trim()},
          ${apt.email.trim().toLowerCase()},
          ${apt.phone.trim()},
          ${address},
          ${apt.city.trim()},
          ${zipClean},
          ${null},
          ${notesText},
          'bevestigd'
        )
      `
      bookingsCreated++
      console.log(`  [+booking] #${customerNumber} — ${apt.first_name} ${apt.last_name} — ${date} ${time}`)

    } catch (err) {
      errors++
      console.error(`  [ERROR] bookly_id=${apt.bookly_id}: ${err.message}`)
    }
  }

  console.log('\n=== Resultaat ===')
  console.log(`Availability aangemaakt:  ${availCreated}`)
  console.log(`Availability hergebruikt: ${availReused}`)
  console.log(`Boekingen aangemaakt:     ${bookingsCreated}`)
  if (errors > 0) console.log(`Fouten:                   ${errors}`)
  console.log('\nKlaar!')
}

main().catch(err => {
  console.error('Import mislukt:', err)
  process.exit(1)
})
