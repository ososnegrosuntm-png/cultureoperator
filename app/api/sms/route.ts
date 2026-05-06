import { NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { createClient } from '@supabase/supabase-js'

const MSG = (firstName: string) =>
  `Hey ${firstName}, we miss you at Osos Negros! Come back this week — first session is on us. Reply YES to confirm.`

type TwilioError = {
  name:      string
  to:        string
  http_status: number
  twilio_code:   number | null
  twilio_message: string | null
  twilio_more_info: string | null
  raw_response: unknown
}

type SendResult =
  | { ok: true;  to: string; name: string }
  | { ok: false; to: string; name: string; error: TwilioError }

async function sendSMS(to: string, body: string): Promise<void> {
  const sid   = process.env.TWILIO_ACCOUNT_SID
  const token = process.env.TWILIO_AUTH_TOKEN
  const from  = process.env.TWILIO_FROM_NUMBER
  if (!sid || !token || !from) throw new Error('Twilio env vars not set (TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER)')

  const res = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
    {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ To: to, From: from, Body: body }).toString(),
    }
  )

  if (!res.ok) {
    let parsed: Record<string, unknown> = {}
    try { parsed = await res.json() as Record<string, unknown> } catch { /* non-JSON body */ }
    const err = Object.assign(new Error(String(parsed.message ?? `HTTP ${res.status}`)), {
      http_status:       res.status,
      twilio_code:       parsed.code        ?? null,
      twilio_message:    parsed.message     ?? null,
      twilio_more_info:  parsed.more_info   ?? null,
      raw_response:      parsed,
    })
    throw err
  }
}

export async function POST(req: Request) {
  // Auth — must be a logged-in gym owner
  const userClient = createServerClient()
  const { data: { user } } = await userClient.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let profileIds: string[]
  try {
    const body = await req.json()
    profileIds = body.profileIds
    if (!Array.isArray(profileIds) || profileIds.length === 0) throw new Error()
  } catch {
    return NextResponse.json({ error: 'profileIds must be a non-empty array' }, { status: 400 })
  }

  // Fetch names + phones server-side — never trust the client with PII
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const { data: profiles, error: dbError } = await supabase
    .from('profiles')
    .select('id, full_name, phone')
    .in('id', profileIds)

  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 })

  let sent = 0, skipped = 0, failed = 0
  const results: SendResult[] = []

  for (const p of profiles ?? []) {
    const name  = (p.full_name as string | null) ?? 'Unknown'
    const phone = p.phone as string | null

    if (!phone) {
      skipped++
      continue
    }

    const firstName = name.split(' ')[0]?.trim() || 'there'

    try {
      await sendSMS(phone, MSG(firstName))
      sent++
      results.push({ ok: true, to: phone, name })
      console.log(`[sms] ✓ sent  to=${phone} name=${name}`)
    } catch (err) {
      failed++
      // Pull the structured fields we attached in sendSMS
      const e = err as Error & {
        http_status?: number
        twilio_code?: number | null
        twilio_message?: string | null
        twilio_more_info?: string | null
        raw_response?: unknown
      }
      const errorDetail: TwilioError = {
        name,
        to:               phone,
        http_status:      e.http_status      ?? 0,
        twilio_code:      e.twilio_code      ?? null,
        twilio_message:   e.twilio_message   ?? e.message,
        twilio_more_info: e.twilio_more_info ?? null,
        raw_response:     e.raw_response     ?? null,
      }
      results.push({ ok: false, to: phone, name, error: errorDetail })
      console.error(`[sms] ✗ failed to=${phone} name=${name}`, errorDetail)
    }
  }

  return NextResponse.json({
    sent,
    skipped,
    failed,
    total: sent + skipped + failed,
    results,
  })
}
