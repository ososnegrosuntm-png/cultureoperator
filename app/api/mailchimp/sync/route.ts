import { NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { createClient } from '@supabase/supabase-js'
// eslint-disable-next-line @typescript-eslint/no-require-imports
const mailchimp = require('@mailchimp/mailchimp_marketing')

const GYM_ID      = '6d52ca68-4f58-436c-a8f3-66933830e2e9'
const BATCH_SIZE  = 500   // Mailchimp batch limit

export async function POST(req: Request) {
  void req   // no body needed — we fetch all members ourselves

  // ── 1. Env var check ─────────────────────────────────────────────────────
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
    return NextResponse.json({ error: `Missing env vars: ${missing.join(', ')}`, missing }, { status: 500 })
  }

  // ── 2. Auth ───────────────────────────────────────────────────────────────
  const userClient = createServerClient()
  const { data: { user } } = await userClient.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // ── 3. Configure Mailchimp ────────────────────────────────────────────────
  mailchimp.setConfig({ apiKey, server: 'us2' })

  // ── 4. Fetch all members from Supabase ────────────────────────────────────
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const { data: profiles, error: dbError } = await supabase
    .from('profiles')
    .select('id, full_name, email, phone')
    .eq('gym_id', GYM_ID)
    .eq('role', 'member')

  if (dbError) {
    console.error('[mailchimp/sync] db error:', dbError.message)
    return NextResponse.json({ error: dbError.message }, { status: 500 })
  }

  console.log(`[mailchimp/sync] fetched ${profiles?.length ?? 0} members from db`)

  // ── 5. Build Mailchimp member objects ─────────────────────────────────────
  type MailchimpMember = {
    email_address: string
    status_if_new: string
    merge_fields: { FNAME: string; LNAME: string; EMAIL: string; PHONE: string }
  }

  const members: MailchimpMember[] = []
  const skippedNoEmail: string[]   = []

  for (const p of profiles ?? []) {
    const email    = (p.email as string | null)?.trim().toLowerCase()
    const fullName = (p.full_name as string | null) ?? ''
    const parts    = fullName.trim().split(/\s+/)
    const fname    = parts[0]        ?? ''
    const lname    = parts.slice(1).join(' ') ?? ''
    const phone    = (p.phone as string | null) ?? ''

    if (!email) {
      skippedNoEmail.push(fullName || p.id)
      continue
    }

    members.push({
      email_address: email,
      status_if_new: 'subscribed',
      merge_fields: { FNAME: fname, LNAME: lname, EMAIL: email, PHONE: phone },
    })
  }

  console.log(`[mailchimp/sync] ${members.length} with email, ${skippedNoEmail.length} skipped (no email)`)

  if (members.length === 0) {
    return NextResponse.json({
      synced: 0, updated: 0, errored: 0,
      skipped_no_email: skippedNoEmail.length,
      total_fetched: profiles?.length ?? 0,
      errors: [],
    })
  }

  // ── 6. Batch upsert in chunks of 500 ─────────────────────────────────────
  let synced  = 0
  let updated = 0
  let errored = 0
  const batchErrors: unknown[] = []

  for (let i = 0; i < members.length; i += BATCH_SIZE) {
    const chunk = members.slice(i, i + BATCH_SIZE)
    console.log(`[mailchimp/sync] posting batch ${Math.floor(i / BATCH_SIZE) + 1} (${chunk.length} members)…`)

    try {
      const result = await mailchimp.lists.batchListMembers(audienceId, {
        members: chunk,
        update_existing: true,
      }) as { new_members: unknown[]; updated_members: unknown[]; errors: unknown[] }

      synced  += result.new_members?.length     ?? 0
      updated += result.updated_members?.length ?? 0
      errored += result.errors?.length          ?? 0

      if (result.errors?.length) {
        batchErrors.push(...result.errors)
        console.error('[mailchimp/sync] batch errors:', result.errors)
      }

      console.log(`[mailchimp/sync] batch done — new:${result.new_members?.length} updated:${result.updated_members?.length} errors:${result.errors?.length}`)
    } catch (err) {
      const e = err as { status?: number; response?: { body?: unknown }; message?: string }
      console.error('[mailchimp/sync] batch request failed:', {
        status:  e.status,
        body:    e.response?.body,
        message: e.message,
      })
      return NextResponse.json({
        error:          e.message ?? 'Mailchimp request failed',
        http_status:    e.status  ?? null,
        mailchimp_body: e.response?.body ?? null,
      }, { status: 500 })
    }
  }

  console.log(`[mailchimp/sync] complete — synced:${synced} updated:${updated} errored:${errored}`)

  return NextResponse.json({
    synced,
    updated,
    errored,
    skipped_no_email: skippedNoEmail.length,
    total_fetched:    profiles?.length ?? 0,
    errors:           batchErrors,
  })
}
