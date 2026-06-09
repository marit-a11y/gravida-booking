// Lightweight gate for the public scan-upload endpoints. The Gravida Scan app
// ships with a shared X-Scan-App-Token (in env). It is not a per-user secret,
// just a "you are the official app" check so random crawlers can't spam uploads.
//
// Real abuse protection lives one layer up (Vercel platform rate limits + the
// per-session quotas we enforce in the route handlers).

import { NextRequest } from 'next/server'

export const SCAN_TOKEN_HEADER = 'x-scan-app-token'

export function checkScanAppToken(request: NextRequest): boolean {
  const expected = (process.env.SCAN_APP_TOKEN ?? '').trim()
  // If no token is configured, we keep the endpoint open so local development
  // works without env setup. Production deploys MUST set SCAN_APP_TOKEN.
  if (!expected) return true
  const got = (request.headers.get(SCAN_TOKEN_HEADER) ?? '').trim()
  return got.length > 0 && got === expected
}

// Open CORS for the public scan endpoints so the static app on a different
// host (e.g. scan.gravida.nl, or the Hetzner-served PWA) can call them.
// The endpoints do their own auth via SCAN_APP_TOKEN.
export const SCAN_CORS_HEADERS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-Scan-App-Token',
  'Access-Control-Max-Age':       '86400',
}
