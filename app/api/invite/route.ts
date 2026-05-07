import { NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(req: Request) {
  try {
    return await handleInvite(req)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[invite] unhandled error:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

async function handleInvite(req: Request): Promise<NextResponse> {

  // ── 1. Auth — only owners / trainers may invite ───────────────────────────
  const userClient = createServerClient()
  const { data: { user } } = await userClient.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: callerProfile } = await userClient
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  const role = (callerProfile as { role: string } | null)?.role
  if (role !== 'owner' && role !== 'trainer') {
    return NextResponse.json({ error: 'Forbidden — only owners and trainers can send invites' }, { status: 403 })
  }

  // ── 2. Parse body ─────────────────────────────────────────────────────────
  let profileId: string
  try {
    const body = await req.json()
    profileId = body.profileId
    if (!profileId || typeof profileId !== 'string') throw new Error()
  } catch {
    return NextResponse.json({ error: 'profileId is required' }, { status: 400 })
  }

  // ── 3. Fetch member profile ───────────────────────────────────────────────
  const { data: memberRaw } = await userClient
    .from('profiles')
    .select('email, full_name')
    .eq('id', profileId)
    .single()

  const member = memberRaw as { email: string | null; full_name: string | null } | null

  if (!member) {
    return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
  }
  if (!member.email) {
    return NextResponse.json({ error: 'Member has no email on file' }, { status: 400 })
  }

  // ── 4. Env check ──────────────────────────────────────────────────────────
  const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL

  if (!serviceKey) {
    console.error('[invite] SUPABASE_SERVICE_ROLE_KEY not set')
    return NextResponse.json({ error: 'Server misconfiguration — SUPABASE_SERVICE_ROLE_KEY missing' }, { status: 500 })
  }

  // ── 5. Derive redirect URL from request origin ────────────────────────────
  const origin = new URL(req.url).origin
  const redirectTo = `${origin}/callback?next=/dashboard/messages`

  console.log(`[invite] sending invite to ${member.email} (${member.full_name ?? 'unknown'}) → redirect: ${redirectTo}`)

  // ── 6. Send invite via Supabase Admin API ─────────────────────────────────
  const adminClient = createClient(supabaseUrl!, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const { error } = await adminClient.auth.admin.inviteUserByEmail(member.email, {
    redirectTo,
    data: { full_name: member.full_name },
  })

  if (error) {
    console.error('[invite] Supabase error:', error.message, error.status)

    // 422 = user already registered — treat as success variant
    const alreadyActive =
      error.status === 422 ||
      /already registered|already exists|user exists/i.test(error.message)

    if (alreadyActive) {
      return NextResponse.json({ already_active: true, email: member.email })
    }

    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  console.log(`[invite] ✓ invite sent to ${member.email}`)
  return NextResponse.json({ success: true, email: member.email })
}
