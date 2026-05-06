import { createClient } from '@/lib/supabase/server'
import { redirect }     from 'next/navigation'
import { CoachPanel }   from '@/components/CoachPanel'
import type { CoachMessage } from '@/components/CoachPanel'

export const dynamic = 'force-dynamic'

const GYM_ID = '6d52ca68-4f58-436c-a8f3-66933830e2e9'

export default async function CoachPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const today = new Date().toISOString().split('T')[0]

  // Fetch today's messages joined with member names
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: raw } = await (supabase as any)
    .from('coach_messages')
    .select(`
      id,
      profile_id,
      message,
      workout_summary,
      recovery_status,
      recommended_action,
      streak_days,
      message_date,
      profiles ( full_name )
    `)
    .eq('gym_id', GYM_ID)
    .eq('message_date', today)
    .order('created_at', { ascending: false })

  type RawRow = {
    id: string; profile_id: string; message: string
    workout_summary: string | null; recovery_status: string | null
    recommended_action: string | null; streak_days: number; message_date: string
    profiles: { full_name: string | null } | { full_name: string | null }[] | null
  }

  const messages: CoachMessage[] = ((raw ?? []) as unknown as RawRow[]).map(r => ({
    id:                 r.id,
    profile_id:         r.profile_id,
    message:            r.message,
    workout_summary:    r.workout_summary,
    recovery_status:    r.recovery_status as 'good' | 'low' | null,
    recommended_action: r.recommended_action,
    streak_days:        r.streak_days,
    message_date:       r.message_date,
    full_name: Array.isArray(r.profiles)
      ? (r.profiles[0]?.full_name ?? null)
      : (r.profiles?.full_name ?? null),
  }))

  const displayDate = new Date().toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric',
  })

  return <CoachPanel initialMessages={messages} initialDate={displayDate} />
}
