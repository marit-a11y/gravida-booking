import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@vercel/postgres'

export const dynamic = 'force-dynamic'

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const id = parseInt(params.id, 10)
    if (isNaN(id)) return NextResponse.json({ error: 'Ongeldig ID' }, { status: 400 })

    const body = await request.json()

    // Fetch existing
    const existing = await sql`SELECT * FROM tasks WHERE id = ${id}`
    if (existing.rows.length === 0) {
      return NextResponse.json({ error: 'Taak niet gevonden' }, { status: 404 })
    }
    const e = existing.rows[0]

    const summary     = body.summary     !== undefined ? body.summary     : e.summary
    const description = body.description !== undefined ? body.description : e.description
    const type        = body.type        !== undefined ? body.type        : e.type
    const priority    = body.priority    !== undefined ? body.priority    : e.priority
    const status      = body.status      !== undefined ? body.status      : e.status
    const assigned_by = body.assigned_by !== undefined ? body.assigned_by : e.assigned_by
    const due_date    = body.due_date    !== undefined ? body.due_date    : e.due_date

    const result = await sql`
      UPDATE tasks SET
        summary = ${summary},
        description = ${description},
        type = ${type},
        priority = ${priority},
        status = ${status},
        assigned_by = ${assigned_by},
        due_date = ${due_date},
        updated_at = NOW()
      WHERE id = ${id}
      RETURNING id, summary, description, type, priority, status, assigned_by,
                due_date::text, created_at::text, updated_at::text
    `
    return NextResponse.json({ task: result.rows[0] })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: 'Updaten mislukt: ' + msg }, { status: 500 })
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const id = parseInt(params.id, 10)
    if (isNaN(id)) return NextResponse.json({ error: 'Ongeldig ID' }, { status: 400 })
    await sql`DELETE FROM tasks WHERE id = ${id}`
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
