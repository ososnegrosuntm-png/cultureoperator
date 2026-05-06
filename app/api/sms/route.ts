import { NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { createClient } from '@supabase/supabase-js'

const MSG = (firstName: string) =>
  `Hey ${firstName}, we miss you at Osos Negros! Come back this week — first session is on us. Reply YES to confirm.`

async function sendSMS(to: string, body: string) {
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
  if (!res.ok) throw new Error(`Twilio ${res.status}: ${await res.text()}`)
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

  const { data: profiles, error } = await supabase
    .from('profiles')
    .select('id, full_name, phone')
    .in('id', profileIds)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  let sent = 0, skipped = 0, failed = 0
  const errors: string[] = []

  for (const p of profiles ?? []) {
    if (!p.phone) { skipped++; continue }

    const firstName = (p.full_name as string | null)?.split(' ')[0]?.trim() || 'there'
    try {
      await sendSMS(p.phone, MSG(firstName))
      sent++
    } catch (err) {
      failed++
      errors.push(`${p.full_name ?? p.id}: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  return NextResponse.json({ sent, skipped, failed, total: sent + skipped + failed, errors: errors.slice(0, 10) })
}
