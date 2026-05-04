import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

const MRR_PER_ACTIVE = 160

export default async function DashboardPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: profileData } = await supabase
    .from('profiles')
    .select('*, gyms(*)')
    .eq('id', user!.id)
    .single()

  const profile = profileData as {
    full_name: string | null
    gym_id: string | null
    gyms: { name: string } | null
  } | null

  const gymId = profile?.gym_id ?? ''
  const firstName = profile?.full_name?.split(' ')[0] ?? 'Coach'

  const weekAgo = new Date()
  weekAgo.setDate(weekAgo.getDate() - 7)

  const [
    { count: total },
    { count: active },
    { count: inactive },
    { count: leads },
    { count: newThisWeek },
  ] = await Promise.all([
    supabase.from('members').select('*', { count: 'exact', head: true }).eq('gym_id', gymId),
    supabase.from('members').select('*', { count: 'exact', head: true }).eq('gym_id', gymId).eq('status', 'active'),
    supabase.from('members').select('*', { count: 'exact', head: true }).eq('gym_id', gymId).eq('status', 'inactive'),
    supabase.from('members').select('*', { count: 'exact', head: true }).eq('gym_id', gymId).eq('status', 'lead'),
    supabase.from('members').select('*', { count: 'exact', head: true }).eq('gym_id', gymId).gte('joined_at', weekAgo.toISOString()),
  ])

  const mrr = (active ?? 0) * MRR_PER_ACTIVE
  const arr = mrr * 12
  const leadOpportunity = (leads ?? 0) * MRR_PER_ACTIVE
  const churnExposure = (inactive ?? 0) * MRR_PER_ACTIVE

  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  })

  const stats = [
    { label: 'Total Members', value: total ?? 0,    sub: 'all time',              href: '/dashboard/members' },
    { label: 'Active',        value: active ?? 0,   sub: 'paying members',        href: '/dashboard/members?status=active',   accent: true },
    { label: 'Inactive',      value: inactive ?? 0, sub: 'win-back opportunity',  href: '/dashboard/members?status=inactive' },
    { label: 'Leads',         value: leads ?? 0,    sub: 'in your pipeline',      href: '/dashboard/members?status=lead' },
  ]

  return (
    <div className="min-h-full bg-bone">

      {/* ── Top bar ──────────────────────────────────────────────────────── */}
      <div className="border-b border-bone-deeper px-10 py-5 flex items-center justify-between">
        <div>
          <p className="text-xs tracking-widest uppercase text-ink-muted font-medium">{today}</p>
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

        {/* ── MRR Hero ─────────────────────────────────────────────────────── */}
        <div className="bg-ink p-10 flex flex-col sm:flex-row sm:items-end justify-between gap-8">
          <div>
            <p className="text-xs tracking-widest uppercase text-gold font-semibold mb-4">
              Monthly Recurring Revenue
            </p>
            <p className="font-serif text-8xl font-bold text-bone leading-none">
              {fmt(mrr)}
            </p>
            <p className="text-bone/40 text-sm mt-4 font-light">
              {active ?? 0} active members × ${MRR_PER_ACTIVE}/mo
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-px bg-bone/8 border border-bone/10 shrink-0">
            <div className="px-8 py-6 bg-ink">
              <p className="text-xs tracking-widest uppercase text-bone/30 font-medium mb-1.5">Annual Run Rate</p>
              <p className="font-serif text-3xl font-bold text-bone">{fmt(arr)}</p>
            </div>
            <div className="px-8 py-6 bg-ink border-l border-bone/10">
              <p className="text-xs tracking-widest uppercase text-bone/30 font-medium mb-1.5">Lead Upside</p>
              <p className="font-serif text-3xl font-bold text-gold">{fmt(leadOpportunity)}</p>
            </div>
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
                  {newThisWeek && newThisWeek > 0
                    ? `${newThisWeek} new member${newThisWeek > 1 ? 's' : ''} joined this week. That's ${fmt(newThisWeek * MRR_PER_ACTIVE)}/mo added to your MRR.`
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
            Revenue estimates based on Performance tier · {new Date().getFullYear()}
          </p>
          <div className="h-px flex-1 bg-bone-deeper" />
        </div>

      </div>
    </div>
  )
}

function fmt(n: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(n)
}
