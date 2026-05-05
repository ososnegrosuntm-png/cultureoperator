import { NextResponse }   from 'next/server'
import { createClient }  from '@/lib/supabase/server'

const MSG_TEMPLATE = (firstName: string) =>
  `Hey ${firstName}, we miss you at Osos Negros. Come back this week — first session is on us. Reply YES to confirm.`

// ── Twilio helper (no npm package — raw REST) ─────────────────────────────────

async function sendSMS(to: string, body: string): Promise<void> {
  const sid   = process.env.TWILIO_ACCOUNT_SID
  const token = process.env.TWILIO_AUTH_TOKEN
  const from  = process.env.TWILIO_FROM_NUMBER

  if (!sid || !token || !from) {
    throw new Error('Twilio is not configured. Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_FROM_NUMBER.')
  }

  const credentials = Buffer.from(`${sid}:${token}`).toString('base64')

  const res = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
    {
      method:  'POST',
      headers: {
        Authorization:  `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ To: to, From: from, Body: body }).toString(),
    }
  )

  if (!res.ok) {
    const detail = await res.text()
    throw new Error(`Twilio error ${res.status}: ${detail}`)
  }
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function POST(req: Request) {
  // 1. Auth — server client picks up session from cookies
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // 2. Parse body
  let memberIds: string[]
  try {
    const body = await req.json()
    memberIds = body.memberIds
    if (!Array.isArray(memberIds) || memberIds.length === 0) throw new Error()
  } catch {
    return NextResponse.json({ error: 'memberIds must be a non-empty array' }, { status: 400 })
  }

  // 3. Fetch member names + phones from DB (never trust the client with PII)
  const { data: rows, error: dbErr } = await supabase
    .from('members')
    .select('id, profiles ( full_name, phone )')
    .in('id', memberIds)
    .eq('status', 'inactive')

  if (dbErr) {
    return NextResponse.json({ error: dbErr.message }, { status: 500 })
  }

  // 4. Send — sequentially to stay within Twilio's per-second limits
  let sent    = 0
  let skipped = 0
  let failed  = 0
  const errors: string[] = []

  type ProfileShape = { full_name: string | null; phone: string | null }
  for (const row of (rows ?? [])) {
    const profile  = (Array.isArray(row.profiles) ? row.profiles[0] : row.profiles) as ProfileShape | null
    const phone    = profile?.phone
    const fullName = profile?.full_name
    const firstName = fullName?.split(' ')[0]?.trim() || 'there'

    if (!phone) {
      skipped++
      continue
    }

    // Normalise to E.164 — Twilio requires it
    const digits = phone.replace(/\D/g, '')
    const e164   = digits.length === 10 ? `+1${digits}`
                 : digits.startsWith('1') && digits.length === 11 ? `+${digits}`
                 : `+${digits}`

    try {
      await sendSMS(e164, MSG_TEMPLATE(firstName))
      sent++
    } catch (err) {
      failed++
      const msg = err instanceof Error ? err.message : String(err)
      errors.push(`${fullName ?? row.id}: ${msg}`)
    }
  }

  return NextResponse.json({
    sent,
    skipped,
    failed,
    total: sent + skipped + failed,
    errors: errors.slice(0, 10), // cap error list for response size
  })
}
