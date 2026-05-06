import { NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { createClient } from '@supabase/supabase-js'
// Note: uses NEXT_PUBLIC_SUPABASE_ANON_KEY (available in all Vercel envs)
// eslint-disable-next-line @typescript-eslint/no-require-imports
const mailchimp = require('@mailchimp/mailchimp_marketing')

const GYM_ID     = '6d52ca68-4f58-436c-a8f3-66933830e2e9'
const BATCH_SIZE = 500

/** Strip an unknown value down to a plain JSON-safe object. */
function sanitize(val: unknown): unknown {
  try {
    return JSON.parse(JSON.stringify(val))
  } catch {
    return String(val)
  }
}

/** Pull the fields we care about from a Mailchimp batch error entry. */
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
  void req

  // ── Top-level safety net — guarantees a JSON response on any throw ────────
  try {
    return await handleSync()
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[mailchimp/sync] unhandled error:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

async function handleSync(): Promise<NextResponse> {

  // ── 1. Env var check ──────────────────────────────────────────────────────
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
    console.error('[mailchimp/sync] aborting — missing env vars:', missing)
    return NextResponse.json(
      { error: `Missing env vars: ${missing.join(', ')}`, missing },
      { status: 500 }
    )
  }

  // ── 2. Auth ───────────────────────────────────────────────────────────────
  const userClient = createServerClient()
  const { data: { user } } = await userClient.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // ── 3. Configure Mailchimp (server prefix extracted from key) ─────────────
  const server = apiKey!.split('-').pop() ?? 'us2'
  mailchimp.setConfig({ apiKey, server })
  console.log(`[mailchimp/sync] configured with server=${server}`)

  // ── 4. Fetch members from Supabase ────────────────────────────────────────
  const SUPABASE_URL  = 'https://htqwoxkcgkdzeitdmxlx.supabase.co'
  const supabaseAnon  = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  console.log('[mailchimp/sync] supabase config:', {
    url:  SUPABASE_URL,
    anon_key: supabaseAnon ? `set (${supabaseAnon.slice(0, 20)}…)` : 'MISSING',
  })

  if (!supabaseAnon) {
    console.error('[mailchimp/sync] NEXT_PUBLIC_SUPABASE_ANON_KEY is not set')
    return NextResponse.json(
      { error: 'Missing env var: NEXT_PUBLIC_SUPABASE_ANON_KEY' },
      { status: 500 }
    )
  }

  const supabase = createClient(SUPABASE_URL, supabaseAnon, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  console.log(`[mailchimp/sync] querying profiles where gym_id=${GYM_ID} role=member…`)

  const { data: profiles, error: dbError } = await supabase
    .from('profiles')
    .select('id, full_name, email, phone')
    .eq('gym_id', GYM_ID)
    .eq('role', 'member')

  if (dbError) {
    console.error('[mailchimp/sync] supabase query error:', dbError.message, dbError)
    return NextResponse.json({ error: dbError.message, detail: dbError }, { status: 500 })
  }

  const totalFetched = profiles?.length ?? 0
  console.log(`[mailchimp/sync] fetched ${totalFetched} profiles from supabase`)
  if (totalFetched > 0) {
    console.log('[mailchimp/sync] sample row:', JSON.stringify(profiles![0]))
  }

  // ── 5. Build member list — skip rows without an email ─────────────────────
  type MailchimpMember = {
    email_address: string
    status_if_new: 'subscribed'
    merge_fields: { FNAME: string; LNAME: string; EMAIL: string; PHONE: string }
  }

  const toSync: MailchimpMember[] = []
  let skippedNoEmail = 0

  for (const p of profiles ?? []) {
    const email = ((p.email as string | null) ?? '').trim().toLowerCase()
    if (!email) { skippedNoEmail++; continue }

    const parts = ((p.full_name as string | null) ?? '').trim().split(/\s+/)
    toSync.push({
      email_address: email,
      status_if_new: 'subscribed',
      merge_fields: {
        FNAME: parts[0]              ?? '',
        LNAME: parts.slice(1).join(' '),
        EMAIL: email,
        PHONE: (p.phone as string | null) ?? '',
      },
    })
  }

  console.log(`[mailchimp/sync] ${toSync.length} with email, ${skippedNoEmail} skipped (no email)`)

  if (toSync.length === 0) {
    return NextResponse.json({
      synced: 0, updated: 0, errored: 0,
      skipped_no_email: skippedNoEmail,
      total_fetched: totalFetched,
      errors: [],
    })
  }

  // ── 6. Batch upsert ───────────────────────────────────────────────────────
  let synced  = 0
  let updated = 0
  let errored = 0
  const batchErrors: ReturnType<typeof sanitizeBatchError>[] = []

  for (let i = 0; i < toSync.length; i += BATCH_SIZE) {
    const chunk     = toSync.slice(i, i + BATCH_SIZE)
    const batchNum  = Math.floor(i / BATCH_SIZE) + 1
    console.log(`[mailchimp/sync] batch ${batchNum}: posting ${chunk.length} members…`)

    let result: { new_members: unknown[]; updated_members: unknown[]; errors: unknown[] }
    try {
      result = await mailchimp.lists.batchListMembers(audienceId, {
        members:         chunk,
        update_existing: true,
      })
    } catch (err) {
      // Extract what we can from the SDK error — avoid leaking non-serializable objects
      const e  = err as { status?: number; response?: { body?: unknown }; message?: string }
      const body = sanitize(e.response?.body ?? null)
      console.error('[mailchimp/sync] Mailchimp API error:', { status: e.status, body, message: e.message })
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
      // Sanitize each error entry before storing
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
    total_fetched:    totalFetched,
    errors:           batchErrors,
  })
}
