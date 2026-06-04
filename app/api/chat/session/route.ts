import { NextResponse } from 'next/server'
import { createChatSession } from '@/lib/chat'

export const dynamic = 'force-dynamic'

function cors() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: cors() })
}

export async function POST() {
  try {
    const id = await createChatSession()
    return NextResponse.json({ session_id: id }, { headers: cors() })
  } catch (err) {
    console.error('chat/session error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500, headers: cors() })
  }
}
