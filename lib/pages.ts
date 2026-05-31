/**
 * Centrale pagina-catalogus voor het admin dashboard.
 * - `slug` matcht het pad onder /admin/ (bv. 'social' = /admin/social).
 *   'dashboard' is het hoofd /admin pad.
 * - `label` is wat we tonen in de sidebar én in de gebruikers-machtigingen UI.
 * - `group` is om in de machtigingen-UI items netjes te clusteren.
 *
 * Toevoegen van een nieuwe pagina: voeg hier toe + voeg aan sidebar in
 * app/admin/layout.tsx + check via canAccess() in de pagina zelf.
 */

export interface PageDef {
  slug: string
  label: string
  group: 'Overzicht' | 'Boekingen' | 'DIY' | 'Verkoop' | 'Content' | 'Configuratie'
}

export const PAGES: PageDef[] = [
  // Overzicht
  { slug: 'inbox',              label: 'Inbox',             group: 'Overzicht' },
  { slug: 'dashboard',          label: 'Dashboard',         group: 'Overzicht' },

  // Boekingen
  { slug: 'beschikbaarheid',    label: 'Beschikbaarheid',   group: 'Boekingen' },
  { slug: 'boekingen',          label: 'Boekingen',         group: 'Boekingen' },
  { slug: 'medewerkers',        label: 'Medewerkers',       group: 'Boekingen' },
  { slug: 'afwezigheid',        label: 'Afwezigheid',       group: 'Boekingen' },

  // DIY
  { slug: 'diy-scanners',       label: 'DIY Scanners',      group: 'DIY' },
  { slug: 'diy-beoordeling',    label: 'Scan beoordeling',  group: 'DIY' },
  { slug: 'scan-archief',       label: 'Scan archief',      group: 'DIY' },

  // Verkoop
  { slug: 'cadeaubonnen',       label: 'Cadeaubonnen',      group: 'Verkoop' },
  { slug: 'bestellingen',       label: 'Webshop orders',    group: 'Verkoop' },

  // Content
  { slug: 'social',             label: 'Social planner',    group: 'Content' },
  { slug: 'media-library',      label: 'Mediabibliotheek',  group: 'Content' },
  { slug: 'galleries',          label: 'Galerijen',         group: 'Content' },
  { slug: 'blogs',              label: 'Blogs',             group: 'Content' },
  { slug: 'gedeelde-beelden',   label: 'Gedeelde beelden',  group: 'Content' },

  // Configuratie
  { slug: 'whatsapp-test',      label: 'WhatsApp test',     group: 'Configuratie' },
  { slug: 'task-tracker',       label: 'Task tracker',      group: 'Configuratie' },
  { slug: 'gebruikers',         label: 'Gebruikers',        group: 'Configuratie' },
]

export const PAGE_SLUGS = PAGES.map(p => p.slug)

/** Check of een gebruiker een specifieke pagina mag bezoeken. */
export function canAccessPage(user: { is_admin: boolean; allowed_pages: string[] | null | undefined }, slug: string): boolean {
  if (user.is_admin) return true
  if (!user.allowed_pages) return false
  return user.allowed_pages.includes(slug)
}
