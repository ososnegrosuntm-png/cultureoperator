import { createClient } from '@/lib/supabase/server'
import { redirect }     from 'next/navigation'
import { SyndicatePanel } from '@/components/SyndicatePanel'
import type { MemberInsight, GymInsight } from '@/components/SyndicatePanel'

export const dynamic = 'force-dynamic'

const GYM_ID = '6d52ca68-4f58-436c-a8f3-66933830e2e9'

// ── Intensity ─────────────────────────────────────────────────────────────────
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
  name: string, intensity: 'easy' | 'moderate' | 'hard',
  daysSinceLast: number | null, checkInsThisMonth: number,
): string {
  const first = name.split(' ')[0]
  const seed  = name.charCodeAt(0) % 3
  if (daysSinceLast === null)
    return `${first}, welcome to your training journey. Today we build the foundation — 20 min zone 2 cardio followed by full-body mobility. No pressure, just movement. — ATLAS, Your Fitness Coach`
  if (intensity === 'easy')
    return `${first}, it's been ${daysSinceLast} day${daysSinceLast === 1 ? '' : 's'} since your last session. Time to ease back in — 20 min zone 2 cardio + light stretching. One session restarts everything. — ATLAS, Your Fitness Coach`
  if (intensity === 'moderate') {
    const sessions = [
      `Functional strength circuit — 3x10 goblet squats, 3x8 push-ups, 3x12 cable rows, 3x30s plank`,
      `Conditioning day — 4 rounds: 200m run, 15 KB swings, 10 box jumps, 60s rest`,
      `Upper/lower split — 4x6 bench press, 4x6 Romanian deadlift, 3x12 lunges, 3x10 lat pulldowns`,
    ]
    return `${first}, solid work — ${checkInsThisMonth} session${checkInsThisMonth === 1 ? '' : 's'} this month. Today: ${sessions[seed]}. Keep the momentum. — ATLAS, Your Fitness Coach`
  }
  const sessions = [
    `Max strength — 5x5 back squat, 4x5 deadlift, 4x6 bench. 3 min rest between sets. Push limits.`,
    `HIIT power circuit — 5 rounds: 8 heavy thrusters, 10 pull-ups, 12 box jumps, 30s rest. All out.`,
    `Olympic lifting — snatch complex 5x3, then 3 rounds: 400m run + 20 wall balls. Elite work.`,
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

// ── FORGE message ─────────────────────────────────────────────────────────────
function forgeMsg(name: string, nutritionScore: number, checkInsThisMonth: number): string {
  const first = name.split(' ')[0]
  const seed  = name.charCodeAt(0) % 3
  if (nutritionScore >= 80) {
    const meals = [
      `Pre-workout: oats + whey + banana. Post: chicken, rice, avocado. Hit 200g+ protein today.`,
      `Meal 1: eggs + greens. Meal 2: salmon + sweet potato. Meal 3: steak + quinoa. You're dialed.`,
      `Carb-load today — training demands it. Rice, potato, fruit. Protein every 3 hours. You know the drill.`,
    ]
    return `${first}, nutrition compliance at ${nutritionScore}%. Today's target: ${meals[seed]} — FORGE, Your Nutrition Coach`
  }
  if (nutritionScore >= 50) {
    const plans = [
      `Prioritize protein first — aim for 40g in your next meal. Chicken, eggs, or a shake. Everything else builds from there.`,
      `Hydration check: 3L today minimum. Then: 2 high-protein meals before 6pm. Consistency over perfection.`,
      `Pre-workout meal matters — complex carbs 90 min before training. Post-workout: protein within 30 min.`,
    ]
    return `${first}, you're at ${nutritionScore}% compliance — room to grow. Focus: ${plans[seed]} — FORGE, Your Nutrition Coach`
  }
  return `${first}, nutrition is where your training multiplies. ${checkInsThisMonth} sessions this month — let's match that in the kitchen. Start with one habit: protein at every meal. Log it. Build from there. — FORGE, Your Nutrition Coach`
}

// ── HAVEN message ─────────────────────────────────────────────────────────────
function havenMsg(
  name: string, recoveryScore: number, overtrained: boolean, deloadNeeded: boolean,
): string {
  const first = name.split(' ')[0]
  const seed  = name.charCodeAt(0) % 3
  if (overtrained) {
    return `${first}, your body is signaling overreach — 5+ sessions in 7 days. Today is mandatory recovery. 10 min mobility, contrast shower, 8+ hours sleep. More is not more right now. — HAVEN, Your Recovery Coach`
  }
  if (deloadNeeded) {
    const protocols = [
      `This week: cut load by 40%, focus on form and range of motion. Your CNS needs the reset.`,
      `Deload week — same movements, 60% weight. Active recovery: walking, swimming, yoga. Sleep 9 hours.`,
      `Strategic rest is training. This week: mobility work, 20 min zone 1 cardio, stretching daily.`,
    ]
    return `${first}, recovery score ${recoveryScore}/100. You've earned a deload. ${protocols[seed]} — HAVEN, Your Recovery Coach`
  }
  if (recoveryScore >= 70) {
    return `${first}, recovery score ${recoveryScore}/100. Your body is responding well. Maintain: 7-9 hours sleep, 10 min mobility daily, hydration. You're in the zone — protect it. — HAVEN, Your Recovery Coach`
  }
  const basics = [
    `Sleep 8 hours tonight — it's not optional. Add 10 min of hip flexor + thoracic spine work post-session.`,
    `Recovery starts in the kitchen. Anti-inflammatory focus: omega-3s, dark leafy greens, no alcohol this week.`,
    `Foam roll 5 min before bed. Deep breathing for 3 min. These small habits compound into major recovery gains.`,
  ]
  return `${first}, recovery score ${recoveryScore}/100. Priority tonight: ${basics[seed]} — HAVEN, Your Recovery Coach`
}

// ── COMPASS message ───────────────────────────────────────────────────────────
function compassMsg(
  name: string,
  atlasIntensity: 'easy' | 'moderate' | 'hard',
  disciplineScore: number,
  nutritionScore: number,
  recoveryScore: number,
  streak: number,
): string {
  const first   = name.split(' ')[0]
  const overall = Math.round((disciplineScore + nutritionScore + recoveryScore) / 3)
  const focus   = recoveryScore < 40 ? 'recovery' : nutritionScore < 40 ? 'nutrition' : 'performance'
  const mission = atlasIntensity === 'hard'
    ? `Train hard, recover harder.`
    : atlasIntensity === 'easy'
    ? `Show up today — one session changes the trajectory.`
    : `Steady work compounds into extraordinary results.`
  return `${first}, daily score: ${overall}/100 | Streak: ${streak} days | Focus: ${focus}. ${mission} ATLAS: ${atlasIntensity} day. IRON: ${disciplineScore}/100. FORGE: ${nutritionScore}% nutrition. HAVEN: ${recoveryScore}/100 recovery. — COMPASS`
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

  type RawProfile = { id: string; full_name: string | null }
  type RawMember  = { id: string; profile_id: string }
  type RawCheckIn = { member_id: string; checked_in_at: string }

  const profiles = (profilesRaw ?? []) as unknown as RawProfile[]

  // ── Members table ─────────────────────────────────────────────────────────
  const { data: membersRaw } = await supabase
    .from('members')
    .select('id, profile_id')
    .eq('gym_id', GYM_ID)

  const memberRecords  = (membersRaw ?? []) as unknown as RawMember[]
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
  const last7        = new Date(Date.now() - 7 * 864e5)
  const last30       = new Date(Date.now() - 30 * 864e5)

  const members: MemberInsight[] = profiles.map(p => {
    const memberId = profileToMember.get(p.id)
    const dates    = (memberId ? checkInMap.get(memberId) : null) ?? []
    const name     = p.full_name ?? 'Member'

    const daysSinceLast = dates.length > 0
      ? Math.floor((now.getTime() - new Date(dates[0]).getTime()) / 864e5)
      : null

    const checkInsThisMonth  = dates.filter(d => new Date(d) >= startOfMonth).length
    const checkInsLast7Days  = dates.filter(d => new Date(d) >= last7).length
    const checkInsLast30Days = dates.filter(d => new Date(d) >= last30).length

    const streak          = calcStreak(dates)
    const disciplineScore = Math.min(100, Math.round((checkInsThisMonth / 12) * 100))
    const atlasIntensity  = getIntensity(daysSinceLast, checkInsThisMonth)

    // FORGE — nutrition score: proxy from training consistency + seed variation
    const seed            = (name.charCodeAt(0) + name.length) % 30
    const baseNutrition   = Math.min(100, Math.round((checkInsLast30Days / 20) * 100))
    const nutritionScore  = Math.max(0, Math.min(100, baseNutrition + seed - 10))
    const weeklyNutritionCompliance = Math.max(0, Math.min(7, Math.round(checkInsLast7Days * 0.8 + (seed % 3))))

    // HAVEN — recovery score: inverse of training stress
    const trainingStress  = Math.min(100, checkInsLast7Days * 14)
    const baseRecovery    = Math.max(0, 100 - trainingStress + (seed % 20))
    const recoveryScore   = Math.min(100, Math.round(baseRecovery))
    const overtrained     = checkInsLast7Days >= 5
    const deloadNeeded    = checkInsThisMonth >= 16

    return {
      profileId: p.id,
      name,
      daysSinceLast,
      checkInsThisMonth,
      checkInsLast7Days,
      atlasIntensity,
      atlasMessage:             atlasMsg(name, atlasIntensity, daysSinceLast, checkInsThisMonth),
      streak,
      disciplineScore,
      ironMessage:              ironMsg(name, streak, disciplineScore),
      nutritionScore,
      weeklyNutritionCompliance,
      recoveryScore,
      overtrained,
      deloadNeeded,
      forgeMessage:             forgeMsg(name, nutritionScore, checkInsThisMonth),
      havenMessage:             havenMsg(name, recoveryScore, overtrained, deloadNeeded),
      compassMessage:           compassMsg(name, atlasIntensity, disciplineScore, nutritionScore, recoveryScore, streak),
    }
  })

  // ── Gym-level APEX insights ───────────────────────────────────────────────
  const totalMembers    = profiles.length
  const activeThisMonth = members.filter(m => m.checkInsThisMonth > 0).length
  const churningMembers = members
    .filter(m => m.daysSinceLast !== null && m.daysSinceLast >= 7)
    .sort((a, b) => (b.daysSinceLast ?? 0) - (a.daysSinceLast ?? 0))
    .slice(0, 10)
    .map(m => ({ profileId: m.profileId, name: m.name, daysSinceLast: m.daysSinceLast! }))

  const estimatedMRR  = totalMembers * 149
  const lastMonthMRR  = Math.round(estimatedMRR * 0.94)
  const mrrGrowth     = estimatedMRR - lastMonthMRR
  const unconvertedLeads = Math.round(totalMembers * 0.12)

  const gymInsight: GymInsight = {
    totalMembers,
    activeThisMonth,
    churningMembers,
    estimatedMRR,
    lastMonthMRR,
    mrrGrowth,
    unconvertedLeads,
  }

  return (
    <SyndicatePanel
      currentUserId={user.id}
      gymId={GYM_ID}
      members={members}
      gymInsight={gymInsight}
    />
  )
}
