'use client'

import { useState } from 'react'

type Props = {
  isOwner: boolean
  userEmail: string
}

type PlanKey = 'starter' | 'pro' | 'network'

const PLANS: {
  key: PlanKey
  name: string
  price: number
  tagline: string
  highlight: boolean
  features: string[]
  limit: string
}[] = [
  {
    key:      'starter',
    name:     'Starter',
    price:    149,
    tagline:  'Everything you need to run a focused, high-quality gym.',
    highlight: false,
    limit:    'Up to 100 members',
    features: [
      'ATLAS — Daily workout programming',
      'IRON — Discipline & streak tracking',
      'In-app messaging (coach → member)',
      'Member check-in dashboard',
      'Member invite system',
      'Check-in analytics',
      'Email support',
    ],
  },
  {
    key:      'pro',
    name:     'Pro',
    price:    349,
    tagline:  'The full Syndicate. Built for gyms that operate at a higher level.',
    highlight: true,
    limit:    'Up to 300 members',
    features: [
      'Everything in Starter',
      'FORGE — Nutrition coaching',
      'HAVEN — Recovery protocols',
      'APEX — Business intelligence',
      'COMPASS — Daily synthesis briefs',
      'SMS campaigns',
      'MailChimp integration',
      'Retention analytics + churn alerts',
      'Priority support',
    ],
  },
  {
    key:      'network',
    name:     'Network',
    price:    749,
    tagline:  'Multi-location. Unlimited scale. The operating system for gym networks.',
    highlight: false,
    limit:    'Unlimited members',
    features: [
      'Everything in Pro',
      'Multi-location management',
      'Unlimited member seats',
      'Custom branding',
      'API access',
      'Dedicated account manager',
      'SLA uptime guarantee',
      'White-label option',
    ],
  },
]

export function BillingPanel({ isOwner, userEmail }: Props) {
  const [loading, setLoading] = useState<PlanKey | null>(null)
  const [error,   setError]   = useState<string | null>(null)

  async function startCheckout(plan: PlanKey) {
    setError(null)
    setLoading(plan)
    try {
      const res  = await fetch('/api/stripe/checkout', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ plan }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Checkout failed')
      if (data.url) window.location.href = data.url
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(null)
    }
  }

  return (
    <div className="min-h-full bg-bone">

      {/* Header */}
      <div className="bg-ink border-b border-bone/8 px-10 py-8">
        <p className="text-xs tracking-widest uppercase text-gold/50 font-medium">Billing</p>
        <h1 className="font-serif text-3xl font-bold text-bone mt-1">
          Choose Your <span className="text-gold">Plan</span>
        </h1>
        <p className="text-sm text-bone/40 mt-1.5">
          Transparent pricing. Cancel anytime. All plans include a 14-day free trial.
        </p>
      </div>

      <div className="px-10 py-10">

        {/* Non-owner warning */}
        {!isOwner && (
          <div className="mb-8 border border-[#b45454]/30 bg-[#b45454]/5 px-6 py-4">
            <p className="text-xs text-[#b45454] font-medium">
              Only gym owners can manage billing. Contact your gym owner to upgrade.
            </p>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="mb-8 border border-[#b45454]/30 bg-[#b45454]/5 px-6 py-4">
            <p className="text-xs text-[#b45454] font-medium">{error}</p>
          </div>
        )}

        {/* Plan grid */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {PLANS.map(plan => (
            <div
              key={plan.key}
              className={`relative flex flex-col border ${
                plan.highlight
                  ? 'border-gold bg-ink text-bone'
                  : 'border-bone-deeper bg-white/60 text-ink'
              }`}
            >
              {/* Popular badge */}
              {plan.highlight && (
                <div className="absolute -top-px left-6">
                  <span className="bg-gold text-ink text-[9px] font-bold tracking-widest uppercase px-3 py-1 inline-block">
                    Most Popular
                  </span>
                </div>
              )}

              {/* Plan header */}
              <div className={`px-7 pt-8 pb-6 border-b ${plan.highlight ? 'border-bone/10' : 'border-bone-deeper'}`}>
                <p className={`font-serif text-2xl font-bold tracking-wide ${plan.highlight ? 'text-gold' : 'text-ink'}`}>
                  {plan.name}
                </p>
                <p className={`text-[10px] tracking-widest uppercase font-medium mt-0.5 ${plan.highlight ? 'text-bone/40' : 'text-ink-muted'}`}>
                  {plan.limit}
                </p>
                <div className="flex items-baseline gap-1.5 mt-5">
                  <span className={`font-serif text-4xl font-bold ${plan.highlight ? 'text-bone' : 'text-ink'}`}>
                    ${plan.price}
                  </span>
                  <span className={`text-xs font-medium ${plan.highlight ? 'text-bone/50' : 'text-ink-muted'}`}>
                    / month
                  </span>
                </div>
                <p className={`text-xs leading-relaxed mt-3 ${plan.highlight ? 'text-bone/60' : 'text-ink-muted'}`}>
                  {plan.tagline}
                </p>
              </div>

              {/* Features */}
              <div className="px-7 py-6 flex-1">
                <ul className="space-y-3">
                  {plan.features.map((f, i) => (
                    <li key={i} className="flex items-start gap-2.5">
                      <svg
                        width="13" height="13" viewBox="0 0 13 13" fill="none"
                        className={`mt-0.5 shrink-0 ${plan.highlight ? 'text-gold' : 'text-gold'}`}
                      >
                        <path d="M2 6.5L5 9.5L11 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                      <span className={`text-xs leading-relaxed ${
                        f.startsWith('Everything') && !plan.highlight
                          ? 'font-medium text-ink'
                          : plan.highlight ? 'text-bone/70' : 'text-ink-muted'
                      }`}>
                        {f}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* CTA */}
              <div className="px-7 pb-7">
                <button
                  onClick={() => startCheckout(plan.key)}
                  disabled={!isOwner || loading !== null}
                  className={`w-full py-3.5 text-xs tracking-widest uppercase font-bold transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                    plan.highlight
                      ? 'bg-gold text-ink hover:bg-gold/90'
                      : 'bg-ink text-bone hover:bg-ink/90'
                  }`}
                >
                  {loading === plan.key
                    ? 'Redirecting…'
                    : `Start ${plan.name}`}
                </button>
                <p className={`text-[10px] text-center mt-2.5 ${plan.highlight ? 'text-bone/30' : 'text-ink-muted/60'}`}>
                  14-day free trial &middot; Cancel anytime
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Footer notes */}
        <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-3">
          {[
            { title: 'Secure Payments', body: 'All transactions processed by Stripe. We never store your card details.' },
            { title: 'Cancel Anytime',  body: 'No lock-in contracts. Downgrade or cancel from your billing portal at any time.' },
            { title: 'Instant Access',  body: 'Your plan activates the moment payment clears. No waiting, no manual provisioning.' },
          ].map(({ title, body }) => (
            <div key={title} className="border border-bone-deeper p-5 bg-white/40">
              <p className="text-xs font-semibold text-ink mb-1.5">{title}</p>
              <p className="text-xs text-ink-muted leading-relaxed">{body}</p>
            </div>
          ))}
        </div>

        {/* Logged in as */}
        <p className="text-[11px] text-ink-muted/50 text-center mt-8">
          Logged in as {userEmail}
        </p>

      </div>
    </div>
  )
}
