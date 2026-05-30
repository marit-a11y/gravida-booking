import { sql } from '@vercel/postgres'

/**
 * Importeer onbekende media URLs (afkomstig uit social posts, blogs, etc.)
 * automatisch in de mediabibliotheek. Idempotent: bestaande URLs worden
 * overgeslagen. Plaatst nieuwe items in een vaste folder (default: "Social planner").
 */

const VIDEO_RE = /\.(mp4|mov|webm)(\?|$)/i

async function ensureFolder(name: string, category: string): Promise<number> {
  const exist = await sql`SELECT id FROM media_folders WHERE name = ${name} LIMIT 1`
  if (exist.rows.length > 0) return exist.rows[0].id as number
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
  const ins = await sql`
    INSERT INTO media_folders (name, slug, category, description, sort_order)
    VALUES (${name}, ${slug}, ${category}, ${'Auto-toegevoegd vanuit ' + name.toLowerCase()}, 100)
    RETURNING id
  `
  return ins.rows[0].id as number
}

export interface AutoImportOptions {
  /** Folder naam waar nieuwe items in komen. Default: "Social planner". */
  folderName?: string
  /** Categorie van die folder. Default: "Sfeer". */
  category?: string
}

export async function autoImportMediaUrls(urls: string[], opts: AutoImportOptions = {}): Promise<{ added: number; skipped: number }> {
  const folderName = opts.folderName ?? 'Social planner'
  const category = opts.category ?? 'Sfeer'

  const cleaned = (urls ?? []).map(u => (u ?? '').trim()).filter(Boolean)
  if (cleaned.length === 0) return { added: 0, skipped: 0 }

  let folderId: number | null = null
  let added = 0
  let skipped = 0

  for (const url of cleaned) {
    try {
      // Bestaat deze URL al?
      const existing = await sql`SELECT id FROM media_items WHERE blob_url = ${url} LIMIT 1`
      if (existing.rows.length > 0) {
        skipped++
        continue
      }

      if (folderId === null) {
        folderId = await ensureFolder(folderName, category)
      }

      const type = VIDEO_RE.test(url) ? 'video' : 'image'
      const filename = url.split('/').pop()?.split('?')[0] ?? null

      const inserted = await sql`
        INSERT INTO media_items (folder_id, blob_url, type, filename)
        VALUES (${folderId}, ${url}, ${type}, ${filename})
        RETURNING id
      `
      const itemId = inserted.rows[0].id as number
      await sql`
        INSERT INTO media_item_folders (item_id, folder_id) VALUES (${itemId}, ${folderId})
        ON CONFLICT DO NOTHING
      `
      added++
    } catch (err) {
      console.error('autoImportMediaUrls error voor', url, err)
    }
  }
  return { added, skipped }
}
