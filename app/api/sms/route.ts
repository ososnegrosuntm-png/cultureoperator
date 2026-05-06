import { NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { createClient } from '@supabase/supabase-js'
import twilio from 'twilio'

const MSG = (firstName: string) =>
  `Hey ${firstName}, we miss you at Osos Negros! Come back this week — first session is on us. Reply YES to confirm.`

export async function POST(req: Request) {
  // ── 1. Env var diagnostics — logged before anything else ─────────────────
  const sid   = process.env.TWILIO_ACCOUNT_SID
  const token = process.env.TWILIO_AUTH_TOKEN
  const from  = process.env.TWILIO_FROM_NUMBER

  console.log('[sms] env check:', {
    TWILIO_ACCOUNT_SID:  sid   ? `set (${sid.slice(0, 6)}…)`   : 'MISSING',
    TWILIO_AUTH_TOKEN:   token ? `set (${token.slice(0, 6)}…)` : 'MISSING',
    TWILIO_FROM_NUMBER:  from  ? `set (${from})`               : 'MISSING',
  })

  const missing = [
    !sid   && 'TWILIO_ACCOUNT_SID',
    !token && 'TWILIO_AUTH_TOKEN',
    !from  && 'TWILIO_FROM_NUMBER',
  ].filter(Boolean)

  if (missing.length > 0) {
    console.error('[sms] aborting — missing env vars:', missing)
    return NextResponse.json(
      { error: `Missing Twilio env vars: ${missing.join(', ')}`, missing },
      { status: 500 }
    )
  }

  // ── 2. Auth ───────────────────────────────────────────────────────────────
  const userClient = createServerClient()
  const { data: { user } } = await userClient.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // ── 3. Parse body ─────────────────────────────────────────────────────────
  let profileIds: string[]
  try {
    const body = await req.json()
    profileIds = body.profileIds
    if (!Array.isArray(profileIds) || profileIds.length === 0) throw new Error()
  } catch {
    return NextResponse.json({ error: 'profileIds must be a non-empty array' }, { status: 400 })
  }

  console.log(`[sms] request for ${profileIds.length} profile(s)`)

  // ── 4. Fetch names + phones server-side ───────────────────────────────────
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const { data: profiles, error: dbError } = await supabase
    .from('profiles')
    .select('id, full_name, phone')
    .in('id', profileIds)

  if (dbError) {
    console.error('[sms] db error:', dbError.message)
    return NextResponse.json({ error: dbError.message }, { status: 500 })
  }

  console.log(`[sms] fetched ${profiles?.length ?? 0} profile(s) from db`)

  // ── 5. Send via Twilio SDK ────────────────────────────────────────────────
  const client = twilio(sid, token)
  let sent = 0, skipped = 0, failed = 0

  type SendResult =
    | { ok: true;  name: string; to: string; sid: string }
    | { ok: false; name: string; to: string; http_status: number | null; twilio_code: number | null; twilio_message: string | null; twilio_more_info: string | null }

  const results: SendResult[] = []

  for (const p of profiles ?? []) {
    const name  = (p.full_name as string | null) ?? 'Unknown'
    const phone = p.phone as string | null

    if (!phone) {
      console.log(`[sms] skip ${name} — no phone`)
      skipped++
      continue
    }

    const firstName = name.split(' ')[0]?.trim() || 'there'
    console.log(`[sms] sending to ${name} (${phone})…`)

    try {
      const message = await client.messages.create({
        to:   phone,
        from: from!,
        body: MSG(firstName),
      })
      sent++
      console.log(`[sms] ✓ sent to ${name} (${phone}) — sid: ${message.sid}`)
      results.push({ ok: true, name, to: phone, sid: message.sid })
    } catch (err) {
      failed++
      const e = err as { status?: number; code?: number; message?: string; moreInfo?: string }
      console.error(`[sms] ✗ failed ${name} (${phone}):`, {
        status:   e.status   ?? null,
        code:     e.code     ?? null,
        message:  e.message  ?? null,
        moreInfo: e.moreInfo ?? null,
      })
      results.push({
        ok:               false,
        name,
        to:               phone,
        http_status:      e.status   ?? null,
        twilio_code:      e.code     ?? null,
        twilio_message:   e.message  ?? null,
        twilio_more_info: e.moreInfo ?? null,
      })
    }
  }

  console.log(`[sms] done — sent:${sent} skipped:${skipped} failed:${failed}`)

  return NextResponse.json({ sent, skipped, failed, total: sent + skipped + failed, results })
}
