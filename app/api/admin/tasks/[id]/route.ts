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

    const summary         = body.summary         !== undefined ? body.summary         : e.summary
    const description     = body.description     !== undefined ? body.description     : e.description
    const type            = body.type            !== undefined ? body.type            : e.type
    const priority        = body.priority        !== undefined ? body.priority        : e.priority
    const status          = body.status          !== undefined ? body.status          : e.status
    const assigned_by     = body.assigned_by     !== undefined ? body.assigned_by     : e.assigned_by
    const assigned_to     = body.assigned_to     !== undefined ? body.assigned_to     : e.assigned_to
    const due_date        = body.due_date        !== undefined ? body.due_date        : e.due_date
    const screenshot_urls = body.screenshot_urls !== undefined ? body.screenshot_urls : e.screenshot_urls

    const screenshots = Array.isArray(screenshot_urls) ? screenshot_urls : []

    const result = await sql`
      UPDATE tasks SET
        summary = ${summary},
        description = ${description},
        type = ${type},
        priority = ${priority},
        status = ${status},
        assigned_by = ${assigned_by},
        assigned_to = ${assigned_to},
        due_date = ${due_date},
        screenshot_urls = ${JSON.stringify(screenshots)}::jsonb,
        updated_at = NOW()
      WHERE id = ${id}
      RETURNING id, summary, description, type, priority, status, assigned_by, assigned_to,
                due_date::text, screenshot_urls, created_at::text, updated_at::text
    `
    const task = result.rows[0]

    // Inbox: notify als assigned_to gewijzigd is naar iemand anders dan voorheen
    const wasAssignedTo = e.assigned_to ?? null
    if (task.assigned_to && task.assigned_to !== wasAssignedTo && task.assigned_to !== task.assigned_by) {
      const summaryShort = String(task.summary).slice(0, 200)
      await sql`
        INSERT INTO inbox_items (recipient, sender, type, title, body, link, related_task_id)
        VALUES (
          ${task.assigned_to},
          ${task.assigned_by},
          'task_assigned',
          ${'📋 Taak toegewezen: ' + summaryShort},
          ${task.description ?? null},
          ${'/admin/task-tracker'},
          ${task.id}
        )
      `.catch(err => console.error('Inbox notify error (task update):', err))
    }

    return NextResponse.json({ task })
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
