import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@vercel/postgres'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const result = await sql`
      SELECT id, summary, description, type, priority, status, assigned_by,
             due_date::text, created_at::text, updated_at::text
      FROM tasks
      ORDER BY
        CASE status
          WHEN 'open' THEN 1
          WHEN 'in_progress' THEN 2
          WHEN 'ready_for_testing' THEN 3
          WHEN 'completed' THEN 4
          WHEN 'deferred' THEN 5
          ELSE 6
        END,
        CASE priority
          WHEN 'critical' THEN 1
          WHEN 'high' THEN 2
          WHEN 'medium' THEN 3
          WHEN 'low' THEN 4
          ELSE 5
        END,
        created_at DESC
    `
    return NextResponse.json({ tasks: result.rows })
  } catch (err) {
    console.error('GET /api/admin/tasks error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { summary, description, type, priority, status, assigned_by, due_date } = body

    if (!summary?.trim()) {
      return NextResponse.json({ error: 'Samenvatting is verplicht' }, { status: 400 })
    }

    const result = await sql`
      INSERT INTO tasks (summary, description, type, priority, status, assigned_by, due_date)
      VALUES (
        ${summary.trim()},
        ${description?.trim() || null},
        ${type || 'bug'},
        ${priority || 'medium'},
        ${status || 'open'},
        ${assigned_by?.trim() || null},
        ${due_date || null}
      )
      RETURNING id, summary, description, type, priority, status, assigned_by,
                due_date::text, created_at::text, updated_at::text
    `
    return NextResponse.json({ task: result.rows[0] }, { status: 201 })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: 'Aanmaken mislukt: ' + msg }, { status: 500 })
  }
}
