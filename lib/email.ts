import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

const FROM = process.env.EMAIL_FROM ?? 'Gravida <boekingen@gravida.nl>'
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
  const staffSubject = `Nieuwe boeking: ${params.first_name} ${params.last_name} · ${dateFormatted} ${params.time_slot} · ${params.region}`

  // Determine staff recipients: configured addresses + matching staff emails
  const staffRecipients = [
    ...(process.env.STAFF_EMAIL ? [process.env.STAFF_EMAIL] : []),
    ...params.staff_emails,
  ].filter((e, i, arr) => e && arr.indexOf(e) === i) // deduplicate

  const sends: Promise<unknown>[] = []

  // Customer confirmation
  sends.push(
    resend.emails.send({
      from: FROM,
      to: params.email,
      subject: customerSubject,
      html: customerEmailHtml(params),
    }).catch(err => console.error('Customer email failed:', err))
  )

  // Staff notification (only if we have recipients)
  if (staffRecipients.length > 0) {
    sends.push(
      resend.emails.send({
        from: FROM,
        to: staffRecipients,
        subject: staffSubject,
        html: staffEmailHtml(params),
      }).catch(err => console.error('Staff email failed:', err))
    )
  } else {
    console.warn('No staff email recipients configured for region:', params.region)
  }

  await Promise.all(sends)
}
