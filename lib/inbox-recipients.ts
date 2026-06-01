import { sql } from '@vercel/postgres'

/**
 * Helper voor systeem-notificaties: bepaalt welke gebruikers een inbox-item
 * moeten krijgen voor een bepaald event. Gebaseerd op page-permissions:
 * iedereen die op een gegeven pagina mag, krijgt notificaties die op die
 * pagina betrekking hebben. Admins krijgen altijd alles.
 *
 * Voorbeeld:
 *   await getRecipientsForPage('diy-beoordeling')
 *     → ['Marit', 'Laila', 'Vincent']  (als Vincent diy-beoordeling mag zien)
 */
export async function getRecipientsForPage(pageSlug: string): Promise<string[]> {
  try {
    const r = await sql<{ name: string }>`
      SELECT name FROM dashboard_users
      WHERE is_active = TRUE
        AND (is_admin = TRUE OR allowed_pages @> ${JSON.stringify([pageSlug])}::jsonb)
      ORDER BY is_admin DESC, name ASC
    `
    return r.rows.map(row => row.name)
  } catch (err) {
    console.error('getRecipientsForPage error:', err)
    // Veilige fallback: minimaal admin Marit
    return ['Marit']
  }
}

/**
 * Alle actieve gebruikersnamen (gebruikt voor breed verspreide notificaties).
 */
export async function getAllActiveUsers(): Promise<string[]> {
  try {
    const r = await sql<{ name: string }>`
      SELECT name FROM dashboard_users
      WHERE is_active = TRUE
      ORDER BY is_admin DESC, name ASC
    `
    return r.rows.map(row => row.name)
  } catch (err) {
    console.error('getAllActiveUsers error:', err)
    return ['Marit']
  }
}
