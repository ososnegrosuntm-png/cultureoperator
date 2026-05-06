import { NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { createClient } from '@supabase/supabase-js'

const GYM_ID = '6d52ca68-4f58-436c-a8f3-66933830e2e9'

// ── Message generation (placeholder data until wearables + workout log land) ──

const WORKOUTS = [
  'completed a 45-min strength session — squats, deadlifts, bench',
  'hit a 5K run in 24:30',
  'crushed a 60-min HIIT class',
  'did 30 min of mobility and yoga',
  'completed an upper body pull day',
  'finished a conditioning circuit — 5 rounds',
  'had a rest day — no logged workout',
]

const ACTIONS: Record<'good' | 'low', string[]> = {
  good: [
    'Push intensity today — your body is ready.',
    'Great day for a PR attempt.',
    'Time to level up — add weight or reps.',
  ],
  low: [
    'Keep it light today — mobility or a walk.',
    'Focus on recovery: stretch, hydrate, sleep early.',
    'Easy active recovery only — skip high intensity.',
  ],
}

function generateMessage(fullName: string | null, daysSinceJoined: number) {
  const firstName  = fullName?.split(' ')[0]?.trim() || 'there'
  const dayOfWeek  = new Date().getDay()
  const workout    = WORKOUTS[dayOfWeek % WORKOUTS.length]
  const recovery: 'good' | 'low' = Math.random() > 0.35 ? 'good' : 'low'
  const actions    = ACTIONS[recovery]
  const action     = actions[Math.floor(Math.random() * actions.length)]
  const streak     = Math.min(Math.max(1, daysSinceJoined), 365)

  const message =
    `Good morning ${firstName}. Yesterday you ${workout}. ` +
    `Your recovery looks ${recovery}. ` +
    `Today: ${action} ` +
    `You're on day ${streak} of your streak.`

  return { message, workout_summary: workout, recovery_status: recovery, recommended_action: action, streak_days: streak }
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function POST(req: Request) {
  // Allow Vercel Cron (CRON_SECRET) or an authenticated gym owner.
  const authHeader = req.headers.get('authorization')
  const isCron     = process.env.CRON_SECRET
                       ? authHeader === `Bearer ${process.env.CRON_SECRET}`
                       : false

  if (!isCron) {
    const userClient = createServerClient()
    const { data: { user } } = await userClient.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Use service role so RLS doesn't block bulk inserts.
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const { data: profiles, error: fetchErr } = await supabase
    .from('profiles')
    .select('id, full_name, created_at')
    .eq('gym_id', GYM_ID)
    .neq('role', 'owner')

  if (fetchErr) {
    return NextResponse.json({ error: fetchErr.message }, { status: 500 })
  }

  const today = new Date().toISOString().split('T')[0]
  let generated = 0
  let failed    = 0
  const errors: string[] = []

  for (const profile of profiles ?? []) {
    const daysSinceJoined = Math.floor(
      (Date.now() - new Date(profile.created_at).getTime()) / 86_400_000
    )
    const payload = generateMessage(profile.full_name, daysSinceJoined)

    const { error: upsertErr } = await supabase
      .from('coach_messages')
      .upsert(
        { gym_id: GYM_ID, profile_id: profile.id, message_date: today, ...payload },
        { onConflict: 'profile_id,message_date' }
      )

    if (upsertErr) {
      failed++
      errors.push(`${profile.full_name ?? profile.id}: ${upsertErr.message}`)
    } else {
      generated++
    }
  }

  return NextResponse.json({
    generated,
    failed,
    total: (profiles ?? []).length,
    date: today,
    errors: errors.slice(0, 10),
  })
}
