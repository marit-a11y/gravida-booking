import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { getEventForDate, getEventsForMonth } from '@/lib/social-themes'

export const dynamic = 'force-dynamic'
export const maxDuration = 90

interface IdeaSuggestion {
  title: string
  caption: string
  hashtags: string
  post_type: 'feed' | 'story' | 'reel' | 'carousel'
  reasoning?: string
}

export async function POST(request: NextRequest) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({
      error: 'ANTHROPIC_API_KEY ontbreekt — voeg toe in Vercel env vars'
    }, { status: 500 })
  }

  try {
    const body = await request.json()
    const {
      category,
      post_type,
      date,           // YYYY-MM-DD optional
      count = 5,
      mode = 'ideas', // 'ideas' = brainstorm 5 ideeen, 'caption' = volledige caption op basis van titel, 'custom' = 5 captions op basis van eigen context
      title,          // bij mode='caption'
      custom_context, // bij mode='custom' of als extra info bij andere modes
    } = body

    // Vind events rond de datum. We onderscheiden 3 zones:
    // - EXACT: zelfde dag → AI mag/moet expliciet aanhaken
    // - NABIJ (±3 dagen): aanloop-content toegestaan ("over 2 dagen is het Moederdag")
    // - VERDER WEG (rest van maand): puur info, NIET als hook gebruiken
    let eventContext = ''
    if (date) {
      const [y, m, d] = date.split('-').map(Number)
      const target = new Date(y, m - 1, d)
      const exact = getEventForDate(y, m - 1, d)
      const monthEvents = getEventsForMonth(y, m - 1)
      const nearby = monthEvents.filter(e => {
        if (e.date === date) return false  // exact al apart
        const ed = new Date(e.date + 'T00:00:00')
        const days = Math.round((ed.getTime() - target.getTime()) / 86400000)
        return days >= -1 && days <= 7  // 1 dag na of tot 7 dagen voor (aanloop)
      })

      const parts: string[] = []
      if (exact.length > 0) {
        parts.push(`DEZE DAG (${date}) IS: ${exact.map(e => `${e.emoji} ${e.name}${e.hook ? ` — ${e.hook}` : ''}`).join('; ')}. Haak hier expliciet op aan in elk idee.`)
      }
      if (nearby.length > 0) {
        const nearbyText = nearby.map(e => {
          const ed = new Date(e.date + 'T00:00:00')
          const days = Math.round((ed.getTime() - target.getTime()) / 86400000)
          const when = days > 0 ? `over ${days} dag${days === 1 ? '' : 'en'}` : days < 0 ? `${Math.abs(days)} dag${Math.abs(days) === 1 ? '' : 'en'} geleden` : 'vandaag'
          return `${e.date} (${when}): ${e.emoji} ${e.name}${e.hook ? ` — ${e.hook}` : ''}`
        }).join(' | ')
        parts.push(`Aanloop-data binnen 1 week: ${nearbyText}. Mag gebruikt worden voor teaser/aankondiging als het past, maar alleen als het écht klopt qua timing.`)
      }
      if (exact.length === 0 && nearby.length === 0) {
        parts.push(`Op ${date} staat GEEN themadag of feestdag gepland. Verzin algemene Gravida-content — verwijs NIET naar themadagen die elders in de maand vallen, want dan klopt de timing niet.`)
      }
      eventContext = '\n\n## DATUM-CONTEXT\n' + parts.join('\n')
    }

    const brand = `
Brand context — Gravida:
- Premium 3D zwangerschapsscan-studio in Nederland
- Aanbod: 3D scans op locatie (aan-huis in NL regio's), studio scans, DIY scan kit (huur, €200 borg), 3D geboortebeeldjes (handgemaakt na de scan), bedels/sieraden, cadeaubonnen
- Doelgroep: aanstaande ouders, voornamelijk moeders, partners, vriendinnen/familie van zwangere
- Toon: warm, persoonlijk, sfeervol, hoogwaardig, niet pushy. Nederlands. Tutoyeren ("je", niet "u")
- Emoji-gebruik: spaarzaam maar wel sfeerverhogend
- Geen overdreven sales taal, wel duidelijke call-to-actions
`.trim()

    const customBlock = custom_context && typeof custom_context === 'string' && custom_context.trim()
      ? `\n\n## EIGEN CONTEXT VAN MARIT (heel belangrijk — verwerk dit in elk idee)\n${custom_context.trim()}`
      : ''

    let prompt: string
    if (mode === 'custom' && custom_context) {
      // 5 verschillende captions voor dezelfde context (verschillende toon/insteek)
      prompt = `${brand}

Marit heeft een specifieke post in gedachten en heeft hieronder de context beschreven.
Schrijf ${count} VERSCHILLENDE caption-varianten voor dezelfde post, zodat ze kan kiezen welke het beste past.

${category ? `Categorie: ${category}` : ''}
${post_type ? `Post type: ${post_type}` : ''}
${eventContext}
${customBlock}

VARIATIE-INSTRUCTIE — geef 5 verschillende invalshoeken:
1. Persoonlijk/warm verhalend
2. Educatief/informatief
3. Speels/luchtig
4. Sfeervol/poëtisch met focus op gevoel
5. Recht-toe-recht-aan met duidelijke CTA

Elke variant mag in titel iets anders benadrukken. Hou hashtags relevant en consistent.

Geef terug als JSON met exact dit format:
{
  "ideas": [
    {
      "title": "<korte titel max 60 tekens — varieer per variant>",
      "caption": "<de caption, 2-6 zinnen, met passende emoji's, eindigend met een vraag of CTA>",
      "hashtags": "<10-15 relevante hashtags op één regel, beginnend met #>",
      "post_type": "${post_type ?? 'feed'}",
      "reasoning": "<1 zin: welke insteek (verhalend / educatief / speels / sfeervol / recht-toe-recht-aan)>"
    }
  ]
}

Alleen JSON, geen verdere uitleg.`
    } else if (mode === 'caption' && title) {
      prompt = `${brand}

Schrijf een Instagram post voor Gravida.

Categorie: ${category ?? 'algemeen'}
Post type: ${post_type ?? 'feed'}
Titel/onderwerp: ${title}
${eventContext}
${customBlock}

Geef terug als JSON met exact dit format:
{
  "ideas": [
    {
      "title": "${title}",
      "caption": "<de caption, 2-5 zinnen, met passende emoji's, eindigend met een vraag of CTA>",
      "hashtags": "<10-15 relevante hashtags op één regel, gescheiden door spaties, beginnend met #>",
      "post_type": "${post_type ?? 'feed'}"
    }
  ]
}

Alleen JSON, geen verdere uitleg.`
    } else {
      prompt = `${brand}

Brainstorm ${count} concrete Instagram post-ideeën voor Gravida.

${category ? `Categorie: ${category}` : 'Categorie: vrij — kies wat past bij Gravida'}
${post_type ? `Post type: ${post_type}` : 'Post type: kies passend per idee (feed / story / reel / carousel)'}
${eventContext}
${customBlock}

BELANGRIJKE REGEL — TIMING:
- Refereer alleen aan een feestdag of themadag als die ook ECHT op of vlak vóór de geplande datum valt (zie DATUM-CONTEXT hierboven).
- Als de DATUM-CONTEXT zegt dat er geen themadag is, verzin GEEN content rond dagen die elders in de maand vallen — die zijn alleen ter info.
- Bijvoorbeeld: een post op 11 mei mag NIET gaan over de Internationale Dag van de Verloskundige (5 mei), want die is al voorbij.

Maak elk idee uniek en uitvoerbaar. Variatie in toon en aanpak.

Geef terug als JSON met exact dit format:
{
  "ideas": [
    {
      "title": "<korte titel, max 60 tekens>",
      "caption": "<concept-caption van 2-5 zinnen, met emoji's, eindigend met vraag of CTA>",
      "hashtags": "<10-15 relevante hashtags op één regel>",
      "post_type": "feed" | "story" | "reel" | "carousel",
      "reasoning": "<1 zin: waarom dit idee werkt voor Gravida>"
    }
  ]
}

Alleen JSON, geen verdere uitleg.`
    }

    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    // Custom-context modus heeft veel output (5 captions x 5 zinnen + hashtags)
    // — geef wat extra ruimte, anders gewoon 2000 tokens.
    const maxTokens = mode === 'custom' ? 3500 : 2000
    const response = await client.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: maxTokens,
      messages: [{ role: 'user', content: prompt }],
    })

    const text = response.content
      .filter(c => c.type === 'text')
      .map(c => (c as { type: 'text'; text: string }).text)
      .join('')

    // Extract JSON (model kan ```json blokken toevoegen)
    let jsonText = text.trim()
    const fenced = jsonText.match(/```(?:json)?\s*([\s\S]*?)```/)
    if (fenced) jsonText = fenced[1].trim()

    let parsed: { ideas: IdeaSuggestion[] }
    try {
      parsed = JSON.parse(jsonText)
    } catch {
      return NextResponse.json({
        error: 'AI response kon niet geparsed worden',
        raw: text.slice(0, 500),
      }, { status: 500 })
    }

    return NextResponse.json({ ideas: parsed.ideas ?? [] })
  } catch (err) {
    console.error('AI ideas error:', err)
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: 'AI request mislukt: ' + msg }, { status: 500 })
  }
}
