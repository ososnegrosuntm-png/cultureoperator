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

  const [
    { count: total },
    { count: active },
    { count: inactive },
    { count: leads },
  ] = await Promise.all([
    supabase.from('members').select('*', { count: 'exact', head: true }).eq('gym_id', gymId),
    supabase.from('members').select('*', { count: 'exact', head: true }).eq('gym_id', gymId).eq('status', 'active'),
    supabase.from('members').select('*', { count: 'exact', head: true }).eq('gym_id', gymId).eq('status', 'inactive'),
    supabase.from('members').select('*', { count: 'exact', head: true }).eq('gym_id', gymId).eq('status', 'lead'),
  ])

  const mrr = (active ?? 0) * MRR_PER_ACTIVE
  const mrrFormatted = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(mrr)

  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  })

  const stats = [
    {
      label: 'Total Members',
      value: total ?? 0,
      sub: 'in your gym',
      href: '/dashboard/members',
    },
    {
      label: 'Active',
      value: active ?? 0,
      sub: 'paying members',
      href: '/dashboard/members?status=active',
      accent: true,
    },
    {
      label: 'Inactive',
      value: inactive ?? 0,
      sub: 'win-back opportunity',
      href: '/dashboard/members?status=inactive',
    },
    {
      label: 'Leads',
      value: leads ?? 0,
      sub: 'in your pipeline',
      href: '/dashboard/members?status=lead',
    },
  ]

  const actions = [
    {
      n: '01',
      title: 'Work your leads.',
      body: `${leads ?? 0} people are in your pipeline. Even converting 20% at $160/mo adds ${formatDelta((leads ?? 0) * 0.2)} in MRR.`,
      cta: 'View leads',
      href: '/dashboard/members?status=lead',
    },
    {
      n: '02',
      title: 'Win back inactive members.',
      body: `${inactive ?? 0} members have gone quiet. A personal message to your top 10 is worth more than any promotion.`,
      cta: 'View inactive',
      href: '/dashboard/members?status=inactive',
    },
    {
      n: '03',
      title: 'Schedule your next class.',
      body: 'Consistent programming keeps active members from churning. Get next week on the calendar now.',
      cta: 'Add a class',
      href: '/dashboard/classes',
    },
  ]

  return (
    <div className="min-h-full bg-bone">
      {/* Top bar */}
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

        {/* ── MRR Hero ────────────────────────────────────────────────────── */}
        <div className="bg-ink p-10 flex flex-col sm:flex-row sm:items-end justify-between gap-6">
          <div>
            <p className="text-xs tracking-widest uppercase text-gold font-semibold mb-4">
              Estimated Monthly Recurring Revenue
            </p>
            <p className="font-serif text-7xl sm:text-8xl font-bold text-bone leading-none">
              {mrrFormatted}
            </p>
            <p className="text-bone/40 text-sm mt-4 font-light">
              {active ?? 0} active members × ${MRR_PER_ACTIVE}/mo
            </p>
          </div>
          <div className="border border-bone/10 px-8 py-6 shrink-0">
            <p className="text-xs tracking-widest uppercase text-bone/30 font-medium mb-1">
              Annual Run Rate
            </p>
            <p className="font-serif text-3xl font-bold text-bone">
              {new Intl.NumberFormat('en-US', {
                style: 'currency',
                currency: 'USD',
                maximumFractionDigits: 0,
              }).format(mrr * 12)}
            </p>
          </div>
        </div>

        {/* ── Stat tiles ──────────────────────────────────────────────────── */}
        <div>
          <p className="text-xs tracking-widest uppercase text-ink-muted font-medium mb-5">
            Membership Breakdown
          </p>
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

        {/* ── Action items ─────────────────────────────────────────────────── */}
        <div>
          <div className="flex items-end justify-between mb-5">
            <p className="text-xs tracking-widest uppercase text-ink-muted font-medium">
              Focus Areas
            </p>
            <div className="h-px flex-1 mx-6 bg-bone-deeper" />
            <p className="text-xs text-ink-muted font-light">Three things to move the needle</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-px bg-bone-deeper border border-bone-deeper">
            {actions.map(({ n, title, body, cta, href }) => (
              <div key={n} className="bg-bone p-8 flex flex-col justify-between gap-8 group hover:bg-bone-dark transition-colors">
                <div>
                  <span className="font-serif text-5xl font-bold text-bone-deeper select-none leading-none">
                    {n}
                  </span>
                  <h3 className="font-serif text-xl font-bold text-ink mt-4 mb-3 leading-tight">
                    {title}
                  </h3>
                  <p className="text-ink-muted text-sm leading-relaxed font-light">
                    {body}
                  </p>
                </div>
                <Link
                  href={href}
                  className="inline-flex items-center gap-2 text-xs tracking-widest uppercase font-semibold text-gold hover:text-gold-dark transition-colors"
                >
                  <span className="w-4 h-px bg-gold group-hover:w-6 transition-all" />
                  {cta}
                </Link>
              </div>
            ))}
          </div>
        </div>

        {/* ── Editorial footer note ────────────────────────────────────────── */}
        <div className="flex items-center gap-4 pt-2">
          <div className="h-px flex-1 bg-bone-deeper" />
          <p className="text-xs text-ink-muted font-light tracking-wide">
            Revenue estimates based on Performance tier pricing · {new Date().getFullYear()}
          </p>
          <div className="h-px flex-1 bg-bone-deeper" />
        </div>

      </div>
    </div>
  )
}

function formatDelta(n: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(Math.round(n) * MRR_PER_ACTIVE)
}
