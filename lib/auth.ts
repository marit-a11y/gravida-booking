import { SignJWT, jwtVerify } from 'jose'

const COOKIE_NAME = 'gravida_admin_token'
const TOKEN_EXPIRY = '8h'

export function getSecretKey(secret: string): Uint8Array {
  return new TextEncoder().encode(secret)
}

export async function verifyAdmin(password: string): Promise<boolean> {
  const adminPassword = process.env.ADMIN_PASSWORD
  if (!adminPassword) return false
  return password === adminPassword
}

export async function createToken(secret: string): Promise<string> {
  const key = getSecretKey(secret)
  return await new SignJWT({ role: 'admin' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(TOKEN_EXPIRY)
    .sign(key)
}

export async function verifyToken(
  token: string,
  secret: string
): Promise<boolean> {
  try {
    const key = getSecretKey(secret)
    await jwtVerify(token, key)
    return true
  } catch {
    return false
  }
}

export { COOKIE_NAME }
