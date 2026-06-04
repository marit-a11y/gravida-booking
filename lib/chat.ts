/**
 * Chat session helpers voor de live browser ↔ WhatsApp chat widget.
 *
 * Elke bezoeker krijgt een UUID-sessie. Berichten worden opgeslagen in de
 * `chat_sessions` tabel als JSONB-array. Laila's antwoorden komen via de
 * WhatsApp-webhook binnen en worden hier ook opgeslagen.
 *
 * Schema wordt on-the-fly aangemaakt (CREATE TABLE IF NOT EXISTS).
 */

import { sql } from '@vercel/postgres'
import { randomUUID } from 'crypto'

export interface ChatMessage {
  role: 'visitor' | 'laila'
  text: string
  ts: string // ISO 8601
}

export interface ChatSession {
  id: string
  created_at: string
  last_activity: string
  laila_notified: boolean
  whatsapp_window_until: string | null
  messages: ChatMessage[]
}

export async function ensureChatTable(): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS chat_sessions (
      id                    TEXT PRIMARY KEY,
      created_at            TIMESTAMPTZ DEFAULT NOW(),
      last_activity         TIMESTAMPTZ DEFAULT NOW(),
      laila_notified        BOOLEAN     DEFAULT FALSE,
      whatsapp_window_until TIMESTAMPTZ,
      messages              JSONB       DEFAULT '[]'::jsonb
    )
  `
}

export async function createChatSession(): Promise<string> {
  await ensureChatTable()
  const id = randomUUID()
  await sql`INSERT INTO chat_sessions (id) VALUES (${id})`
  return id
}

type SessionRow = {
  id: string
  created_at: string
  last_activity: string
  laila_notified: boolean
  whatsapp_window_until: string | null
  messages: ChatMessage[]
}

export async function getChatSession(id: string): Promise<ChatSession | null> {
  await ensureChatTable()
  const result = await sql<SessionRow>`
    SELECT id,
           created_at::text,
           last_activity::text,
           laila_notified,
           whatsapp_window_until::text,
           messages
    FROM chat_sessions
    WHERE id = ${id}
  `
  return result.rows[0] ?? null
}

export async function addVisitorMessage(
  sessionId: string,
  text: string,
): Promise<ChatSession | null> {
  const msg: ChatMessage = { role: 'visitor', text, ts: new Date().toISOString() }
  const result = await sql<SessionRow>`
    UPDATE chat_sessions
    SET messages      = messages || ${JSON.stringify([msg])}::jsonb,
        last_activity = NOW()
    WHERE id = ${sessionId}
    RETURNING id,
              created_at::text,
              last_activity::text,
              laila_notified,
              whatsapp_window_until::text,
              messages
  `
  return result.rows[0] ?? null
}

export async function markLailaNotified(sessionId: string): Promise<void> {
  await sql`
    UPDATE chat_sessions SET laila_notified = TRUE WHERE id = ${sessionId}
  `
}

export async function addLailaReply(sessionId: string, text: string): Promise<void> {
  const msg: ChatMessage = { role: 'laila', text, ts: new Date().toISOString() }
  await sql`
    UPDATE chat_sessions
    SET messages              = messages || ${JSON.stringify([msg])}::jsonb,
        last_activity         = NOW(),
        whatsapp_window_until = NOW() + INTERVAL '24 hours'
    WHERE id = ${sessionId}
  `
}

/**
 * Zoek de meest recentelijk actieve sessie (max 4 uur oud, heeft berichten).
 * Hiermee koppelen we een inkomend WhatsApp-antwoord van Laila aan de
 * juiste bezoekerssessie.
 */
export async function getLatestActiveSession(): Promise<ChatSession | null> {
  await ensureChatTable()
  const result = await sql<SessionRow>`
    SELECT id,
           created_at::text,
           last_activity::text,
           laila_notified,
           whatsapp_window_until::text,
           messages
    FROM chat_sessions
    WHERE last_activity > NOW() - INTERVAL '4 hours'
      AND jsonb_array_length(messages) > 0
    ORDER BY last_activity DESC
    LIMIT 1
  `
  return result.rows[0] ?? null
}

/** Geeft true als de 24-uurs WhatsApp-conversatievenster nog open is. */
export function isWindowOpen(session: ChatSession): boolean {
  if (!session.whatsapp_window_until) return false
  return new Date(session.whatsapp_window_until) > new Date()
}
