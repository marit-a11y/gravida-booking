import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@vercel/postgres'

export const dynamic = 'force-dynamic'

// Eenmalige import van alle bestaande GiftUp cadeaubonnen.
// Uitvoeren via: GET /api/migrate/giftup-import?key=SETUP_KEY
// Daarna kan GiftUp worden afgesloten.

const GIFTUP_CARDS = [
  {
    code: 'V4F7X',
    type: 'gedrukt',
    value_euros: 350,
    status: 'actief',
    purchaser_name: 'From your family and friends',
    purchaser_email: 'cudennec.maud@gmail.com',
    recipient_name: 'Krishna',
    recipient_email: '',
    personal_message: null,
    expires_at: '2031-04-17T16:05:11.662Z',
    created_at: '2026-04-18T16:05:11.662Z',
  },
  {
    code: 'PEJ8C',
    type: 'gedrukt',
    value_euros: 165,
    status: 'actief',
    purchaser_name: 'Vriendinnen',
    purchaser_email: '',
    recipient_name: 'Inge',
    recipient_email: '',
    personal_message: 'Dikke knuffel,\nLotte, Kiki, Suzan, Elles, Laura, Miryam, Mariska en Sanne',
    expires_at: '2031-03-22T19:46:51.782Z',
    created_at: '2026-03-23T19:46:51.782Z',
  },
  {
    code: 'BB-jb21',
    type: 'digitaal',
    value_euros: 100,
    status: 'actief',
    purchaser_name: 'Irene',
    purchaser_email: 'irenerompa@gmail.com',
    recipient_name: 'Irene',
    recipient_email: 'irenerompa@gmail.com',
    personal_message: 'Hi Irene,\n\nHierbij ontvang je van ons het ingehouden borgbedrag in een tegoed, dat kan worden gebruikt voor het bestellen van je zwangerschapsbeeldje. We kijken er naar uit je te mogen scannen!\n\nLiefs,\nLola, team Gravida',
    expires_at: '2031-02-02T20:11:13.521Z',
    created_at: '2026-02-03T20:11:13.521Z',
  },
  {
    code: 'RQF34',
    type: 'gedrukt',
    value_euros: 252,
    status: 'actief',
    purchaser_name: 'Ricardo, Joy, Stanley, Ruud',
    purchaser_email: '',
    recipient_name: 'Roswitha',
    recipient_email: '',
    personal_message: 'Speciaal voor jou: een afspraak op 15-01-2026 om 12.30 uur in Haarlem voor een 3D-scan van je zwangere lichaam, waarvan een beeldje van 15 cm (inclusief je handen) wordt gemaakt. Gewoon iets leuks om deze mooie tijd te herinneren.\u2764\ufe0f',
    expires_at: '2030-11-25T14:10:49.885Z',
    created_at: '2025-11-26T14:10:49.885Z',
  },
  {
    code: 'JB67A',
    type: 'digitaal',
    value_euros: 300,
    status: 'actief',
    purchaser_name: 'Eleonora',
    purchaser_email: 'el_neopets@hotmail.it',
    recipient_name: 'Matteo ed Ewelina',
    recipient_email: 'el_neopets@hotmail.it',
    personal_message: 'Un ricordo per sempre.\n\nDa:\nZio Marco, Orlando, Spiga, Marcolino, Manu, Francesco e Barbara, Rachela, Claudio e Lele',
    expires_at: '2030-11-12T15:29:28.019Z',
    created_at: '2025-11-13T15:29:28.019Z',
  },
  {
    code: 'RYAQK',
    type: 'gedrukt',
    value_euros: 420,
    status: 'actief',
    purchaser_name: 'Ons allemaal',
    purchaser_email: '',
    recipient_name: 'Mom to be Fleur',
    recipient_email: '',
    personal_message: 'Lieve Fleur. Voor jou een cadeaubon om een mooie herinnering te laten maken van jou prachtige en krachtige lijf in deze bijzondere periode. Op zaterdag 29 november ga je samen met Miguel je scan laten maken, kies wat moois uit! Liefs van ons allemaal en ook van papa',
    expires_at: '2030-10-11T16:33:44.916Z',
    created_at: '2025-10-12T16:33:44.916Z',
  },
  {
    code: 'BB-k5y2',
    type: 'digitaal',
    value_euros: 50,
    status: 'actief',
    purchaser_name: 'Gravida.nl',
    purchaser_email: 'amber-edens@hotmail.com',
    recipient_name: 'Amber',
    recipient_email: 'amber-edens@hotmail.com',
    personal_message: 'Hi Amber,\n\nNogmaals bedankt voor je begripvolle reactie en geduld. Hierbij zoals beloofd de cadaubon ter compensatie.\n\nVriendelijke groeten,\n\nMarit - Gravida.nl',
    expires_at: '2030-09-14T12:04:22.167Z',
    created_at: '2025-09-15T12:04:22.167Z',
  },
  {
    code: '48MXY',
    type: 'digitaal',
    value_euros: 275,
    status: 'actief',
    purchaser_name: 'De meiden',
    purchaser_email: 'mellaneydekruyk@hotmail.com',
    recipient_name: 'Ilona\u2665',
    recipient_email: 'mellaneydekruyk@hotmail.com',
    personal_message: 'Lieve ilona,\nMet deze bon hopen we dat je deze bijzondere periode op een mooie manier kunt vastleggen.\nEen herinnering om voor altijd te koesteren.\nLiefs,\nDe meiden',
    expires_at: '2030-08-11T18:30:18.329Z',
    created_at: '2025-08-12T18:30:18.329Z',
  },
  {
    code: '4G3V6',
    type: 'digitaal',
    value_euros: 30,
    status: 'actief',
    purchaser_name: 'Martijn, Annerie & Liam',
    purchaser_email: 'anneriekocx@hotmail.com',
    recipient_name: 'Eline',
    recipient_email: 'anneriekocx@hotmail.com',
    personal_message: 'Hiep hiep hoera! Gefeliciteerd met je verjaardag!',
    expires_at: '2030-05-31T10:32:19.178Z',
    created_at: '2025-06-01T10:32:19.178Z',
  },
  {
    code: 'WR6W7',
    type: 'digitaal',
    value_euros: 150,
    status: 'actief',
    purchaser_name: 'W. Jonkheer',
    purchaser_email: 'wfjonkheer@ziggo.nl',
    recipient_name: 'Eline Timmermans',
    recipient_email: 'wfjonkheer@ziggo.nl',
    personal_message: null,
    expires_at: '2030-05-28T15:04:23.667Z',
    created_at: '2025-05-29T15:04:23.667Z',
  },
] as const

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const key = searchParams.get('key')

  const setupKey = process.env.SETUP_KEY
  if (!setupKey || key !== setupKey) {
    return NextResponse.json({ error: 'Ongeldige setup sleutel' }, { status: 403 })
  }

  let imported = 0
  let skipped  = 0
  const errors: string[] = []

  for (const card of GIFTUP_CARDS) {
    try {
      const result = await sql`
        INSERT INTO gift_cards (
          code, type, value_euros, status,
          purchaser_name, purchaser_email,
          recipient_name, recipient_email,
          personal_message, expires_at, created_at
        ) VALUES (
          ${card.code},
          ${card.type},
          ${card.value_euros},
          ${card.status},
          ${card.purchaser_name},
          ${card.purchaser_email},
          ${card.recipient_name},
          ${card.recipient_email},
          ${card.personal_message},
          ${card.expires_at},
          ${card.created_at}
        )
        ON CONFLICT (code) DO NOTHING
      `
      if ((result.rowCount ?? 0) > 0) {
        imported++
      } else {
        skipped++
      }
    } catch (err) {
      errors.push(`${card.code}: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  return NextResponse.json({
    success: true,
    message: `${imported} cadeaubonnen geïmporteerd, ${skipped} overgeslagen (al bestond).`,
    imported,
    skipped,
    ...(errors.length > 0 ? { errors } : {}),
  })
}
