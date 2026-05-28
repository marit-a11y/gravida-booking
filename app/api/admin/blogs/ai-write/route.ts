import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

export const dynamic = 'force-dynamic'
export const maxDuration = 90

const BRAND = `
## Over Gravida (gebruik dit als bron, maar herhaal niet letterlijk)
Gravida is een Nederlandse 3D zwangerschapsscan-studio. Vaste contactpersoon: Laila. WhatsApp 06 8706 2504.
Aanbod:
- 3D/4D/HD pretecho's, zowel in studio Haarlem als aan huis (mobiele scans in heel Nederland).
- DIY scan kit (huur thuis, €200 borg, klant scant zelf).
- Handgemaakte 3D geboortebeeldjes uit de scan, materialen: resin (basic, deluxe, signature), veredelde resin, brons, epoxy, composiet steen, glas, mini's in zilver of goud verguld.
- Bedels, sieraden en cadeaubonnen.
- Productieproces van scan tot beeldje duurt ongeveer 6 tot 8 weken.
- Ideale week voor een 3D scan: tussen 25 en 30 weken zwangerschap.
- Toestemmingsformulier wordt vooraf ingevuld; bestanden kunnen optioneel bewaard worden voor nabestellingen.
Doelgroep: zwangere vrouwen 25 tot 35 jaar, partners, vriendinnen, schoonmoeders die een cadeau zoeken.
`.trim()

const STYLE_RULES = `
## Schrijfstijl-regels (verplicht)
- Tutoyeren ("je", niet "u"). Warm, persoonlijk, hoogwaardig, niet pushy.
- GEEN em-dashes (—) of en-dashes (–). Gebruik komma's, punten of haakjes.
- GEEN emoji's in de blogtekst.
- Korte alinea's, max 3 zinnen per alinea.
- Markdown: ## voor secties, **vet** voor nadruk, geen H1.
- Persoonlijke afsluiting van Laila met WhatsApp 06 8706 2504.
- Géén Lorem ipsum of placeholder-teksten.
`.trim()

const SEO_RULES = `
## SEO + AEO regels (Answer Engine Optimization, voor vindbaarheid in Google ÉN AI zoals ChatGPT, Perplexity, Gemini)

### Klassieke SEO
- Focus-keyword 1x in titel (liefst aan het begin), 1x in eerste 100 woorden, 1x in een H2-kop, en natuurlijk vervlochten in de tekst (geen keyword-stuffing, dichtheid 0.5-1.5%).
- Gebruik long-tail varianten en semantisch verwante termen (LSI keywords) door de tekst heen.
- ## koppen moeten beschrijvend zijn en zoekintentie raken (zo veel mogelijk vraag-gericht).
- Eerste alinea geeft direct antwoord op de hoofdvraag (geen wollig intro), 40 tot 60 woorden.
- Voeg minstens één concrete cijfer/feit toe (week-aantal, prijs-indicatie, duur).

### AEO / GEO (Generative Engine Optimization, voor LLM's)
- DIRECT ANTWOORD bovenaan: na de openingsalinea een "key_takeaway" van 1-2 zinnen die de hoofdvraag in feiten beantwoordt. LLM's pakken juist deze citeerbare zin.
- Schrijf in zelfstandige, citeerbare zinnen. Vermijd "zoals hierboven genoemd" of context die ergens anders in de tekst staat.
- Gebruik expliciete definities: "Een 3D pretecho is een echografie waarbij..."
- Concrete entiteiten en getallen (week 25-30, 6-8 weken, €200 borg) verhogen AI-citatie-kans aanzienlijk.
- FAQ-sectie aan het einde: 3 tot 5 vragen met korte, zelfstandige antwoorden (40-80 woorden per antwoord). Elk antwoord moet OOK ZONDER de blog-context te lezen zijn. Dit komt direct in FAQ schema en wordt graag door AI gepakt.
- E-E-A-T: noem dat Laila de expert is, persoonlijke ervaring, jaren actief.
- Vermijd marketing-fluff ("de mooiste ervaring ooit"). LLM's filteren dat eruit. Schrijf in feitelijke statements waar mogelijk.
- Lengte: 700 tot 1000 woorden inclusief FAQ.
`.trim()

export async function POST(request: NextRequest) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY ontbreekt in Vercel env' }, { status: 500 })
  }
  try {
    const body = await request.json()
    const { title, excerpt, category, extra_instructions, focus_keyword } = body
    if (!title || typeof title !== 'string') {
      return NextResponse.json({ error: 'Titel verplicht' }, { status: 400 })
    }

    const prompt = `${BRAND}

${STYLE_RULES}

${SEO_RULES}

## Opdracht
Schrijf een volledige Nederlandse blogpost geoptimaliseerd voor zowel klassieke SEO als AEO/LLM-vindbaarheid.

Werktitel: ${title}
${focus_keyword ? `Focus-keyword (door Marit opgegeven): ${focus_keyword}` : 'Focus-keyword: bepaal zelf de meest logische long-tail zoekterm (Nederlands, zoals iemand het in Google of ChatGPT zou typen)'}
${excerpt ? `Hoek / intro: ${excerpt}` : ''}
${category ? `Categorie: ${category}` : ''}
${extra_instructions ? `\nExtra wensen van Marit:\n${extra_instructions}` : ''}

## Structuur van de content
1. **Openingsalinea (40-60 woorden)**: geeft direct antwoord op de hoofdvraag, met focus-keyword.
2. **Key takeaway** (apart veld, niet in content): 1-2 zinnen die het hoofdantwoord samenvatten, citeerbaar.
3. **3 tot 5 secties** met ## koppen die zoekintenties raken (liefst als vraag of concrete belofte).
4. **FAQ sectie** als laatste ## kop met 3-5 vragen. Elk antwoord 40-80 woorden, ZELFSTANDIG leesbaar.
5. **Afsluiting** ondertekend door Laila met uitnodiging tot contact via WhatsApp 06 8706 2504.

## Output
Geef terug als JSON met exact dit format:
{
  "meta_title": "<SEO titel, 50-65 tekens, focus-keyword vooraan>",
  "meta_description": "<meta description 140-160 tekens, lokt klik uit, bevat focus-keyword en mini-USP>",
  "focus_keyword": "<de gebruikte focus-keyword>",
  "related_keywords": ["6-10 semantisch verwante long-tail varianten"],
  "excerpt": "<korte intro 1-2 zinnen, max 200 tekens, voor blog overzicht>",
  "key_takeaway": "<de citeerbare 1-2 zin samenvatting (zonder Markdown)>",
  "content": "<volledige Markdown blogpost, 700-1000 woorden incl FAQ, zonder H1>",
  "tags": ["3-6 tags, kleine letters, zonder #"],
  "faq": [
    { "question": "<vraag zoals iemand het in Google/ChatGPT typt>", "answer": "<zelfstandig leesbaar antwoord 40-80 woorden, géén dashes, géén emoji>" }
  ]
}

Alleen JSON, geen verdere uitleg.`

    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    const response = await client.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 6000,
      messages: [{ role: 'user', content: prompt }],
    })

    const text = response.content
      .filter(c => c.type === 'text')
      .map(c => (c as { type: 'text'; text: string }).text)
      .join('')

    let jsonText = text.trim()
    const fenced = jsonText.match(/```(?:json)?\s*([\s\S]*?)```/)
    if (fenced) jsonText = fenced[1].trim()

    let parsed: {
      meta_title?: string
      meta_description?: string
      focus_keyword?: string
      related_keywords?: string[]
      excerpt?: string
      key_takeaway?: string
      content?: string
      tags?: string[]
      faq?: { question: string; answer: string }[]
    }
    try {
      parsed = JSON.parse(jsonText)
    } catch {
      return NextResponse.json({ error: 'AI response kon niet geparsed worden', raw: text.slice(0, 500) }, { status: 500 })
    }

    // Safety: strip dashes the model might have slipped in
    const clean = (s?: string) => (s ?? '').replace(/—/g, ', ').replace(/–/g, ', ')

    return NextResponse.json({
      meta_title: clean(parsed.meta_title),
      meta_description: clean(parsed.meta_description),
      focus_keyword: clean(parsed.focus_keyword),
      related_keywords: Array.isArray(parsed.related_keywords) ? parsed.related_keywords : [],
      excerpt: clean(parsed.excerpt),
      key_takeaway: clean(parsed.key_takeaway),
      content: clean(parsed.content),
      tags: Array.isArray(parsed.tags) ? parsed.tags : [],
      faq: Array.isArray(parsed.faq) ? parsed.faq.map(q => ({
        question: clean(q.question),
        answer: clean(q.answer),
      })) : [],
    })
  } catch (err) {
    console.error('AI blog write error:', err)
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: 'AI request mislukt: ' + msg }, { status: 500 })
  }
}
