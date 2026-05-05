import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

const MRR_PER_ACTIVE = 160

// ── Score engine ──────────────────────────────────────────────────────────────

function calcOperatorScore({
  total, active, inactive, leads, newLast30, newPrev30,
}: {
  total: number; active: number; inactive: number
  leads: number; newLast30: number; newPrev30: number
}) {
  // 1. Active member rate  (0–30 pts)
  const activeRate  = total > 0 ? active / total : 0
  const s1          = activeRate * 30

  // 2. MRR growth direction (0–25 pts)
  //    Compare new signups last 30 days vs prior 30 days.
  //    Flat baseline gets 12.5; each % above/below shifts proportionally.
  const growthRatio = newPrev30 > 0 ? newLast30 / newPrev30
                    : newLast30 > 0 ? 1.5   // growing from zero → strong
                    : 0.5                    // no new members either period → weak
  const s2          = Math.min(25, growthRatio * 12.5)   // 1.0x = 12.5, 2x = 25, 0x = 0

  // 3. Inactive member ratio (0–25 pts) — lower inactive is better
  const inactiveRate = total > 0 ? inactive / total : 0
  const s3           = (1 - inactiveRate) * 25

  // 4. Lead conversion rate  (0–20 pts)
  const pipeline    = active + leads
  const convRate    = pipeline > 0 ? active / pipeline : 0
  const s4          = convRate * 20

  const score = Math.round(s1 + s2 + s3 + s4)

  const components = [
    {
      label:   'Active member rate',
      pts:     Math.round(s1),
      max:     30,
      pct:     Math.round(activeRate * 100),
      detail:  `${active} of ${total} members are active`,
      up:      s1 >= 15,
    },
    {
      label:   'MRR growth',
      pts:     Math.round(s2),
      max:     25,
      pct:     Math.round(growthRatio * 100),
      detail:  newLast30 > newPrev30
                 ? `${newLast30} new vs ${newPrev30} prior 30 days — growing`
                 : newLast30 === newPrev30
                   ? `${newLast30} new each period — flat`
                   : `${newLast30} new vs ${newPrev30} prior 30 days — slowing`,
      up:      newLast30 >= newPrev30,
    },
    {
      label:   'Inactive member ratio',
      pts:     Math.round(s3),
      max:     25,
      pct:     Math.round(inactiveRate * 100),
      detail:  `${inactive} of ${total} members are inactive`,
      up:      s3 >= 12.5,
    },
    {
      label:   'Lead conversion rate',
      pts:     Math.round(s4),
      max:     20,
      pct:     Math.round(convRate * 100),
      detail:  `${active} active out of ${pipeline} total pipeline`,
      up:      s4 >= 10,
    },
  ]

  // Sort: biggest upward contributors first, then downward
  const sorted = [...components].sort((a, b) => {
    if (a.up === b.up) return b.pts - a.pts
    return a.up ? -1 : 1
  })

  const grade =
    score >= 75 ? 'Elite Operator'  :
    score >= 55 ? 'Strong'          :
    score >= 40 ? 'Building'        :
    score >= 25 ? 'At Risk'         :
                  'Critical'

  return { score, components, sorted, grade }
}

// ── SVG progress ring (server-rendered, no JS needed) ─────────────────────────

function ScoreRing({ score }: { score: number }) {
  const size   = 200
  const stroke = 8
  const r      = (size - stroke) / 2          // 96
  const circ   = 2 * Math.PI * r              // ≈ 603
  const offset = circ * (1 - score / 100)

  return (
    // rotate-[-90deg] so arc starts at 12 o'clock
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className="rotate-[-90deg]"
      aria-hidden="true"
    >
      {/* track */}
      <circle
        cx={size / 2} cy={size / 2} r={r}
        fill="none"
        stroke="#b8904a"
        strokeWidth={stroke}
        opacity={0.15}
      />
      {/* progress */}
      <circle
        cx={size / 2} cy={size / 2} r={r}
        fill="none"
        stroke="#b8904a"
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={circ}
        strokeDashoffset={offset}
      />
    </svg>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function DashboardPage() {
  const supabase   = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: profileData } = await supabase
    .from('profiles')
    .select('full_name')
    .eq('id', user!.id)
    .single()

  const { data: gymData } = await supabase
    .from('gyms')
    .select('id, name')
    .eq('owner_id', user!.id)
    .single()

  const gymId    = gymData?.id ?? ''
  const firstName = (profileData as { full_name: string | null } | null)?.full_name?.split(' ')[0] ?? 'Coach'

  const now      = new Date()
  const d30      = new Date(now); d30.setDate(now.getDate() - 30)
  const d60      = new Date(now); d60.setDate(now.getDate() - 60)
  const d7       = new Date(now); d7.setDate(now.getDate() - 7)
  const todayStr = now.toISOString().split('T')[0]   // YYYY-MM-DD

  const [
    { count: total },
    { count: active },
    { count: inactive },
    { count: leads },
    { count: newLast30 },
    { count: newPrev30 },
    { count: newThisWeek },
    { count: newToday },
  ] = await Promise.all([
    supabase.from('members').select('*', { count: 'exact', head: true }).eq('gym_id', gymId),
    supabase.from('members').select('*', { count: 'exact', head: true }).eq('gym_id', gymId).eq('status', 'active'),
    supabase.from('members').select('*', { count: 'exact', head: true }).eq('gym_id', gymId).eq('status', 'inactive'),
    supabase.from('members').select('*', { count: 'exact', head: true }).eq('gym_id', gymId).eq('status', 'lead'),
    supabase.from('members').select('*', { count: 'exact', head: true }).eq('gym_id', gymId).gte('joined_at', d30.toISOString()),
    supabase.from('members').select('*', { count: 'exact', head: true }).eq('gym_id', gymId).gte('joined_at', d60.toISOString()).lt('joined_at', d30.toISOString()),
    supabase.from('members').select('*', { count: 'exact', head: true }).eq('gym_id', gymId).gte('joined_at', d7.toISOString()),
    supabase.from('members').select('*', { count: 'exact', head: true }).eq('gym_id', gymId).gte('joined_at', todayStr),
  ])

  const { score, sorted, grade } = calcOperatorScore({
    total:     total     ?? 0,
    active:    active    ?? 0,
    inactive:  inactive  ?? 0,
    leads:     leads     ?? 0,
    newLast30: newLast30 ?? 0,
    newPrev30: newPrev30 ?? 0,
  })

  const mrr            = (active ?? 0) * MRR_PER_ACTIVE
  const arr            = mrr * 12
  const leadOpportunity = (leads ?? 0) * MRR_PER_ACTIVE
  const churnExposure  = (inactive ?? 0) * MRR_PER_ACTIVE

  const todayLabel = now.toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric',
  })

  const stats = [
    { label: 'Total Members', value: total    ?? 0, sub: 'all time',             href: '/dashboard/members' },
    { label: 'Active',        value: active   ?? 0, sub: 'paying members',       href: '/dashboard/members?status=active',  accent: true },
    { label: 'Inactive',      value: inactive ?? 0, sub: 'win-back opportunity', href: '/dashboard/members?status=inactive' },
    { label: 'Leads',         value: leads    ?? 0, sub: 'in your pipeline',     href: '/dashboard/members?status=lead' },
  ]

  return (
    <div className="min-h-full bg-bone">

      {/* ── Top bar ──────────────────────────────────────────────────────── */}
      <div className="border-b border-bone-deeper px-10 py-5 flex items-center justify-between">
        <div>
          <p className="text-xs tracking-widest uppercase text-ink-muted font-medium">{todayLabel}</p>
          <h2 className="font-serif text-2xl font-bold text-ink mt-0.5">
            Good morning, {firstName}.
          </h2>
        </div>
        <Link
          href="/dashboard/members"
          className="text-xs tracking-widest uppercase font-semibold text-ink border border-ink px-5 py-2.5 hover:bg-ink hover:text-bone transition-colors"
        >
          All Members
        </Link>
      </div>

      <div className="px-10 py-10 space-y-10">

        {/* ── OPERATOR SCORE hero ──────────────────────────────────────────── */}
        <div className="bg-ink">
          {/* label bar */}
          <div className="px-10 pt-8 pb-0 flex items-center gap-4">
            <p className="text-xs tracking-widest font-semibold text-gold uppercase">
              Operator Score
            </p>
            <div className="h-px flex-1 bg-bone/8" />
            <p className="text-xs tracking-widest uppercase text-bone/20 font-medium">{grade}</p>
          </div>

          {/* main body */}
          <div className="p-10 flex flex-col lg:flex-row items-start gap-12">

            {/* ring + number */}
            <div className="relative shrink-0 w-[200px] h-[200px]">
              <ScoreRing score={score} />
              {/* overlay: number centered inside ring */}
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="font-serif text-7xl font-bold text-bone leading-none">
                  {score}
                </span>
                <span className="text-xs tracking-widest uppercase text-gold/50 mt-1">/ 100</span>
              </div>
            </div>

            {/* right column: what's moving the score */}
            <div className="flex-1 flex flex-col justify-center gap-1 min-w-0">
              <p className="text-xs tracking-widest uppercase text-bone/30 font-medium mb-4">
                What&apos;s moving your score
              </p>

              {/* today's signups (shown only when > 0) */}
              {(newToday ?? 0) > 0 && (
                <div className="flex items-center gap-3 py-3 border-b border-bone/8">
                  <span className="text-xs font-bold text-gold w-5">↑</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-bone font-medium">
                      {newToday} new member{(newToday ?? 0) > 1 ? 's' : ''} joined today
                    </p>
                    <p className="text-xs text-bone/40 mt-0.5">
                      +{fmt((newToday ?? 0) * MRR_PER_ACTIVE)}/mo added to MRR
                    </p>
                  </div>
                  <span className="text-xs text-bone/30 shrink-0 font-mono">today</span>
                </div>
              )}

              {/* score components */}
              {sorted.map((c) => (
                <div key={c.label} className="flex items-center gap-3 py-3 border-b border-bone/8 last:border-0">
                  <span className={`text-xs font-bold w-5 ${c.up ? 'text-gold' : 'text-bone/30'}`}>
                    {c.up ? '↑' : '↓'}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-bone font-medium">{c.label}</p>
                    <p className="text-xs text-bone/40 mt-0.5">{c.detail}</p>
                  </div>
                  {/* pts bar */}
                  <div className="shrink-0 flex items-center gap-2">
                    <div className="w-16 h-1 bg-bone/10 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gold rounded-full"
                        style={{ width: `${(c.pts / c.max) * 100}%` }}
                      />
                    </div>
                    <span className="text-xs text-bone/40 font-mono w-10 text-right">
                      {c.pts}/{c.max}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── MRR strip ────────────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-px bg-bone-deeper border border-bone-deeper">
          <div className="bg-bone p-8">
            <p className="text-xs tracking-widest uppercase text-ink-muted font-medium mb-3">Monthly Recurring Revenue</p>
            <p className="font-serif text-5xl font-bold text-ink">{fmt(mrr)}</p>
            <p className="text-xs text-ink-muted mt-2">{active ?? 0} active × ${MRR_PER_ACTIVE}/mo</p>
          </div>
          <div className="bg-bone p-8">
            <p className="text-xs tracking-widest uppercase text-ink-muted font-medium mb-3">Annual Run Rate</p>
            <p className="font-serif text-5xl font-bold text-ink">{fmt(arr)}</p>
            <p className="text-xs text-ink-muted mt-2">based on current active count</p>
          </div>
          <div className="bg-bone p-8">
            <p className="text-xs tracking-widest uppercase text-ink-muted font-medium mb-3">Lead Upside</p>
            <p className="font-serif text-5xl font-bold text-gold">{fmt(leadOpportunity)}</p>
            <p className="text-xs text-ink-muted mt-2">if all {leads ?? 0} leads convert at ${MRR_PER_ACTIVE}/mo</p>
          </div>
        </div>

        {/* ── Stat tiles ────────────────────────────────────────────────────── */}
        <div>
          <p className="text-xs tracking-widest uppercase text-ink-muted font-medium mb-5">Membership Breakdown</p>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-bone-deeper border border-bone-deeper">
            {stats.map(({ label, value, sub, href, accent }) => (
              <Link
                key={label}
                href={href}
                className="bg-bone hover:bg-bone-dark transition-colors p-8 flex flex-col justify-between gap-6 group"
              >
                <span className={`font-serif text-6xl font-bold leading-none ${accent ? 'text-gold' : 'text-ink'}`}>
                  {value}
                </span>
                <div>
                  <p className="font-semibold text-ink text-sm">{label}</p>
                  <p className="text-xs text-ink-muted mt-0.5">{sub}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* ── Three action cards ───────────────────────────────────────────── */}
        <div>
          <div className="flex items-center gap-6 mb-5">
            <p className="text-xs tracking-widest uppercase text-ink-muted font-medium shrink-0">Focus Areas</p>
            <div className="h-px flex-1 bg-bone-deeper" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-px bg-bone-deeper border border-bone-deeper">

            {/* Card 1 — Churn Risks */}
            <div className="bg-bone hover:bg-bone-dark transition-colors p-8 flex flex-col gap-6 group">
              <div className="flex items-center justify-between">
                <p className="text-xs tracking-widest uppercase font-semibold text-ink-muted">Top Churn Risks</p>
                <span className="w-2 h-2 rounded-full bg-ink-muted/40" />
              </div>
              <div>
                <p className="font-serif text-6xl font-bold text-ink leading-none">{inactive ?? 0}</p>
                <p className="text-xs text-ink-muted mt-2">inactive members</p>
              </div>
              <div className="border-t border-bone-deeper pt-5 flex-1 flex flex-col justify-between gap-4">
                <p className="text-sm text-ink-muted font-light leading-relaxed">
                  {fmt(churnExposure)}/mo in potential revenue is sitting dormant.
                  A personal outreach to your top 10 converts more than any campaign.
                </p>
                <Link
                  href="/dashboard/members?status=inactive"
                  className="inline-flex items-center gap-2 text-xs tracking-widest uppercase font-semibold text-ink hover:text-gold transition-colors"
                >
                  <span className="w-4 h-px bg-current group-hover:w-6 transition-all duration-200" />
                  View inactive
                </Link>
              </div>
            </div>

            {/* Card 2 — Revenue Opportunity */}
            <div className="bg-ink p-8 flex flex-col gap-6 group">
              <div className="flex items-center justify-between">
                <p className="text-xs tracking-widest uppercase font-semibold text-gold/60">Revenue Opportunity</p>
                <span className="w-2 h-2 rounded-full bg-gold/40" />
              </div>
              <div>
                <p className="font-serif text-6xl font-bold text-bone leading-none">{leads ?? 0}</p>
                <p className="text-xs text-bone/40 mt-2">leads in your pipeline</p>
              </div>
              <div className="border-t border-bone/10 pt-5 flex-1 flex flex-col justify-between gap-4">
                <p className="text-sm text-bone/50 font-light leading-relaxed">
                  Converting 20% adds{' '}
                  <span className="text-gold font-medium">
                    {fmt(Math.round((leads ?? 0) * 0.2) * MRR_PER_ACTIVE)}/mo
                  </span>{' '}
                  in MRR. These people already raised their hand — follow up now.
                </p>
                <Link
                  href="/dashboard/members?status=lead"
                  className="inline-flex items-center gap-2 text-xs tracking-widest uppercase font-semibold text-gold hover:text-gold-light transition-colors"
                >
                  <span className="w-4 h-px bg-current group-hover:w-6 transition-all duration-200" />
                  View leads
                </Link>
              </div>
            </div>

            {/* Card 3 — This Week's Wins */}
            <div className="bg-bone hover:bg-bone-dark transition-colors p-8 flex flex-col gap-6 group">
              <div className="flex items-center justify-between">
                <p className="text-xs tracking-widest uppercase font-semibold text-ink-muted">This Week&apos;s Wins</p>
                <span className="w-2 h-2 rounded-full bg-gold" />
              </div>
              <div>
                <p className="font-serif text-6xl font-bold text-gold leading-none">{active ?? 0}</p>
                <p className="text-xs text-ink-muted mt-2">active, paying members</p>
              </div>
              <div className="border-t border-bone-deeper pt-5 flex-1 flex flex-col justify-between gap-4">
                <p className="text-sm text-ink-muted font-light leading-relaxed">
                  {(newThisWeek ?? 0) > 0
                    ? `${newThisWeek} new member${(newThisWeek ?? 0) > 1 ? 's' : ''} joined this week. That's ${fmt((newThisWeek ?? 0) * MRR_PER_ACTIVE)}/mo added to your MRR.`
                    : `Every one of these ${active ?? 0} members chose to invest in themselves — and in your gym. Keep delivering.`
                  }
                </p>
                <Link
                  href="/dashboard/members?status=active"
                  className="inline-flex items-center gap-2 text-xs tracking-widest uppercase font-semibold text-gold hover:text-gold-dark transition-colors"
                >
                  <span className="w-4 h-px bg-current group-hover:w-6 transition-all duration-200" />
                  View active
                </Link>
              </div>
            </div>

          </div>
        </div>

        {/* ── Footer rule ──────────────────────────────────────────────────── */}
        <div className="flex items-center gap-4 pt-2">
          <div className="h-px flex-1 bg-bone-deeper" />
          <p className="text-xs text-ink-muted font-light tracking-wide">
            Score updates on every page load · Revenue based on Performance tier · {now.getFullYear()}
          </p>
          <div className="h-px flex-1 bg-bone-deeper" />
        </div>

      </div>
    </div>
  )
}

function fmt(n: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency', currency: 'USD', maximumFractionDigits: 0,
  }).format(n)
}
