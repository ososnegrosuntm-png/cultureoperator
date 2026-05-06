import { NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'
// eslint-disable-next-line @typescript-eslint/no-require-imports
const mailchimp = require('@mailchimp/mailchimp_marketing')

const BATCH_SIZE = 500

type IncomingMember = {
  id: string
  full_name: string | null
  email: string | null
  phone: string | null
}

/** Safely convert any value to plain JSON-serializable form. */
function sanitize(val: unknown): unknown {
  try { return JSON.parse(JSON.stringify(val)) } catch { return String(val) }
}

function sanitizeBatchError(e: unknown) {
  if (!e || typeof e !== 'object') return String(e)
  const o = e as Record<string, unknown>
  return {
    email_address: o.email_address ?? null,
    error_code:    o.error_code    ?? null,
    error:         o.error         ?? null,
    field:         o.field         ?? null,
    field_message: o.field_message ?? null,
  }
}

export async function POST(req: Request) {
  try {
    return await handleSync(req)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[mailchimp/sync] unhandled error:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

async function handleSync(req: Request): Promise<NextResponse> {

  // ── 1. Auth ───────────────────────────────────────────────────────────────
  const userClient = createServerClient()
  const { data: { user } } = await userClient.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // ── 2. Parse members from request body ────────────────────────────────────
  let members: IncomingMember[]
  try {
    const body = await req.json()
    members = body.members
    if (!Array.isArray(members) || members.length === 0) throw new Error()
  } catch {
    return NextResponse.json({ error: 'Request body must include a non-empty members array' }, { status: 400 })
  }

  console.log(`[mailchimp/sync] received ${members.length} members from client`)

  // ── 3. Env var check ──────────────────────────────────────────────────────
  const apiKey     = process.env.MAILCHIMP_API_KEY
  const audienceId = process.env.MAILCHIMP_AUDIENCE_ID

  console.log('[mailchimp/sync] env check:', {
    MAILCHIMP_API_KEY:     apiKey     ? `set (${apiKey.slice(0, 8)}…)` : 'MISSING',
    MAILCHIMP_AUDIENCE_ID: audienceId ? `set (${audienceId})`          : 'MISSING',
  })

  const missing = [
    !apiKey     && 'MAILCHIMP_API_KEY',
    !audienceId && 'MAILCHIMP_AUDIENCE_ID',
  ].filter(Boolean)

  if (missing.length > 0) {
    return NextResponse.json({ error: `Missing env vars: ${missing.join(', ')}`, missing }, { status: 500 })
  }

  // ── 4. Configure Mailchimp ────────────────────────────────────────────────
  const server = apiKey!.split('-').pop() ?? 'us2'
  mailchimp.setConfig({ apiKey, server })
  console.log(`[mailchimp/sync] configured — server=${server} audience=${audienceId}`)

  // ── 5. Build member objects — skip rows without email ─────────────────────
  type MailchimpMember = {
    email_address: string
    status_if_new: 'subscribed'
    merge_fields: { FNAME: string; LNAME: string; EMAIL: string; PHONE: string }
  }

  const toSync: MailchimpMember[] = []
  let skippedNoEmail = 0

  for (const m of members) {
    const email = (m.email ?? '').trim().toLowerCase()
    if (!email) { skippedNoEmail++; continue }

    const parts = (m.full_name ?? '').trim().split(/\s+/)
    toSync.push({
      email_address: email,
      status_if_new: 'subscribed',
      merge_fields: {
        FNAME: parts[0]              ?? '',
        LNAME: parts.slice(1).join(' '),
        EMAIL: email,
        PHONE: (m.phone ?? ''),
      },
    })
  }

  console.log(`[mailchimp/sync] ${toSync.length} with email, ${skippedNoEmail} skipped (no email)`)

  if (toSync.length === 0) {
    return NextResponse.json({
      synced: 0, updated: 0, errored: 0,
      skipped_no_email: skippedNoEmail,
      total_received: members.length,
      errors: [],
    })
  }

  // ── 6. Batch upsert ───────────────────────────────────────────────────────
  let synced  = 0
  let updated = 0
  let errored = 0
  const batchErrors: ReturnType<typeof sanitizeBatchError>[] = []

  for (let i = 0; i < toSync.length; i += BATCH_SIZE) {
    const chunk    = toSync.slice(i, i + BATCH_SIZE)
    const batchNum = Math.floor(i / BATCH_SIZE) + 1
    console.log(`[mailchimp/sync] batch ${batchNum}: posting ${chunk.length} members…`)

    let result: { new_members: unknown[]; updated_members: unknown[]; errors: unknown[] }
    try {
      result = await mailchimp.lists.batchListMembers(audienceId, {
        members:         chunk,
        update_existing: true,
      })
    } catch (err) {
      const e    = err as { status?: number; response?: { body?: unknown }; message?: string }
      const body = sanitize(e.response?.body ?? null)
      console.error('[mailchimp/sync] API error:', { status: e.status, body, message: e.message })
      return NextResponse.json({
        error:          e.message ?? 'Mailchimp API request failed',
        http_status:    e.status  ?? null,
        mailchimp_body: body,
      }, { status: 502 })
    }

    synced  += result.new_members?.length     ?? 0
    updated += result.updated_members?.length ?? 0
    errored += result.errors?.length          ?? 0

    if (result.errors?.length) {
      batchErrors.push(...result.errors.map(sanitizeBatchError))
      console.error(`[mailchimp/sync] batch ${batchNum} errors:`, batchErrors.slice(-result.errors.length))
    }

    console.log(`[mailchimp/sync] batch ${batchNum} done — new:${result.new_members?.length} updated:${result.updated_members?.length} errors:${result.errors?.length}`)
  }

  console.log(`[mailchimp/sync] complete — synced:${synced} updated:${updated} errored:${errored}`)

  return NextResponse.json({
    synced,
    updated,
    errored,
    skipped_no_email: skippedNoEmail,
    total_received:   members.length,
    errors:           batchErrors,
  })
}
