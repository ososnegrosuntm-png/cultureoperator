import { createClient } from '@/lib/supabase/server'
import { redirect }     from 'next/navigation'
import Link             from 'next/link'

export const dynamic = 'force-dynamic'

const PLAN_LABELS: Record<string, string> = {
  starter: 'Starter',
  pro:     'Pro',
  network: 'Network',
}

export default async function BillingSuccessPage({
  searchParams,
}: {
  searchParams: { plan?: string; session_id?: string }
}) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const plan  = searchParams.plan ?? 'starter'
  const label = PLAN_LABELS[plan] ?? 'Starter'

  return (
    <div className="min-h-full bg-bone flex items-center justify-center px-6">
      <div className="max-w-md w-full text-center">

        {/* Icon */}
        <div className="w-16 h-16 bg-ink rounded-full flex items-center justify-center mx-auto mb-6">
          <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
            <path d="M5 14L10.5 20L23 8" stroke="#b8904a" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>

        {/* Heading */}
        <h1 className="font-serif text-3xl font-bold text-ink tracking-wide">
          Welcome to <span className="text-gold">{label}</span>
        </h1>
        <p className="text-sm text-ink-muted mt-3 leading-relaxed">
          Your subscription is active. CultureOperator is now fully unlocked for your gym.
          Your team will receive access within minutes.
        </p>

        {/* Plan badge */}
        <div className="mt-8 border border-bone-deeper bg-white/60 p-6 text-left">
          <p className="text-[10px] tracking-widest uppercase text-ink-muted font-medium mb-4">
            Active Plan
          </p>
          <div className="flex items-baseline gap-3">
            <span className="font-serif text-2xl font-bold text-ink">{label}</span>
            <span className="text-xs tracking-widest uppercase text-gold font-medium">
              {plan === 'starter' ? '$149/mo' : plan === 'pro' ? '$349/mo' : '$749/mo'}
            </span>
          </div>
          <p className="text-xs text-ink-muted mt-2">
            {plan === 'starter' && 'Up to 100 members · ATLAS + IRON coaches · In-app messaging'}
            {plan === 'pro'     && 'Up to 300 members · All 6 Syndicate coaches · Analytics + Campaigns'}
            {plan === 'network' && 'Unlimited members · All features · Multi-location support · Priority support'}
          </p>
        </div>

        {/* CTA */}
        <div className="mt-8 flex flex-col gap-3">
          <Link
            href="/dashboard"
            className="inline-block bg-ink text-bone text-xs tracking-widest uppercase font-semibold px-8 py-3.5 hover:bg-ink/90 transition-colors"
          >
            Go to Dashboard
          </Link>
          <Link
            href="/dashboard/syndicate"
            className="inline-block border border-bone-deeper text-ink text-xs tracking-widest uppercase font-medium px-8 py-3 hover:bg-bone-dark transition-colors"
          >
            Open The Syndicate
          </Link>
        </div>

      </div>
    </div>
  )
}
