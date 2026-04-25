import { Resend } from 'resend'
import { generateGiftCardPdf } from './gift-card-pdf'

// Lazily initialized so the module can be imported at build time without an API key
function getResend() { return new Resend(process.env.RESEND_API_KEY) }

const FROM = (process.env.EMAIL_FROM ?? 'Gravida <boekingen@gravida.nl>').trim()
const BRAND_GREEN = '#3d5c41'
const BRAND_LIGHT = '#f5f4f0'

// ─── Dutch date formatter ────────────────────────────────────────────────────

const DUTCH_DAYS   = ['zondag','maandag','dinsdag','woensdag','donderdag','vrijdag','zaterdag']
const DUTCH_MONTHS = ['januari','februari','maart','april','mei','juni','juli','augustus','september','oktober','november','december']

function formatDutchDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  return `${DUTCH_DAYS[dt.getDay()]} ${d} ${DUTCH_MONTHS[m - 1]} ${y}`
}

// ─── Shared layout wrapper ────────────────────────────────────────────────────

function layout(content: string): string {
  return `<!DOCTYPE html>
<html lang="nl">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
</head>
<body style="margin:0;padding:0;background:#f0eeea;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0eeea;padding:40px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:16px;overflow:hidden;">

        <!-- Header -->
        <tr>
          <td style="background:${BRAND_GREEN};padding:28px 40px;">
            <span style="color:#ffffff;font-size:22px;font-weight:600;letter-spacing:-0.5px;">Gravida</span>
            <span style="color:rgba(255,255,255,0.55);font-size:13px;margin-left:10px;">Zwangerschapsscans aan huis</span>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:36px 40px 32px;">
            ${content}
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:${BRAND_LIGHT};padding:20px 40px;border-top:1px solid #e8e6e0;">
            <p style="margin:0;font-size:12px;color:#8a9e8c;line-height:1.6;">
              Gravida · <a href="https://www.gravida.nl" style="color:#8a9e8c;">www.gravida.nl</a>
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`
}

// ─── Customer confirmation email ─────────────────────────────────────────────

function customerEmailHtml(params: {
  first_name: string
  customer_number: string
  date: string
  time_slot: string
  region: string
  address: string
  city: string
  zip_code: string
  pregnancy_weeks: number | null
  notes: string | null
}): string {
  const dateFormatted = formatDutchDate(params.date)

  const p = (text: string) =>
    `<p style="margin:0 0 18px;font-size:15px;color:#3d4d3e;line-height:1.75;">${text}</p>`

  return layout(`
    ${p(`Hi ${params.first_name},`)}
    ${p('Wat leuk dat je een scan aan huis hebt geboekt. Ik kijk ernaar uit om bij je langs te komen.')}
    ${p(`Hierbij bevestig ik je afspraak op <strong>${dateFormatted}</strong> om <strong>${params.time_slot}</strong>.`)}
    ${p('Omdat ik bij jou thuis scan, is het fijn als je alvast een plekje in huis uitkiest waar we rustig kunnen werken. Ik moet tijdens het scannen goed om je heen kunnen lopen, dus een beetje ruimte is belangrijk. Qua licht werkt een plek met gelijkmatig daglicht het mooist. Liefst niet recht voor een raam, omdat dat vaak te veel tegenlicht geeft.')}
    ${p('Mocht het voor de planning in de regio handiger zijn om iets met de tijd te schuiven, dan neem ik vooraf nog even contact met je op. Uiteraard altijd in overleg.')}
    ${p('Twijfel je nog over kleding of heb je ergens vragen over, stuur me gerust even een berichtje. Ik denk graag met je mee.')}
    <p style="margin:24px 0 0;font-size:15px;color:#3d4d3e;line-height:1.75;">
      Tot snel bij jou thuis,<br/>
      <strong style="color:#1e2d1f;">Laila</strong>
    </p>
  `)
}

// ─── Staff notification email ─────────────────────────────────────────────────

function staffEmailHtml(params: {
  customer_number: string
  first_name: string
  last_name: string
  email: string
  phone: string
  address: string
  zip_code: string
  city: string
  date: string
  time_slot: string
  region: string
  pregnancy_weeks: number | null
  notes: string | null
}): string {
  const dateFormatted = formatDutchDate(params.date)

  const row = (label: string, value: string) => value ? `
    <tr>
      <td style="padding:5px 0;font-size:13px;color:#8a9e8c;width:140px;vertical-align:top;">${label}</td>
      <td style="padding:5px 0;font-size:14px;color:#1e2d1f;">${value}</td>
    </tr>` : ''

  return layout(`
    <h1 style="margin:0 0 6px;font-size:22px;font-weight:600;color:#1e2d1f;letter-spacing:-0.5px;">
      Nieuwe boeking ontvangen
    </h1>
    <p style="margin:0 0 28px;font-size:15px;color:#5a6e5c;">
      Er is een nieuwe 3D scan geboekt via de website.
    </p>

    <!-- Appointment details -->
    <table width="100%" cellpadding="0" cellspacing="0" style="background:${BRAND_LIGHT};border-radius:12px;margin-bottom:20px;">
      <tr><td style="padding:22px 28px;">
        <p style="margin:0 0 14px;font-size:11px;font-weight:600;color:#8a9e8c;text-transform:uppercase;letter-spacing:1px;">Afspraakdetails</p>
        <table width="100%" cellpadding="0" cellspacing="0">
          ${row('📅 Datum', dateFormatted)}
          ${row('⏰ Tijdslot', params.time_slot)}
          ${row('📍 Regio', params.region)}
          ${row('🔑 Klantnr.', params.customer_number)}
        </table>
      </td></tr>
    </table>

    <!-- Customer details -->
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#fff;border:1px solid #e8e6e0;border-radius:12px;margin-bottom:20px;">
      <tr><td style="padding:22px 28px;">
        <p style="margin:0 0 14px;font-size:11px;font-weight:600;color:#8a9e8c;text-transform:uppercase;letter-spacing:1px;">Klantgegevens</p>
        <table width="100%" cellpadding="0" cellspacing="0">
          ${row('👤 Naam', `${params.first_name} ${params.last_name}`)}
          ${row('📧 E-mail', `<a href="mailto:${params.email}" style="color:${BRAND_GREEN};">${params.email}</a>`)}
          ${row('📞 Telefoon', `<a href="tel:${params.phone}" style="color:${BRAND_GREEN};">${params.phone}</a>`)}
          ${row('🏠 Adres', `${params.address}, ${params.zip_code} ${params.city}`)}
          ${params.pregnancy_weeks ? row('🤱 Weken zwanger', String(params.pregnancy_weeks)) : ''}
          ${params.notes ? row('💬 Opmerking', params.notes) : ''}
        </table>
      </td></tr>
    </table>

    <a href="https://gravida-booking.vercel.app/admin/boekingen"
       style="display:inline-block;background:${BRAND_GREEN};color:#fff;text-decoration:none;padding:13px 28px;border-radius:10px;font-size:14px;font-weight:500;">
      Bekijk in het beheerpaneel →
    </a>
  `)
}

// ─── Reminder email ───────────────────────────────────────────────────────────

function reminderEmailHtml(params: {
  first_name: string
  date: string
  time_slot: string
}): string {
  const dateFormatted = formatDutchDate(params.date)

  const p = (text: string) =>
    `<p style="margin:0 0 18px;font-size:15px;color:#3d4d3e;line-height:1.75;">${text}</p>`

  return layout(`
    ${p(`Hi ${params.first_name},`)}
    ${p(`Fijn dat je volgende week een scan aan huis hebt geboekt! Ik wil je er graag alvast aan herinneren dat onze afspraak is op <strong>${dateFormatted}</strong> om <strong>${params.time_slot}</strong>.`)}
    ${p('Heb je in de tussentijd iets veranderd of wil je de afspraak annuleren? Stuur me dan even een berichtje, dan zoeken we samen naar een oplossing.')}
    ${p('Tot volgende week!')}
    <p style="margin:24px 0 0;font-size:15px;color:#3d4d3e;line-height:1.75;">
      Tot snel bij jou thuis,<br/>
      <strong style="color:#1e2d1f;">Laila</strong>
    </p>
  `)
}

export async function sendReminderEmail(params: {
  first_name: string
  email: string
  date: string
  time_slot: string
}): Promise<void> {
  if (!process.env.RESEND_API_KEY) return
  const dateFormatted = formatDutchDate(params.date)
  await getResend().emails.send({
    from: FROM,
    to: params.email,
    subject: `Herinnering: jouw scan op ${dateFormatted} om ${params.time_slot}`,
    html: reminderEmailHtml(params),
  })
}

// ─── Main send function ───────────────────────────────────────────────────────

export interface BookingEmailParams {
  customer_number: string
  first_name: string
  last_name: string
  email: string
  phone: string
  address: string
  zip_code: string
  city: string
  date: string
  time_slot: string
  region: string
  pregnancy_weeks: number | null
  notes: string | null
  staff_emails: string[]   // email addresses of staff members covering this region
}

export async function sendBookingEmails(params: BookingEmailParams): Promise<void> {
  if (!process.env.RESEND_API_KEY) {
    console.warn('RESEND_API_KEY not set — skipping email')
    return
  }

  const dateFormatted = formatDutchDate(params.date)
  const customerSubject = `Bevestiging: jouw 3D scan op ${dateFormatted} om ${params.time_slot}`
  const staffSubject = `Nieuwe boeking: ${params.first_name} ${params.last_name} (${params.email}) · ${dateFormatted} ${params.time_slot} · ${params.region}`

  // Determine staff recipients: configured addresses + matching staff emails
  const staffRecipients = [
    ...(process.env.STAFF_EMAIL ? [process.env.STAFF_EMAIL.trim()] : []),
    ...params.staff_emails,
  ].filter((e, i, arr) => e && arr.indexOf(e) === i) // deduplicate

  const sends: Promise<unknown>[] = []

  // Customer confirmation
  sends.push(
    getResend().emails.send({
      from: FROM,
      to: params.email,
      subject: customerSubject,
      html: customerEmailHtml(params),
    }).catch(err => console.error('Customer email failed:', err))
  )

  // Staff notification (only if we have recipients)
  if (staffRecipients.length > 0) {
    sends.push(
      getResend().emails.send({
        from: FROM,
        to: staffRecipients,
        replyTo: params.email,
        subject: staffSubject,
        html: staffEmailHtml(params),
      }).catch(err => console.error('Staff email failed:', err))
    )
  } else {
    console.warn('No staff email recipients configured for region:', params.region)
  }

  await Promise.all(sends)
}

// ─── DIY Scanner Rental emails ───────────────────────────────────────────────

function formatDiyWeek(mondayStr: string): string {
  const mon = new Date(mondayStr + 'T00:00:00')
  const thu = new Date(mon); thu.setDate(mon.getDate() + 3)
  const sun = new Date(mon); sun.setDate(mon.getDate() + 6)
  return `${formatDutchDate(thu.toISOString().split('T')[0])} t/m ${formatDutchDate(sun.toISOString().split('T')[0])}`
}

function diyCustomerEmailHtml(params: {
  first_name: string
  rental_week: string
  customer_number?: string | null
}): string {
  const weekFormatted = formatDiyWeek(params.rental_week)
  const p = (text: string) =>
    `<p style="margin:0 0 18px;font-size:15px;color:#3d4d3e;line-height:1.75;">${text}</p>`

  return layout(`
    ${p(`Hi ${params.first_name},`)}
    ${p(`Leuk dat je een DIY 3D scan kit hebt gereserveerd! Hierbij bevestigen we je reservering voor <strong>${weekFormatted}</strong>.`)}
    ${params.customer_number ? p(`Je klantnummer is <strong>${params.customer_number}</strong>. Noteer dit nummer zodat je het later bij de hand hebt.`) : ''}
    ${p('De scanner wordt op <strong>woensdag</strong> naar je verstuurd, zodat je deze uiterlijk <strong>donderdag</strong> in huis hebt. Je kunt de scanner gebruiken van donderdag tot en met zondag.')}
    ${p('Stuur de scanner uiterlijk <strong>maandag</strong> retour, zodat wij deze op dinsdag kunnen verwerken.')}
    ${p('Voor de scanner geldt een borg van <strong>&euro;200</strong>. Deze wordt teruggestort zodra de scanner in goede staat retour is ontvangen.')}
    ${p('Heb je vragen over het gebruik van de scanner? Stuur ons gerust een berichtje!')}
    <p style="margin:24px 0 0;font-size:15px;color:#3d4d3e;line-height:1.75;">
      Veel plezier met scannen!<br/>
      <strong style="color:#1e2d1f;">Team Gravida</strong>
    </p>
  `)
}

function diyStaffEmailHtml(params: {
  first_name: string
  last_name: string
  email: string
  phone: string
  address: string
  city: string
  zip_code: string
  rental_week: string
  customer_number?: string | null
}): string {
  const weekFormatted = formatDiyWeek(params.rental_week)
  const row = (label: string, value: string) => value ? `
    <tr>
      <td style="padding:5px 0;font-size:13px;color:#8a9e8c;width:140px;vertical-align:top;">${label}</td>
      <td style="padding:5px 0;font-size:14px;color:#1e2d1f;">${value}</td>
    </tr>` : ''

  return layout(`
    <h1 style="margin:0 0 6px;font-size:22px;font-weight:600;color:#1e2d1f;letter-spacing:-0.5px;">
      Nieuwe DIY scan kit reservering
    </h1>
    <p style="margin:0 0 28px;font-size:15px;color:#5a6e5c;">
      Er is een DIY 3D scan kit gereserveerd via de website.
    </p>

    <table width="100%" cellpadding="0" cellspacing="0" style="background:${BRAND_LIGHT};border-radius:12px;margin-bottom:20px;">
      <tr><td style="padding:22px 28px;">
        <p style="margin:0 0 14px;font-size:11px;font-weight:600;color:#8a9e8c;text-transform:uppercase;letter-spacing:1px;">Reservering</p>
        <table width="100%" cellpadding="0" cellspacing="0">
          ${row('📅 Periode', weekFormatted)}
          ${params.customer_number ? row('🔑 Klantnr.', params.customer_number) : ''}
          ${row('📦 Verzenden op', 'Woensdag')}
          ${row('📬 Retour op', 'Maandag')}
          ${row('💰 Borg', '€200')}
        </table>
      </td></tr>
    </table>

    <table width="100%" cellpadding="0" cellspacing="0" style="background:#fff;border:1px solid #e8e6e0;border-radius:12px;margin-bottom:20px;">
      <tr><td style="padding:22px 28px;">
        <p style="margin:0 0 14px;font-size:11px;font-weight:600;color:#8a9e8c;text-transform:uppercase;letter-spacing:1px;">Klantgegevens</p>
        <table width="100%" cellpadding="0" cellspacing="0">
          ${row('👤 Naam', `${params.first_name} ${params.last_name}`)}
          ${row('📧 E-mail', `<a href="mailto:${params.email}" style="color:${BRAND_GREEN};">${params.email}</a>`)}
          ${row('📞 Telefoon', `<a href="tel:${params.phone}" style="color:${BRAND_GREEN};">${params.phone}</a>`)}
          ${row('🏠 Adres', `${params.address}, ${params.zip_code} ${params.city}`)}
        </table>
      </td></tr>
    </table>

    <a href="https://gravida-booking.vercel.app/admin/diy-scanners"
       style="display:inline-block;background:${BRAND_GREEN};color:#fff;text-decoration:none;padding:13px 28px;border-radius:10px;font-size:14px;font-weight:500;">
      Bekijk in het beheerpaneel →
    </a>
  `)
}

export interface DiyRentalEmailParams {
  customer_number?: string | null
  first_name: string
  last_name: string
  email: string
  phone: string
  address: string
  city: string
  zip_code: string
  rental_week: string
}

export async function sendDiyRentalEmails(params: DiyRentalEmailParams): Promise<void> {
  if (!process.env.RESEND_API_KEY) {
    console.warn('RESEND_API_KEY not set — skipping email')
    return
  }

  const weekFormatted = formatDiyWeek(params.rental_week)
  const staffEmail = (process.env.STAFF_EMAIL ?? '').trim()

  const sends: Promise<unknown>[] = []

  sends.push(
    getResend().emails.send({
      from: FROM,
      to: params.email,
      subject: `Bevestiging: DIY scan kit gereserveerd voor ${weekFormatted}`,
      html: diyCustomerEmailHtml(params),
    }).catch(err => console.error('DIY customer email failed:', err))
  )

  if (staffEmail) {
    sends.push(
      getResend().emails.send({
        from: FROM,
        to: staffEmail,
        replyTo: params.email,
        subject: `Nieuwe DIY reservering: ${params.first_name} ${params.last_name} (${params.email}) · ${weekFormatted}`,
        html: diyStaffEmailHtml(params),
      }).catch(err => console.error('DIY staff email failed:', err))
    )
  }

  await Promise.all(sends)
}

// ─── Gift Card emails ─────────────────────────────────────────────────────────

const GIFT_CARD_TYPE_LABELS: Record<string, string> = {
  digitaal: 'Digitale cadeaubon',
  gedrukt: 'Gedrukte cadeaubon',
  usb_box: 'USB Cadeaubox',
}

function giftCardPurchaserEmailHtml(params: {
  purchaser_name: string
  code: string
  type: string
  value_euros: number
  recipient_name: string
  recipient_email: string
  personal_message?: string | null
  expires_at: string
}): string {
  const typeLabel = GIFT_CARD_TYPE_LABELS[params.type] ?? params.type
  const expiresFormatted = new Date(params.expires_at).toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' })
  const p = (text: string) =>
    `<p style="margin:0 0 18px;font-size:15px;color:#3d4d3e;line-height:1.75;">${text}</p>`

  return layout(`
    <h1 style="margin:0 0 20px;font-size:22px;font-weight:600;color:#1e2d1f;letter-spacing:-0.5px;">
      Bedankt voor je bestelling!
    </h1>
    ${p(`Hi ${params.purchaser_name},`)}
    ${p(`Je hebt een <strong>${typeLabel}</strong> ter waarde van <strong>&euro;${params.value_euros.toFixed(2)}</strong> besteld voor <strong>${params.recipient_name}</strong>.`)}
    ${p(`${params.recipient_name} ontvangt binnenkort een e-mail op <strong>${params.recipient_email}</strong> met de cadeaubon en de persoonlijke code.`)}

    <!-- Code box -->
    <table width="100%" cellpadding="0" cellspacing="0" style="background:${BRAND_LIGHT};border-radius:12px;margin:24px 0;">
      <tr><td style="padding:24px;text-align:center;">
        <p style="margin:0 0 8px;font-size:11px;font-weight:600;color:#8a9e8c;text-transform:uppercase;letter-spacing:1px;">Cadeauboncode</p>
        <p style="margin:0;font-size:28px;font-weight:700;color:${BRAND_GREEN};letter-spacing:4px;font-family:monospace;">${params.code}</p>
        <p style="margin:8px 0 0;font-size:12px;color:#8a9e8c;">Geldig tot ${expiresFormatted}</p>
      </td></tr>
    </table>

    ${params.personal_message ? `
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#fff;border:1px solid #e8e6e0;border-radius:12px;margin-bottom:20px;">
      <tr><td style="padding:20px 24px;">
        <p style="margin:0 0 8px;font-size:11px;font-weight:600;color:#8a9e8c;text-transform:uppercase;letter-spacing:1px;">Jouw persoonlijk bericht</p>
        <p style="margin:0;font-size:14px;color:#3d4d3e;font-style:italic;line-height:1.7;">${params.personal_message}</p>
      </td></tr>
    </table>` : ''}

    ${p('Bewaar deze e-mail als bevestiging van jouw aankoop. Heb je vragen? Neem gerust contact met ons op.')}
    <p style="margin:24px 0 0;font-size:15px;color:#3d4d3e;line-height:1.75;">
      Met vriendelijke groet,<br/>
      <strong style="color:#1e2d1f;">Team Gravida</strong>
    </p>
  `)
}

function giftCardRecipientEmailHtml(params: {
  recipient_name: string
  code: string
  type: string
  value_euros: number
  purchaser_name: string
  personal_message?: string | null
  expires_at: string
  redeem_url: string
}): string {
  const typeLabel = GIFT_CARD_TYPE_LABELS[params.type] ?? params.type
  const expiresFormatted = new Date(params.expires_at).toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' })
  const p = (text: string) =>
    `<p style="margin:0 0 18px;font-size:15px;color:#3d4d3e;line-height:1.75;">${text}</p>`

  return layout(`
    <h1 style="margin:0 0 20px;font-size:22px;font-weight:600;color:#1e2d1f;letter-spacing:-0.5px;">
      Je hebt een cadeaubon ontvangen! 🎁
    </h1>
    ${p(`Hi ${params.recipient_name},`)}
    ${p(`<strong>${params.purchaser_name}</strong> heeft je een <strong>${typeLabel}</strong> ter waarde van <strong>&euro;${params.value_euros.toFixed(2)}</strong> cadeau gedaan.`)}

    ${params.personal_message ? `
    <!-- Personal message -->
    <table width="100%" cellpadding="0" cellspacing="0" style="background:${BRAND_LIGHT};border-radius:12px;margin:20px 0;">
      <tr><td style="padding:24px;">
        <p style="margin:0 0 10px;font-size:11px;font-weight:600;color:#8a9e8c;text-transform:uppercase;letter-spacing:1px;">Persoonlijk bericht van ${params.purchaser_name}</p>
        <p style="margin:0;font-size:15px;color:#3d4d3e;font-style:italic;line-height:1.75;">${params.personal_message}</p>
      </td></tr>
    </table>` : ''}

    <!-- Code box -->
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#fff;border:2px solid ${BRAND_GREEN};border-radius:12px;margin:20px 0;">
      <tr><td style="padding:28px;text-align:center;">
        <p style="margin:0 0 8px;font-size:11px;font-weight:600;color:#8a9e8c;text-transform:uppercase;letter-spacing:1px;">Jouw cadeauboncode</p>
        <p style="margin:0;font-size:32px;font-weight:700;color:${BRAND_GREEN};letter-spacing:4px;font-family:monospace;">${params.code}</p>
        <p style="margin:10px 0 0;font-size:12px;color:#8a9e8c;">Geldig tot ${expiresFormatted}</p>
      </td></tr>
    </table>

    ${p('Gebruik deze code bij het boeken om je cadeaubon in te wisselen. Je kunt ook op de onderstaande knop klikken.')}

    <a href="${params.redeem_url}"
       style="display:inline-block;background:${BRAND_GREEN};color:#fff;text-decoration:none;padding:14px 32px;border-radius:10px;font-size:15px;font-weight:600;margin-bottom:20px;">
      Cadeaubon inwisselen &rarr;
    </a>

    ${p('Of kopieer de code en voer deze in tijdens het boeken op <a href="https://www.gravida.nl" style="color:' + BRAND_GREEN + ';">www.gravida.nl</a>.')}
    <p style="margin:24px 0 0;font-size:15px;color:#3d4d3e;line-height:1.75;">
      Met vriendelijke groet,<br/>
      <strong style="color:#1e2d1f;">Team Gravida</strong>
    </p>
  `)
}

export async function sendGiftCardEmails(params: {
  purchaser_name: string
  purchaser_email: string
  recipient_name: string
  recipient_email: string
  code: string
  type: string
  value_euros: number
  personal_message?: string | null
  expires_at: string
}): Promise<void> {
  if (!process.env.RESEND_API_KEY) {
    console.warn('RESEND_API_KEY not set — skipping gift card email')
    return
  }

  const redeem_url = 'https://www.gravida.nl/maak-je-zwangerschapsbeeld/'
  const valueStr = params.value_euros % 1 === 0 ? String(params.value_euros) : params.value_euros.toFixed(2)
  const pdfFilename = `Gravida-cadeaubon-${params.code}.pdf`

  // Generate PDF gift card (don't let this block the emails if it fails)
  let pdfBuffer: Buffer | null = null
  try {
    pdfBuffer = await generateGiftCardPdf(params)
  } catch (err) {
    console.error('Gift card PDF generation failed:', err)
  }

  const pdfAttachment = pdfBuffer
    ? [{ filename: pdfFilename, content: pdfBuffer }]
    : []

  const sends: Promise<unknown>[] = []

  // Mail to purchaser (confirmation, with PDF)
  sends.push(
    getResend().emails.send({
      from: FROM,
      to: params.purchaser_email,
      subject: `Bevestiging: jouw cadeaubon van \u20AC${valueStr} is besteld`,
      html: giftCardPurchaserEmailHtml(params),
      attachments: pdfAttachment,
    }).catch(err => console.error('Gift card purchaser email failed:', err))
  )

  // Mail to recipient (with code + PDF)
  sends.push(
    getResend().emails.send({
      from: FROM,
      to: params.recipient_email,
      subject: `${params.purchaser_name} heeft je een Gravida cadeaubon gestuurd 🎁`,
      html: giftCardRecipientEmailHtml({ ...params, redeem_url }),
      attachments: pdfAttachment,
    }).catch(err => console.error('Gift card recipient email failed:', err))
  )

  await Promise.all(sends)
}

// Preview exports (used by /api/admin/preview/gift-card-email)
export function giftCardPurchaserEmailHtmlPreview(params: Parameters<typeof giftCardPurchaserEmailHtml>[0]): string {
  return giftCardPurchaserEmailHtml(params)
}
export function giftCardRecipientEmailHtmlPreview(params: Parameters<typeof giftCardRecipientEmailHtml>[0]): string {
  return giftCardRecipientEmailHtml(params)
}
