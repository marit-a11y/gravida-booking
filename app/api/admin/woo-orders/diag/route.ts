import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

/**
 * Diagnose endpoint voor de WooCommerce verbinding. Toont zonder secrets
 * of de env vars geladen zijn en wat de webshop terugstuurt op een
 * eenvoudige GET. Helpt onderscheid maken tussen ontbrekende keys vs WAF.
 */
export async function GET() {
  const URL_ENV = process.env.WOOCOMMERCE_URL ?? ''
  const KEY_ENV = process.env.WOOCOMMERCE_KEY ?? ''
  const SECRET_ENV = process.env.WOOCOMMERCE_SECRET ?? ''

  const env = {
    WOOCOMMERCE_URL: URL_ENV ? URL_ENV : '(leeg)',
    WOOCOMMERCE_KEY: KEY_ENV ? `${KEY_ENV.slice(0, 4)}...${KEY_ENV.slice(-3)} (len ${KEY_ENV.length})` : '(leeg)',
    WOOCOMMERCE_SECRET: SECRET_ENV ? `${SECRET_ENV.slice(0, 4)}...${SECRET_ENV.slice(-3)} (len ${SECRET_ENV.length})` : '(leeg)',
  }

  if (!URL_ENV || !KEY_ENV || !SECRET_ENV) {
    return NextResponse.json({ env, status: 'env_missing' })
  }

  const base = URL_ENV.replace(/\/$/, '')
  const tests: Record<string, unknown> = {}

  // Test 1: Basic Auth header
  try {
    const r = await fetch(`${base}/wp-json/wc/v3/orders?per_page=1`, {
      headers: {
        Authorization: 'Basic ' + Buffer.from(`${KEY_ENV}:${SECRET_ENV}`).toString('base64'),
        'User-Agent': 'Gravida-Dashboard/1.0',
        Accept: 'application/json',
      },
      cache: 'no-store',
    })
    const text = await r.text()
    tests.basic_auth = { status: r.status, ok: r.ok, body_preview: text.slice(0, 200) }
  } catch (e) { tests.basic_auth = { error: String(e) } }

  // Test 2: query string auth
  try {
    const q = `consumer_key=${encodeURIComponent(KEY_ENV)}&consumer_secret=${encodeURIComponent(SECRET_ENV)}`
    const r = await fetch(`${base}/wp-json/wc/v3/orders?per_page=1&${q}`, {
      headers: { 'User-Agent': 'Gravida-Dashboard/1.0', Accept: 'application/json' },
      cache: 'no-store',
    })
    const text = await r.text()
    tests.query_string_auth = { status: r.status, ok: r.ok, body_preview: text.slice(0, 200) }
  } catch (e) { tests.query_string_auth = { error: String(e) } }

  // Test 3: minimal WP REST (root) zonder auth — checkt of de site überhaupt bereikbaar is
  try {
    const r = await fetch(`${base}/wp-json/`, {
      headers: { 'User-Agent': 'Gravida-Dashboard/1.0' },
      cache: 'no-store',
    })
    tests.wp_root_reachable = { status: r.status, ok: r.ok }
  } catch (e) { tests.wp_root_reachable = { error: String(e) } }

  return NextResponse.json({ env, tests })
}
