// Belangrijke data voor de social planner: feestdagen, themadagen, seizoenen.
// Wordt gebruikt om badges in de kalender te tonen + suggesties bij AI ideeen.

export interface ThemeEvent {
  date: string  // YYYY-MM-DD
  name: string
  emoji: string
  type: 'feestdag' | 'themadag' | 'commercieel' | 'gravida'
  hook?: string  // korte aanhakingssuggestie voor content
}

// ─── Vaste data (zelfde dag elk jaar) ─────────────────────────────────────
const FIXED_DATES: Omit<ThemeEvent, 'date'> & { month: number; day: number }[] = [
  // ── Algemene feestdagen ──────────────────────────────────────────────
  { month: 1,  day: 1,  name: 'Nieuwjaarsdag',           emoji: '🎉', type: 'feestdag',    hook: 'Nieuw jaar, nieuw begin — perfecte kans om geboortebeeldjes te delen' },
  { month: 2,  day: 14, name: 'Valentijnsdag',           emoji: '💌', type: 'commercieel', hook: 'Cadeau-idee voor aanstaande ouders / partner — cadeaubon-actie' },
  { month: 3,  day: 8,  name: 'Internationale Vrouwendag', emoji: '♀️', type: 'themadag',  hook: 'Vier het lichaam en kracht van vrouwen / aanstaande moeders' },
  { month: 4,  day: 27, name: 'Koningsdag',              emoji: '👑', type: 'feestdag',    hook: 'Oranje content / open atelier vibe' },
  { month: 5,  day: 4,  name: 'Dodenherdenking',         emoji: '🕯️', type: 'feestdag',    hook: 'Stil moment — geen commerciële post' },
  { month: 5,  day: 5,  name: 'Bevrijdingsdag',          emoji: '🎈', type: 'feestdag' },
  { month: 10, day: 31, name: 'Halloween',               emoji: '🎃', type: 'commercieel', hook: 'Speelse zwangerschapsbuik-content (skelet-vibes met buik bv.)' },
  { month: 11, day: 11, name: 'Sint-Maarten',            emoji: '🏮', type: 'feestdag' },
  { month: 12, day: 5,  name: 'Sinterklaas',             emoji: '🎁', type: 'feestdag',    hook: 'Cadeauboncampagne — bestel op tijd voor pakjesavond' },
  { month: 12, day: 24, name: 'Kerstavond',              emoji: '🎄', type: 'feestdag',    hook: 'Cadeauboncampagne — last-minute beeldje of bon' },
  { month: 12, day: 25, name: 'Eerste Kerstdag',         emoji: '🎄', type: 'feestdag' },
  { month: 12, day: 26, name: 'Tweede Kerstdag',         emoji: '🎄', type: 'feestdag' },
  { month: 12, day: 31, name: 'Oudejaarsavond',          emoji: '🎆', type: 'feestdag',    hook: 'Year in review / dankjewel post — geboortes van dit jaar' },

  // ── Seizoenen ───────────────────────────────────────────────────────
  { month: 3,  day: 20, name: 'Begin van de lente',      emoji: '🌷', type: 'themadag',    hook: 'Nieuw leven, lente, frisse start' },
  { month: 6,  day: 21, name: 'Begin van de zomer',      emoji: '☀️', type: 'themadag',    hook: 'Zwangerschap in de zomer — tips, beelden buiten' },
  { month: 9,  day: 22, name: 'Begin van de herfst',     emoji: '🍂', type: 'themadag',    hook: 'Cosy zwangerschap, herfstcollectie beeldjes' },
  { month: 12, day: 21, name: 'Begin van de winter',     emoji: '❄️', type: 'themadag',    hook: 'Cosy buikfoto, kerstcollectie' },

  // ── Zwangerschap / baby / verloskunde-specifiek (kerncontent voor Gravida) ──
  { month: 1,  day: 1,  name: 'Doula Awareness Month (start)', emoji: '🤝', type: 'themadag', hook: 'Hele januari — eer doulas en bevallingsbegeleiders' },
  { month: 2,  day: 7,  name: 'Wereld Zwangerschaps & Geboorte Welzijn Dag', emoji: '🤰', type: 'themadag', hook: 'Bewustzijn rond mentaal welzijn tijdens zwangerschap' },
  { month: 3,  day: 21, name: 'Wereld Down Syndroom Dag',  emoji: '💛', type: 'themadag', hook: 'Inclusiviteit — gevoelig framen, geen commercieel' },
  { month: 4,  day: 11, name: 'International Day for Maternal Health and Rights', emoji: '🤱', type: 'themadag', hook: 'Bewustzijn moedergezondheid wereldwijd' },
  { month: 4,  day: 28, name: 'Wereld IVF Dag (eerste IVF baby)', emoji: '🌟', type: 'themadag', hook: 'IVF/vruchtbaarheidsreis — sensitief en bemoedigend' },
  { month: 5,  day: 5,  name: 'Internationale Dag van de Verloskundige', emoji: '🤰', type: 'themadag', hook: 'Eer verloskundigen — partners van Gravida' },
  { month: 5,  day: 1,  name: 'International Doula Month (start)', emoji: '🤝', type: 'themadag', hook: 'Hele mei — eer doulas en bevallingsbegeleiders' },
  { month: 5,  day: 28, name: 'Internationale Dag voor Vrouwengezondheid', emoji: '♀️', type: 'themadag', hook: 'Vrouwen-welzijn breed' },
  { month: 6,  day: 1,  name: 'Pregnancy Awareness Month (start)', emoji: '🤰', type: 'themadag', hook: 'Hele juni — zwangerschapscontent extra welkom' },
  { month: 7,  day: 25, name: 'Wereld IVF Dag',          emoji: '👶', type: 'themadag',    hook: 'Verjaardag eerste IVF-baby — hoop & wetenschap' },
  { month: 8,  day: 1,  name: 'Wereldborstvoedingsweek (start)', emoji: '🤱', type: 'themadag', hook: 'Borstvoeding awareness — 1-7 augustus' },
  { month: 8,  day: 7,  name: 'Wereldborstvoedingsweek (einde)', emoji: '🤱', type: 'themadag', hook: 'Afsluitend bericht borstvoedingsweek' },
  { month: 9,  day: 1,  name: 'Newborn Care Awareness Month (start)', emoji: '👶', type: 'themadag', hook: 'Zorg voor pasgeborenen — hele september' },
  { month: 9,  day: 18, name: 'Internationale Pasgeborenendag', emoji: '👶', type: 'themadag', hook: 'Vier het wonder van een nieuw mensje' },
  { month: 10, day: 1,  name: 'Pregnancy and Infant Loss Awareness Month (start)', emoji: '🕊️', type: 'themadag', hook: 'Hele oktober — sensitief, niet commercieel' },
  { month: 10, day: 15, name: 'Pregnancy & Infant Loss Awareness Day', emoji: '🕊️', type: 'themadag', hook: 'Wave of Light om 19u — stil moment voor verlies' },
  { month: 11, day: 17, name: 'Wereld Prematurendag',    emoji: '💜', type: 'themadag',    hook: 'Bewustzijn voor te vroeg geboren baby&apos;s — paarse content' },
  { month: 11, day: 25, name: 'International Day for Elimination of Violence Against Women', emoji: '🧡', type: 'themadag', hook: 'Geen commercieel; misschien stil signaal' },
  { month: 12, day: 14, name: 'Internationale Monkey Day (zwangerschapssymbool buik)', emoji: '🐵', type: 'commercieel', hook: 'Speels: schattige buik-content' },
] as never

// ─── Variabele data per jaar (Pasen-gebaseerd + Moederdag/Vaderdag) ──────
// Pasen via Computus (Anonymous Gregorian algorithm)
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

// Moederdag: 2e zondag van mei
function mothersDay(year: number): Date {
  const d = new Date(year, 4, 1)
  while (d.getDay() !== 0) d.setDate(d.getDate() + 1)
  d.setDate(d.getDate() + 7)
  return d
}

// Vaderdag: 3e zondag van juni
function fathersDay(year: number): Date {
  const d = new Date(year, 5, 1)
  while (d.getDay() !== 0) d.setDate(d.getDate() + 1)
  d.setDate(d.getDate() + 14)
  return d
}

function pad(n: number) { return String(n).padStart(2, '0') }
function fmt(d: Date) { return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}` }
function addDays(d: Date, days: number) { const r = new Date(d); r.setDate(r.getDate() + days); return r }

export function getEventsForYear(year: number): ThemeEvent[] {
  const events: ThemeEvent[] = []

  // Vaste data
  for (const e of FIXED_DATES as unknown as (Omit<ThemeEvent,'date'> & {month:number;day:number})[]) {
    events.push({
      date: `${year}-${pad(e.month)}-${pad(e.day)}`,
      name: e.name,
      emoji: e.emoji,
      type: e.type,
      hook: e.hook,
    })
  }

  // Pasen-gebaseerd
  const easter = easterSunday(year)
  events.push({ date: fmt(addDays(easter, -2)), name: 'Goede Vrijdag',  emoji: '✝️', type: 'feestdag' })
  events.push({ date: fmt(easter),              name: 'Eerste Paasdag', emoji: '🐣', type: 'feestdag', hook: 'Nieuw leven, lente, paasthema voor zwangerschap' })
  events.push({ date: fmt(addDays(easter, 1)),  name: 'Tweede Paasdag', emoji: '🐣', type: 'feestdag' })
  events.push({ date: fmt(addDays(easter, 39)), name: 'Hemelvaartsdag', emoji: '☁️', type: 'feestdag' })
  events.push({ date: fmt(addDays(easter, 49)), name: 'Eerste Pinksterdag', emoji: '🕊️', type: 'feestdag' })
  events.push({ date: fmt(addDays(easter, 50)), name: 'Tweede Pinksterdag', emoji: '🕊️', type: 'feestdag' })
  // Carnaval (zondag 49 dagen voor Pasen)
  events.push({ date: fmt(addDays(easter, -49)), name: 'Carnaval (zondag)', emoji: '🎭', type: 'feestdag', hook: 'Vooral relevant in Brabant/Limburg' })

  // Moederdag & Vaderdag — heel belangrijk voor Gravida
  events.push({ date: fmt(mothersDay(year)), name: 'Moederdag',  emoji: '💐', type: 'commercieel', hook: 'TOPDAG voor Gravida — geboortebeeldjes als cadeau, cadeaubonnen, last-minute campagne in week ervoor' })
  events.push({ date: fmt(fathersDay(year)), name: 'Vaderdag',   emoji: '👨‍👶', type: 'commercieel', hook: 'Geboortebeeldje voor papa, betrek partners in de scan-ervaring' })

  return events.sort((a, b) => a.date.localeCompare(b.date))
}

export function getEventsForMonth(year: number, month: number): ThemeEvent[] {
  return getEventsForYear(year).filter(e => {
    const m = parseInt(e.date.slice(5, 7), 10) - 1
    return m === month
  })
}

export function getEventForDate(year: number, month: number, day: number): ThemeEvent[] {
  const key = `${year}-${pad(month + 1)}-${pad(day)}`
  return getEventsForYear(year).filter(e => e.date === key)
}

// ─── Content-ideeën per categorie (statische lijst, geen AI nodig) ─────────
export interface CategoryIdea {
  title: string
  description: string
  bestType?: 'feed' | 'story' | 'reel' | 'carousel'
}

export const CONTENT_IDEAS: Record<string, CategoryIdea[]> = {
  'Beeldjes': [
    { title: 'Productfoto van het maandbeeldje', description: 'Mooie close-up van een specifiek beeldje uit de collectie met sfeervolle styling', bestType: 'feed' },
    { title: 'Voor & na: van scan naar beeldje', description: 'Carousel met de scan-foto en het uiteindelijke 3D beeldje', bestType: 'carousel' },
    { title: 'Maakproces in de studio', description: 'Behind the scenes van hoe een beeldje gemaakt wordt — klei, printen, afwerken', bestType: 'reel' },
    { title: 'Klantbeeldje uitpakken', description: 'Reveal van een verzendklaar beeldje, eventueel reactie van klant erbij', bestType: 'reel' },
    { title: 'Vergelijking maten', description: 'Foto met alle beeldjesformaten naast elkaar zodat klanten kunnen kiezen', bestType: 'feed' },
    { title: 'Beeldje + babyfoto na geboorte', description: 'Klanten die het beeldje naast hun pasgeboren baby tonen — ultieme social proof', bestType: 'feed' },
    { title: 'Cadeau-set sfeerfoto', description: 'Beeldje samen met cadeaubon, persoonlijke kaart, mooi ingepakt', bestType: 'feed' },
    { title: 'Materiaal-uitleg', description: 'Welke materialen gebruiken we, wat zijn de opties (kleuren, basis)', bestType: 'carousel' },
    { title: 'Kleinste detail', description: 'Macro-foto van een handje of voetje — laat de precisie zien', bestType: 'feed' },
    { title: 'Houdbaarheid & verzorging', description: 'Hoe bewaar je je beeldje, hoe lang gaat het mee', bestType: 'carousel' },
  ],
  'FAQ': [
    { title: 'Wat is een 3D scan precies?', description: 'Korte uitleg met visuele ondersteuning — hoe verschilt het van een echo?' },
    { title: 'Beste zwangerschapsweek voor scan?', description: 'Tussen welke weken is het beeld het mooist (meestal 27-32 weken)' },
    { title: 'Hoe lang duurt een scan?', description: 'Praktische info over duur sessie + hoe je je voorbereidt' },
    { title: 'Mag mijn partner / familie mee?', description: 'Wie mag aanwezig zijn tijdens de scan' },
    { title: 'Wat als de baby ligt verkeerd?', description: 'Tips als baby verstopt zit / niet goed in beeld komt — gratis nieuwe afspraak?' },
    { title: 'Verschil 3D vs 4D vs HD?', description: 'Visueel uitgelegd met voorbeelden' },
    { title: 'Veiligheid van een 3D scan', description: 'Geruststellende info — niet meer geluidsgolven dan een gewone echo' },
    { title: 'Hoe boek ik een scan?', description: 'Stap voor stap door het boekingsproces' },
    { title: 'Wat krijg ik na de scan?', description: 'Foto&apos;s, video, optie voor beeldje — wat zit erbij' },
    { title: 'Kan ik een DIY scan kit huren?', description: 'Voor wie geen scan op locatie wil/kan — uitleg DIY kit + borg' },
  ],
  'This or that': [
    { title: 'Jongen of meisje verwacht je?', description: 'Polling story met intuïtie-vraag' },
    { title: 'Naam met 1 of 2 letters?', description: 'Korte vs lange babynamen — peilen voorkeur volgers' },
    { title: 'Studio scan of DIY thuis?', description: 'Welke optie past beter — peil voorkeur' },
    { title: 'Beeldje in zilver of goud?', description: 'Kleurkeuze peilen voor nieuwe collectie' },
    { title: 'Buikfoto: kleurrijk of zwart-wit?', description: 'Stijlpreferentie' },
    { title: 'Babykamer: pastel of fel?', description: 'Trend-content rond babykamer interieur' },
    { title: 'Geboortekaartje: foto of illustratie?', description: 'Stijl-peiling' },
    { title: 'Pasgeboren cadeau: praktisch of sentimenteel?', description: 'Cadeau-voorkeur peilen' },
    { title: 'Eerste echo of 3D scan: welke is intenser?', description: 'Emotionele vergelijking' },
    { title: 'Bevallen in ziekenhuis of thuis?', description: 'Voorkeur peilen — gevoelig dus respectvol framen' },
  ],
  'Atelier': [
    { title: 'Een dag in het atelier', description: 'Reel waarin je laat zien hoe je dag eruitziet — van eerste klant tot laatste beeldje', bestType: 'reel' },
    { title: 'Werkplek tour', description: 'Foto&apos;s van de studio, scan-ruimte, wachtkamer', bestType: 'carousel' },
    { title: 'Handen aan het werk', description: 'Close-up van detailwerk op een beeldje', bestType: 'feed' },
    { title: 'Materialen-vlog', description: 'Welke spullen heb je nodig om beeldjes te maken' },
    { title: 'Voor de start van de dag', description: 'Ochtendritueel in de studio — koffie, planning, voorbereiden' },
    { title: 'Aan het einde van de dag', description: 'Opruimen, mooie geboorte-momenten van die dag' },
    { title: 'Mijn favoriete tool', description: 'Welke tool gebruik je het meest, waarom is hij onmisbaar' },
    { title: 'Inspiratiebord', description: 'Wat hangt er aan de muur, welke beeldjes inspireren je' },
    { title: 'Studio playlist', description: 'Welke muziek draai je tijdens het werken' },
    { title: 'Plant-collectie / sfeer', description: 'Sfeer in de studio, hoe maak je het cosy' },
  ],
  'Bedels': [
    { title: 'Nieuwe bedel reveal', description: 'Onthul een nieuwe bedel uit de collectie', bestType: 'feed' },
    { title: 'Bedel matching met beeldje', description: 'Welke bedel past bij welk type beeldje', bestType: 'carousel' },
    { title: 'Bedel als aanvulling op cadeau', description: 'Cadeau-set: beeldje + bedel + kaart', bestType: 'feed' },
    { title: 'Persoonlijke bedel-betekenissen', description: 'Wat betekent elke bedel symbolisch (hartje, vogeltje, ster, etc.)', bestType: 'carousel' },
    { title: 'Bedel maakproces', description: 'Hoe wordt een bedel gemaakt', bestType: 'reel' },
    { title: 'Bedel-collage', description: 'Alle bedels mooi gerangschikt in een flat-lay', bestType: 'feed' },
    { title: 'Bedel als babymoeder cadeau', description: 'Cadeau-idee voor moeder na bevalling — ketting met bedel met initialen baby' },
    { title: 'Bedel + ketting / armband', description: 'Hoe draag je de bedels — combinatie met ketting/armband' },
    { title: 'Klanten dragen hun bedel', description: 'Klantfoto&apos;s waarop je de bedels in het echt ziet' },
    { title: 'Bedel-graveer-mogelijkheden', description: 'Wat kun je laten graveren (naam, datum, weight)' },
  ],
  'Review': [
    { title: 'Klantreview screenshot', description: 'Mooie review uit Google/socials, in branded sjabloon', bestType: 'feed' },
    { title: 'Video-review klant', description: 'Korte video waarin een klant haar ervaring deelt', bestType: 'reel' },
    { title: 'Voor & na: blije gezichten', description: 'Klant tijdens scan + reactie als ze beeldje ophaalt' },
    { title: 'Quote-card review', description: 'Een mooie zin uit een review groot uitgelicht' },
    { title: 'Cijfer-stats', description: 'Aantal reviews, gemiddelde score, X aantal beeldjes gemaakt' },
    { title: 'Reactie van papa', description: 'Vader-perspectief op de scan-ervaring' },
    { title: 'Reactie van oma/opa', description: 'Grootouders die het beeldje krijgen — emotionele content' },
    { title: 'Voor twijfelaars', description: 'Review van iemand die eerst twijfelde maar achteraf super blij was' },
    { title: 'Review na DIY kit', description: 'Iemand die thuis een DIY scan deed en hoe dat ging' },
    { title: 'Review-week', description: 'Een hele week elke dag een andere klantreview delen' },
  ],
  'Algemeen': [
    { title: 'Even voorstellen', description: 'Wie ben jij, hoe ben je begonnen met Gravida' },
    { title: 'Onze missie', description: 'Wat wil Gravida betekenen voor aanstaande ouders' },
    { title: 'Team in beeld', description: 'Wie werkt er bij Gravida — Marit, Laila, etc.' },
    { title: 'Waarom de naam Gravida', description: 'Verhaal achter de naam' },
    { title: 'Tip: zwangerschapsweek-overzicht', description: 'Wat gebeurt er per week in de zwangerschap' },
    { title: 'Tip: cadeau-ideeën voor zwangere vriendin', description: 'Wat geef je iemand die zwanger is' },
    { title: 'Locaties / regio&apos;s', description: 'Waar komen we — alle regio&apos;s die we bedienen' },
    { title: 'Aankondiging nieuwe regio', description: 'Wanneer je in nieuwe regio aan-huis komt' },
    { title: 'Werkdag: korte vs lange dag', description: 'Hoe ziet de aan-huis werkdag eruit' },
    { title: 'Volg ons op socials', description: 'Reminder om te volgen, taggen, sharen' },
  ],
  'Promotie': [
    { title: 'Cadeaubon-actie', description: 'Verleng of upgrade een cadeaubon — ideaal voor feestdagen', bestType: 'feed' },
    { title: 'Vroegboek-korting', description: 'Boek nu, betaal later met X% korting' },
    { title: 'DIY kit aanbieding', description: 'Borg verrekenen met beeldje-aankoop' },
    { title: 'Last-minute slot', description: 'Story met &quot;nog 1 plek vrij deze week&quot;' },
    { title: 'Bundel: scan + beeldje', description: 'Pakketprijs voor scan + beeldje samen' },
    { title: 'Verjaardags-actie', description: 'Eigen verjaardag van Gravida vieren met korting' },
    { title: 'Zwangerschapsweek-deal', description: 'Korting voor wie scan boekt in een specifieke week' },
    { title: 'Friends & family campagne', description: 'Tag iemand die zwanger is en win een scan' },
    { title: 'Black Friday / Cyber Monday', description: 'Tijdelijke kortingsperiode' },
    { title: 'Vaderdag/Moederdag-cadeau-deal', description: 'Speciaal cadeau-pakket voor de feestdag', bestType: 'carousel' },
  ],
}
