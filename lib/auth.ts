import { SignJWT, jwtVerify } from 'jose'
import bcrypt from 'bcryptjs'
import { sql } from '@vercel/postgres'

const COOKIE_NAME = 'gravida_admin_token'
const TOKEN_EXPIRY = '8h'

export function getSecretKey(secret: string): Uint8Array {
  return new TextEncoder().encode(secret)
}

export interface DashboardUser {
  id: number
  name: string
  email: string
  is_admin: boolean
  allowed_pages: string[]
  is_active: boolean
}

export interface JwtPayload {
  user_id: number
  name: string
  email: string
  is_admin: boolean
  allowed_pages: string[]
}

/**
 * Probeer in te loggen met email + wachtwoord. Geeft user terug of null.
 *
 * Fallback: als er nog geen rijen in dashboard_users staan EN
 * ADMIN_PASSWORD env var matcht, accepteer dat als oude single-password
 * inlog (legacy). Zodra er minstens één user in de DB staat is dit uit.
 */
export async function verifyLogin(email: string, password: string): Promise<DashboardUser | null> {
  // Legacy fallback (alleen als users-tabel leeg)
  const count = await sql`SELECT COUNT(*)::int AS c FROM dashboard_users`
  if (count.rows[0].c === 0) {
    const adminPassword = process.env.ADMIN_PASSWORD
    if (adminPassword && password === adminPassword) {
      return {
        id: 0, name: 'Admin', email: 'admin@gravida.local',
        is_admin: true, allowed_pages: [], is_active: true,
      }
    }
    return null
  }

  const r = await sql`
    SELECT id, name, email, password_hash, is_admin, allowed_pages, is_active
    FROM dashboard_users
    WHERE LOWER(email) = LOWER(${email}) AND is_active = TRUE
    LIMIT 1
  `
  if (r.rows.length === 0) return null
  const row = r.rows[0]
  const ok = await bcrypt.compare(password, row.password_hash)
  if (!ok) return null
  // Markeer laatste login (niet-blokkerend)
  sql`UPDATE dashboard_users SET last_login = NOW() WHERE id = ${row.id}`.catch(() => {})
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    is_admin: row.is_admin,
    allowed_pages: Array.isArray(row.allowed_pages) ? row.allowed_pages : [],
    is_active: row.is_active,
  }
}

export async function createToken(secret: string, user: DashboardUser): Promise<string> {
  const key = getSecretKey(secret)
  const payload: JwtPayload = {
    user_id: user.id,
    name: user.name,
    email: user.email,
    is_admin: user.is_admin,
    allowed_pages: user.allowed_pages,
  }
  return await new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(TOKEN_EXPIRY)
    .sign(key)
}

/** Verifieer JWT en geef payload terug, of null als ongeldig/verlopen. */
export async function verifyToken(token: string, secret: string): Promise<JwtPayload | null> {
  try {
    const key = getSecretKey(secret)
    const { payload } = await jwtVerify(token, key)
    return payload as unknown as JwtPayload
  } catch {
    return null
  }
}

/** Backwards-compat boolean variant voor bestaande middleware code. */
export async function verifyTokenValid(token: string, secret: string): Promise<boolean> {
  const p = await verifyToken(token, secret)
  return p !== null
}

/** Backwards-compat verifyAdmin (gebruikt nieuwe flow). */
export async function verifyAdmin(password: string): Promise<boolean> {
  const u = await verifyLogin('admin@gravida.local', password)
  return u !== null && u.is_admin
}

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 10)
}

export { COOKIE_NAME }
