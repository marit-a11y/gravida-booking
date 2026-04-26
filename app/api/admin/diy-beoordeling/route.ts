import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyToken, COOKIE_NAME } from '@/lib/auth'
import { sendDiyReviewEmail, DiyBijzonderheid } from '@/lib/email'

export const dynamic = 'force-dynamic'

async function checkAuth(): Promise<boolean> {
  const cookieStore = cookies()
  const token = cookieStore.get(COOKIE_NAME)?.value
  if (!token) return false
  const secret = process.env.JWT_SECRET ?? process.env.ADMIN_PASSWORD ?? ''
  return verifyToken(token, secret)
}

export async function POST(request: NextRequest) {
  if (!(await checkAuth())) {
    return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const {
      klant_naam,
      klant_email,
      bijzonderheden,
      anders_tekst,
      bruikbaar,
      extra_wensen,
      images, // Array<{ filename: string; base64: string }>
    } = body

    if (!klant_naam?.trim() || !klant_email?.trim()) {
      return NextResponse.json({ error: 'Naam en e-mailadres zijn verplicht' }, { status: 400 })
    }

    const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRe.test(klant_email)) {
      return NextResponse.json({ error: 'Ongeldig e-mailadres' }, { status: 400 })
    }

    if (!bruikbaar) {
      return NextResponse.json({ error: 'Scan is niet bruikbaar — stuur geen automatische mail' }, { status: 400 })
    }

    // Convert base64 images to Buffers
    const imageAttachments = (images ?? []).map((img: { filename: string; base64: string }) => ({
      filename: img.filename,
      content: Buffer.from(img.base64, 'base64'),
    }))

    await sendDiyReviewEmail({
      klant_naam: klant_naam.trim(),
      klant_email: klant_email.trim().toLowerCase(),
      bijzonderheden: (bijzonderheden ?? []) as DiyBijzonderheid[],
      anders_tekst: anders_tekst?.trim() || undefined,
      bruikbaar,
      extra_wensen: extra_wensen?.trim() || undefined,
      images: imageAttachments,
    })

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('DIY review email error:', err)
    const msg = err instanceof Error ? err.message : 'Onbekende fout'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
