import { NextResponse } from 'next/server'
import { sql } from '@vercel/postgres'

export const dynamic = 'force-dynamic'

// Geeft een lijst van actieve gebruikersnamen voor dropdowns (assignees etc).
// Geen admin-only — elke ingelogde gebruiker mag dit zien (middleware zorgt
// al dat alleen ingelogd door komt).
export async function GET() {
  const r = await sql`
    SELECT name FROM dashboard_users
    WHERE is_active = TRUE
    ORDER BY is_admin DESC, name ASC
  `
  return NextResponse.json({ names: r.rows.map(row => row.name as string) })
}
