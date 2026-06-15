// GET /api/admin/preview-config
//
// Diagnostic endpoint. Returns the active preview provider and a boolean
// per key (set / not set). Never returns the actual key values.
// Behind the admin JWT cookie so random visitors cannot use it to probe.

import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyTokenValid as verifyToken, COOKIE_NAME } from '@/lib/auth'
import { activeProvider } from '@/lib/preview-provider'

export const dynamic = 'force-dynamic'

async function checkAuth(): Promise<boolean> {
  const cookieStore = cookies()
  const token = cookieStore.get(COOKIE_NAME)?.value
  if (!token) return false
  const secret = process.env.JWT_SECRET ?? process.env.ADMIN_PASSWORD ?? ''
  return verifyToken(token, secret)
}

export async function GET(_request: NextRequest) {
  if (!(await checkAuth())) {
    return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
  }
  const provider = activeProvider()
  const rodinKey      = (process.env.RODIN_API_KEY      ?? '').trim()
  const replicateKey  = (process.env.REPLICATE_API_TOKEN ?? '').trim()
  return NextResponse.json({
    active_provider: provider,
    raw_PREVIEW_PROVIDER_value: (process.env.PREVIEW_PROVIDER ?? '<unset>').toString(),
    rodin_api_key_set:           rodinKey.length > 0,
    rodin_api_key_chars:         rodinKey.length,
    rodin_api_key_prefix:        rodinKey.slice(0, 7),    // first 7 chars only, safe to expose
    replicate_api_token_set:     replicateKey.length > 0,
    replicate_api_token_chars:   replicateKey.length,
  })
}
