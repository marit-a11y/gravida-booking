# Handover — gravida-booking

Paste this as a kickoff message in a fresh Claude Code session inside the
**gravida-booking** repo (or drop it as `docs/HANDOVER.md`). It's everything
the next Claude needs to know about how this project relates to the rest of
the stack, what it owns, and what's still missing.

---

## What this repo is

- Repo: `marit-a11y/gravida-booking` on GitHub
- Deployed at: **https://gravida-booking.vercel.app**
- The **canonical admin dashboard** for Marit's pregnancy-sculpture business
- Stack: Next.js 16.2.4, React 19, Tailwind v4, Vercel Postgres (Neon), Mollie,
  Resend, JWT cookie auth via `jose`

## What changed recently (June 2026)

The sister site **studiogravida.com** (separate repo: `marit-a11y/studio-gravida`)
used to have its own embedded admin at `/admin`. As of the most recent commit
on Studio Gravida (`1800bd5 — Drop embedded admin — redirect /admin/* to
gravida-booking`), every `/admin` and `/api/admin` request on
`studiogravida.com` returns a **308 permanent redirect** to the matching path
on `gravida-booking.vercel.app`.

That means:

- **gravida-booking is now the single source of truth** for booking management.
- All `diy_rentals` rows created on studiogravida.com (DIY scan kit rentals,
  English-speaking EU customers) land in the same Postgres database this repo
  reads from.
- All `bookings` rows created on gravida.nl (studio scans, Dutch customers)
  also live here.
- Marit + Laila use this admin to manage **both** flows.

## Shared infrastructure

| What | Shared with |
|---|---|
| Postgres (Neon) | studiogravida.com + this repo |
| Mollie account / profile | both |
| Resend account | both (different from/to addresses per brand) |
| `STAFF_EMAIL` for new-booking notifications | both |

What is NOT shared:

| What | Why |
|---|---|
| `JWT_SECRET` | Each project has its own; admin sessions are isolated |
| `NEXT_PUBLIC_SITE_URL` | Differs per deployment |
| Email FROM addresses | Dutch → `info@gravida.nl`, English → `hello@studiogravida.com` |

## Database schema (the important tables)

- **`availability`** — date + region + time-slot list. Studio scan kalender.
- **`bookings`** — studio scans (FK → availability). Dutch flow.
- **`diy_rentals`** — DIY scan kit week-rentals. English flow. Week-based,
  not slot-based.
- **`staff`** — admin users, password hashes, JWT auth subjects.
- **`absence`** — staff unavailability windows.

Status enums on `diy_rentals.status`:
`wacht_op_betaling → gereserveerd → verzonden → retour → scans_uitgezocht`
plus `geannuleerd` as a terminal state. Marit clicks these through manually.

Separate `deposit_status` field tracks the €200 deposit lifecycle:
not-yet-handled / refunded / converted-to-giftcard / kept.

## Auth model

- Email + password login at `/admin/login`
- `POST /api/admin/login` verifies against `staff` table, sets HttpOnly JWT
  cookie via `jose`
- `middleware.ts` verifies the cookie on every `/admin/*` and `/api/admin/*`
- `/api/admin/logout` clears the cookie
- Bcrypt for password hashes (or whatever the existing helper uses — check
  `lib/auth.ts`)

## Cron jobs (Vercel scheduled)

- **`/api/cron/reminders`** — daily, sends a 7-days-before reminder for
  upcoming studio bookings. **Does NOT touch DIY rentals.**
- **`/api/cron/auto-availability`** — auto-generates availability slots for
  the studio scan calendar.

Both require `Authorization: Bearer ${CRON_SECRET}` to fire.

## Known gaps / things that are missing

These are real holes in the workflow that Marit may ask you to fill:

1. **No reminder cron for DIY rentals.** A customer who books 6 weeks ahead
   gets one confirmation email at booking and then nothing until the kit
   ships. Worth adding a "we ship your kit in 3 days" reminder cron.

2. **No automated emails on status transitions.** When admin marks a rental
   as `verzonden`, no email goes out. Same for `retour` and
   `scans_uitgezocht`. Would be useful: "your kit is on its way", "we
   received your scan, preview within 5 days".

3. **No automated Mollie refund.** When admin marks `deposit_status = refunded`,
   the Mollie API is not called. Marit has to refund manually from the Mollie
   dashboard. Could be wired to call `mollieClient.payments_refunds.create`.

4. **No invoice PDF generation.** Mollie confirms payment but there's no
   PDF receipt sent. For €200 B2C this is acceptable; if requested, build it.

5. **No "deposit converted to gift card" flow.** When customer opts to wait,
   admin marks `deposit_status = giftcard` but there's no actual gift card
   created in any system. Currently informal.

6. **DIY rental customer emails are English-only.** `hello@studiogravida.com`
   sender, English copy. Studio scan emails are Dutch from `info@gravida.nl`.
   Branching is in `lib/email.ts` — check `sendDiyRentalEmails` vs
   `sendBookingEmails`.

7. **No unified inbox / alert dashboard.** New bookings show as rows; no
   notification center that surfaces "this DIY rental is overdue for
   shipping" or "this scan slot is at capacity".

## Important env vars

Set in Vercel project settings for **gravida-booking**:

```
POSTGRES_URL              # Neon, must match studio-gravida exactly
MOLLIE_API_KEY            # live key
RESEND_API_KEY            # transactional emails
STAFF_EMAIL               # comma-separated if multiple
JWT_SECRET                # auth tokens — this project's own
CRON_SECRET               # for Vercel cron auth header
NEXT_PUBLIC_SITE_URL      # https://gravida-booking.vercel.app
```

## Important files

- `app/admin/*` — Dutch admin UI (boekingen, beschikbaarheid, diy-scanners,
  medewerkers, afwezigheid)
- `app/api/admin/*` — admin-only mutations
- `app/api/diy-rentals/route.ts` — public DIY booking creation (called by
  studiogravida.com)
- `app/api/diy-rentals/webhook/route.ts` — Mollie webhook for DIY payments
- `app/api/bookings/*` — public studio booking endpoints (called by
  gravida.nl)
- `app/api/availability/*` — public availability lookup
- `app/api/cron/*` — scheduled jobs
- `lib/db.ts` — Postgres helpers, ALL table access goes through here
- `lib/auth.ts` — JWT verification + cookie helpers
- `lib/email.ts` — Resend templates, dual branding (Dutch + English)
- `lib/mollie.ts` — Mollie client + payment helpers

## Sibling projects (for context, not for editing here)

| Repo | Purpose |
|---|---|
| `marit-a11y/studio-gravida` | studiogravida.com — EU-wide DIY scan kit shop (English) |
| `marit-a11y/gravida-booking` | This repo — admin dashboard for everything |
| `marit-a11y/studio-template` | Template product sold to other studios (no booking impact here yet) |
| `marit-a11y/girlswithprinters` | Sales site + config generator for studio-template (no booking impact) |

## How to verify the studio-gravida ↔ gravida-booking link still works

1. Open studiogravida.com/diy-scan in an incognito window
2. Pick any available week, complete the form, pay €200 via Mollie's
   test mode
3. Within 10 seconds the new rental should appear in
   gravida-booking.vercel.app/admin/diy-scanners
4. If it doesn't, check `POSTGRES_URL` matches between the two Vercel
   projects. They MUST be identical strings.

## Useful project context (from the parent project's CLAUDE.md)

> This is **not** the Next.js you may know from training data. APIs,
> conventions, and file structure differ from older versions. Read the
> relevant guide in `node_modules/next/dist/docs/` before writing code.
> Dynamic route params is now `Promise<{...}>`; metadata is async; etc.

The user is Marit, communicates in Dutch, owner of Studio Gravida /
Girls with Printers B.V., less technical, builds collaboratively with
Claude. Design direction is **Editorial Luxe** (black/cream, Newsreader
italic, asymmetric layout).

---

## Most likely next requests

In rough order of how Marit's brain works on this project:

1. Build automated emails for DIY status transitions (verzonden, retour)
2. Add a 3-days-before reminder cron for DIY rentals
3. Wire Mollie refund API into the deposit_status workflow
4. Add cross-project audit logs (who clicked what, when) — Laila + Marit
   are both admins
5. Hardening: rate-limit /api/diy-rentals POST to prevent abuse
