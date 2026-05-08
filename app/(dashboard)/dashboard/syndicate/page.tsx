import { createClient } from '@/lib/supabase/server'
import { redirect }     from 'next/navigation'
import { SyndicatePanel } from '@/components/SyndicatePanel'
import type { MemberInsight } from '@/components/SyndicatePanel'

export const dynamic = 'force-dynamic'

const GYM_ID = '6d52ca68-4f58-436c-a8f3-66933830e2e9'

// ── Intensity logic ───────────────────────────────────────────────────────────
function getIntensity(
  daysSinceLast: number | null,
  checkInsThisMonth: number,
): 'easy' | 'moderate' | 'hard' {
  if (daysSinceLast === null || daysSinceLast > 7) return 'easy'
  if (daysSinceLast <= 2 && checkInsThisMonth >= 10) return 'hard'
  if (daysSinceLast <= 3 && checkInsThisMonth >= 6)  return 'hard'
  return 'moderate'
}

// ── Streak ────────────────────────────────────────────────────────────────────
function calcStreak(dates: string[]): number {
  if (!dates.length) return 0
  const days = Array.from(new Set(dates.map(d => d.slice(0, 10)))).sort().reverse()
  const today     = new Date().toISOString().slice(0, 10)
  const yesterday = new Date(Date.now() - 864e5).toISOString().slice(0, 10)
  if (days[0] !== today && days[0] !== yesterday) return 0
  let streak = 0
  let expect = days[0] === today ? today : yesterday
  for (const day of days) {
    if (day !== expect) break
    streak++
    const d = new Date(expect)
    d.setDate(d.getDate() - 1)
    expect = d.toISOString().slice(0, 10)
  }
  return streak
}

// ── ATLAS message ─────────────────────────────────────────────────────────────
function atlasMsg(
  name: string,
  intensity: 'easy' | 'moderate' | 'hard',
  daysSinceLast: number | null,
  checkInsThisMonth: number,
): string {
  const first = name.split(' ')[0]
  const seed  = name.charCodeAt(0) % 3

  if (daysSinceLast === null) {
    return `${first}, welcome to your training journey. Today we build the foundation — 20 min zone 2 cardio followed by full-body mobility. No pressure, just movement. — ATLAS, Your Fitness Coach`
  }
  if (intensity === 'easy') {
    return `${first}, it's been ${daysSinceLast} day${daysSinceLast === 1 ? '' : 's'} since your last session. Time to ease back in — 20 min zone 2 cardio + light stretching. One session restarts everything. — ATLAS, Your Fitness Coach`
  }
  if (intensity === 'moderate') {
    const sessions = [
      `Functional strength circuit — 3×10 goblet squats, 3×8 push-ups, 3×12 cable rows, 3×30s plank`,
      `Conditioning day — 4 rounds: 200m run, 15 KB swings, 10 box jumps, 60s rest`,
      `Upper/lower split — 4×6 bench press, 4×6 Romanian deadlift, 3×12 lunges, 3×10 lat pulldowns`,
    ]
    return `${first}, solid work — ${checkInsThisMonth} session${checkInsThisMonth === 1 ? '' : 's'} this month. Today: ${sessions[seed]}. Keep the momentum. — ATLAS, Your Fitness Coach`
  }
  // hard
  const sessions = [
    `Max strength — 5×5 back squat, 4×5 deadlift, 4×6 bench. 3 min rest between sets. Push limits.`,
    `HIIT power circuit — 5 rounds: 8 heavy thrusters, 10 pull-ups, 12 box jumps, 30s rest. All out.`,
    `Olympic lifting — snatch complex 5×3, then 3 rounds: 400m run + 20 wall balls. Elite work.`,
  ]
  return `${first}, you're locked in — ${checkInsThisMonth} sessions this month. Today: ${sessions[seed]}. This is elite territory. — ATLAS, Your Fitness Coach`
}

// ── IRON message ──────────────────────────────────────────────────────────────
function ironMsg(name: string, streak: number, score: number): string {
  const first = name.split(' ')[0]

  if (streak >= 14)
    return `${first}, ${streak}-day streak. Score: ${score}/100. You've crossed the threshold — this isn't motivation anymore, it's identity. Protect the streak like it's your greatest asset. — IRON, Your Mental Coach`
  if (streak >= 7)
    return `${first}, ${streak} days consecutive. Score: ${score}/100. Most people quit before week two. You didn't. That gap between you and average widens every day you show up. — IRON, Your Mental Coach`
  if (streak >= 3)
    return `${first}, ${streak}-day streak building. Score: ${score}/100. Momentum is fragile — protect it today. Every rep is a vote for the person you're becoming. Don't miss the vote. — IRON, Your Mental Coach`
  if (score >= 70)
    return `${first}, discipline score ${score}/100. Consistency at this level compounds. The work you're doing now is infrastructure for everything that comes next. Stay the course. — IRON, Your Mental Coach`
  if (score >= 40)
    return `${first}, score: ${score}/100. You're building something. Discipline isn't about being perfect — it's about showing up when you don't want to. Today is that day. — IRON, Your Mental Coach`
  if (score > 0)
    return `${first}, score: ${score}/100. The gap between who you are and who you want to be closes one session at a time. Schedule it like it's non-negotiable — because it is. — IRON, Your Mental Coach`
  return `${first}, discipline score: 0. Not a judgment — it's a starting point. One decision changes the data. What's one thing you can commit to today? — IRON, Your Mental Coach`
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default async function SyndicatePage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // ── Member profiles ───────────────────────────────────────────────────────
  const { data: profilesRaw } = await supabase
    .from('profiles')
    .select('id, full_name')
    .eq('gym_id', GYM_ID)
    .eq('role', 'member')
    .order('full_name', { ascending: true })

  type RawProfile  = { id: string; full_name: string | null }
  type RawMember   = { id: string; profile_id: string }
  type RawCheckIn  = { member_id: string; checked_in_at: string }

  const profiles = (profilesRaw ?? []) as unknown as RawProfile[]

  // ── Members table (profile_id → member.id for check-in join) ─────────────
  const { data: membersRaw } = await supabase
    .from('members')
    .select('id, profile_id')
    .eq('gym_id', GYM_ID)

  const memberRecords = (membersRaw ?? []) as unknown as RawMember[]
  const profileToMember = new Map(memberRecords.map(m => [m.profile_id, m.id]))
  const allMemberIds    = memberRecords.map(m => m.id)

  // ── Check-ins (last 60 days) ──────────────────────────────────────────────
  const checkInMap = new Map<string, string[]>()

  if (allMemberIds.length > 0) {
    const since = new Date(Date.now() - 60 * 864e5).toISOString()
    const { data: ciRaw } = await supabase
      .from('check_ins')
      .select('member_id, checked_in_at')
      .in('member_id', allMemberIds)
      .gte('checked_in_at', since)
      .order('checked_in_at', { ascending: false })

    const cis = (ciRaw ?? []) as unknown as RawCheckIn[]
    for (const ci of cis) {
      const arr = checkInMap.get(ci.member_id) ?? []
      arr.push(ci.checked_in_at)
      checkInMap.set(ci.member_id, arr)
    }
  }

  // ── Compute insights ──────────────────────────────────────────────────────
  const now          = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

  const members: MemberInsight[] = profiles.map(p => {
    const memberId = profileToMember.get(p.id)
    const dates    = (memberId ? checkInMap.get(memberId) : null) ?? []
    const name     = p.full_name ?? 'Member'

    const daysSinceLast = dates.length > 0
      ? Math.floor((now.getTime() - new Date(dates[0]).getTime()) / 864e5)
      : null

    const checkInsThisMonth = dates.filter(d => new Date(d) >= startOfMonth).length
    const streak            = calcStreak(dates)
    const disciplineScore   = Math.min(100, Math.round((checkInsThisMonth / 12) * 100))
    const atlasIntensity    = getIntensity(daysSinceLast, checkInsThisMonth)

    return {
      profileId: p.id,
      name,
      daysSinceLast,
      checkInsThisMonth,
      atlasIntensity,
      atlasMessage:  atlasMsg(name, atlasIntensity, daysSinceLast, checkInsThisMonth),
      streak,
      disciplineScore,
      ironMessage:   ironMsg(name, streak, disciplineScore),
    }
  })

  return (
    <SyndicatePanel
      currentUserId={user.id}
      gymId={GYM_ID}
      members={members}
    />
  )
}
