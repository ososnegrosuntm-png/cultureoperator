import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@/lib/supabase/server'

// Price IDs are looked up by plan slug — set real Stripe Price IDs in env once created
const PLAN_MAP: Record<string, { name: string; amount: number; interval: 'month' }> = {
  starter: { name: 'Starter',  amount: 14900, interval: 'month' },
  pro:     { name: 'Pro',      amount: 34900, interval: 'month' },
  network: { name: 'Network',  amount: 74900, interval: 'month' },
}

export async function POST(req: Request) {
  try {
    const stripeKey = process.env.STRIPE_SECRET_KEY
    if (!stripeKey) {
      return NextResponse.json({ error: 'STRIPE_SECRET_KEY not configured' }, { status: 500 })
    }

    // ── Auth ────────────────────────────────────────────────────────────────
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: profileRaw } = await supabase
      .from('profiles')
      .select('full_name, gym_id, role')
      .eq('id', user.id)
      .single()

    const profile = profileRaw as {
      full_name: string | null
      gym_id: string | null
      role: string | null
    } | null

    if (profile?.role !== 'owner') {
      return NextResponse.json({ error: 'Only gym owners can manage billing' }, { status: 403 })
    }

    // ── Parse body ──────────────────────────────────────────────────────────
    let plan: string
    try {
      const body = await req.json()
      plan = body.plan
      if (!plan || !PLAN_MAP[plan]) throw new Error()
    } catch {
      return NextResponse.json({ error: 'Invalid plan' }, { status: 400 })
    }

    const planConfig = PLAN_MAP[plan]
    const stripe     = new Stripe(stripeKey)
    const origin     = new URL(req.url).origin

    // ── Check if a Stripe Price ID is set in env ────────────────────────────
    // Env var pattern: STRIPE_PRICE_STARTER, STRIPE_PRICE_PRO, STRIPE_PRICE_NETWORK
    const envPriceId = process.env[`STRIPE_PRICE_${plan.toUpperCase()}`]

    let priceId: string

    if (envPriceId) {
      // Use pre-created Stripe Price ID from env
      priceId = envPriceId
    } else {
      // Create a Price on the fly (good for dev/testing)
      const product = await stripe.products.create({
        name: `CultureOperator ${planConfig.name}`,
        metadata: { plan, gym_id: profile.gym_id ?? '' },
      })
      const price = await stripe.prices.create({
        product:    product.id,
        unit_amount: planConfig.amount,
        currency:   'usd',
        recurring:  { interval: planConfig.interval },
      })
      priceId = price.id
    }

    // ── Create checkout session ─────────────────────────────────────────────
    const session = await stripe.checkout.sessions.create({
      mode:               'subscription',
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${origin}/dashboard/billing/success?session_id={CHECKOUT_SESSION_ID}&plan=${plan}`,
      cancel_url:  `${origin}/dashboard/billing`,
      customer_email: user.email ?? undefined,
      metadata: {
        user_id: user.id,
        gym_id:  profile.gym_id ?? '',
        plan,
      },
      subscription_data: {
        metadata: {
          user_id: user.id,
          gym_id:  profile.gym_id ?? '',
          plan,
        },
      },
    })

    return NextResponse.json({ url: session.url })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[stripe/checkout] error:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
