import Link from "next/link";

const performanceCode = [
  {
    number: "01",
    title: "Precision Over Volume",
    body: "Every rep, every set, every movement is programmed with intent. We don't believe in junk volume — we believe in deliberate, measurable work that compounds.",
  },
  {
    number: "02",
    title: "Data-Driven Progress",
    body: "Your performance is tracked, analyzed, and optimized every week. No guesswork. No plateaus. Just a relentless upward trajectory.",
  },
  {
    number: "03",
    title: "Coached Accountability",
    body: "You are never just a membership number. Every CULTURE member has a dedicated coach who knows your history, your goals, and exactly how hard to push you.",
  },
  {
    number: "04",
    title: "Recovery as Performance",
    body: "Sleep protocols, mobility work, and nutrition timing are built into your program. We train you to be elite 24 hours a day — not just the hour you're here.",
  },
];

const tiers = [
  {
    name: "Foundation",
    price: "$99",
    period: "/mo",
    tagline: "Build the base.",
    features: [
      "Unlimited open gym access",
      "Monthly programming drop",
      "Progress tracking dashboard",
      "Community group access",
      "2 coach check-ins per month",
    ],
    cta: "Start Foundation",
    highlighted: false,
  },
  {
    name: "Performance",
    price: "$160",
    period: "/mo",
    tagline: "The full system.",
    features: [
      "Everything in Foundation",
      "Weekly 1-on-1 coaching session",
      "Custom nutrition framework",
      "Priority class booking",
      "Body composition assessments",
      "Recovery protocol access",
    ],
    cta: "Join Performance",
    highlighted: true,
  },
  {
    name: "Elite",
    price: "$220",
    period: "/mo",
    tagline: "No ceiling.",
    features: [
      "Everything in Performance",
      "Unlimited 1-on-1 coaching",
      "Daily check-ins via app",
      "Quarterly performance labs",
      "Guest passes (4/mo)",
      "Concierge scheduling",
    ],
    cta: "Go Elite",
    highlighted: false,
  },
];

export default function HomePage() {
  return (
    <div className="bg-bone text-ink font-sans">

      {/* NAV */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-bone/90 backdrop-blur-sm border-b border-bone-deeper">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <span className="font-serif text-xl font-bold tracking-wide text-ink">
            CULTUR<span className="text-gold">E</span>
          </span>
          <nav className="hidden md:flex items-center gap-8 text-sm font-medium tracking-wide text-ink-muted">
            <a href="#performance-code" className="hover:text-ink transition-colors">The Code</a>
            <a href="#challenge" className="hover:text-ink transition-colors">6-Week Challenge</a>
            <a href="#pricing" className="hover:text-ink transition-colors">Membership</a>
          </nav>
          <Link
            href="/signup"
            className="text-sm font-semibold tracking-wide bg-ink text-bone px-5 py-2.5 hover:bg-ink-light transition-colors"
          >
            Apply Now
          </Link>
        </div>
      </header>

      {/* HERO */}
      <section className="min-h-screen flex flex-col justify-center pt-16 px-6">
        <div className="max-w-6xl mx-auto w-full grid lg:grid-cols-2 gap-16 items-center py-24">
          <div>
            <p className="text-xs font-semibold tracking-widest2 text-gold uppercase mb-6">
              Performance Center · Est. 2024
            </p>
            <h1 className="font-serif text-6xl sm:text-7xl lg:text-8xl font-bold leading-[0.95] tracking-tight text-ink mb-8">
              Not a gym.<br />
              <em className="not-italic text-gold">A Performance</em><br />
              Center.
            </h1>
            <p className="text-lg text-ink-muted leading-relaxed max-w-lg mb-10 font-light">
              We don&apos;t train bodies. We engineer elite humans. Through precision
              programming, relentless coaching, and a culture that refuses mediocrity —
              CULTURE exists for those who demand more from themselves.
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <Link
                href="/signup"
                className="inline-flex items-center justify-center bg-ink text-bone text-sm font-semibold tracking-wide px-8 py-4 hover:bg-ink-light transition-colors"
              >
                Apply for Membership
              </Link>
              <a
                href="#challenge"
                className="inline-flex items-center justify-center border border-ink text-ink text-sm font-semibold tracking-wide px-8 py-4 hover:bg-bone-dark transition-colors"
              >
                See the 6-Week Challenge
              </a>
            </div>
          </div>

          {/* editorial stat block */}
          <div className="hidden lg:grid grid-cols-2 gap-px bg-bone-deeper border border-bone-deeper">
            {[
              { stat: "847", label: "Members Transformed" },
              { stat: "94%", label: "Goal Achievement Rate" },
              { stat: "6 wks", label: "To See Real Results" },
              { stat: "1:8", label: "Coach-to-Member Ratio" },
            ].map(({ stat, label }) => (
              <div key={label} className="bg-bone p-10 flex flex-col justify-between gap-4">
                <span className="font-serif text-5xl font-bold text-ink">{stat}</span>
                <span className="text-xs tracking-widest uppercase text-ink-muted font-medium">{label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* scroll indicator */}
        <div className="max-w-6xl mx-auto w-full pb-10 flex items-center gap-4">
          <div className="h-px flex-1 bg-bone-deeper" />
          <span className="text-xs tracking-widest uppercase text-ink-muted">Scroll</span>
          <div className="h-px flex-1 bg-bone-deeper" />
        </div>
      </section>

      {/* MANIFESTO BAND */}
      <section className="bg-ink py-20 px-6 overflow-hidden">
        <div className="max-w-6xl mx-auto">
          <p className="font-serif text-3xl sm:text-4xl lg:text-5xl text-bone font-medium leading-snug max-w-4xl">
            &ldquo;Average is the enemy. Comfortable is a trap. The only direction
            that matters at CULTURE is{" "}
            <span className="text-gold italic">forward.</span>&rdquo;
          </p>
          <div className="mt-8 flex items-center gap-4">
            <div className="w-8 h-px bg-gold" />
            <span className="text-xs tracking-widest uppercase text-bone/50 font-medium">
              The CULTURE Standard
            </span>
          </div>
        </div>
      </section>

      {/* PERFORMANCE CODE */}
      <section id="performance-code" className="py-28 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="mb-16 flex flex-col sm:flex-row sm:items-end justify-between gap-6">
            <div>
              <p className="text-xs font-semibold tracking-widest2 text-gold uppercase mb-3">
                Our Philosophy
              </p>
              <h2 className="font-serif text-5xl sm:text-6xl font-bold text-ink leading-tight">
                The Performance<br />Code
              </h2>
            </div>
            <p className="text-ink-muted max-w-sm leading-relaxed font-light text-sm">
              Four principles that separate CULTURE members from everyone else.
              Not rules — a way of operating.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 gap-px bg-bone-deeper border border-bone-deeper">
            {performanceCode.map(({ number, title, body }) => (
              <div key={number} className="bg-bone p-10 group hover:bg-bone-dark transition-colors">
                <span className="font-serif text-6xl font-bold text-bone-deeper group-hover:text-bone-deeper/60 transition-colors select-none">
                  {number}
                </span>
                <h3 className="font-serif text-2xl font-bold text-ink mt-4 mb-3">{title}</h3>
                <p className="text-ink-muted leading-relaxed font-light text-sm">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 6-WEEK CHALLENGE */}
      <section id="challenge" className="bg-ink py-28 px-6">
        <div className="max-w-6xl mx-auto grid lg:grid-cols-2 gap-16 items-center">
          <div>
            <p className="text-xs font-semibold tracking-widest2 text-gold uppercase mb-4">
              Limited Enrollment
            </p>
            <h2 className="font-serif text-5xl sm:text-6xl font-bold text-bone leading-tight mb-6">
              The 6-Week<br />
              <span className="text-gold">Transformation</span><br />
              Challenge
            </h2>
            <p className="text-bone/60 leading-relaxed mb-8 font-light">
              Six weeks. One coach. One mission. The CULTURE Challenge is a fully
              guided, all-inclusive program designed to produce measurable results
              in body composition, strength, and mental performance — or your money back.
            </p>
            <ul className="space-y-3 mb-10">
              {[
                "Daily programming tailored to your baseline",
                "Bi-weekly body composition scans",
                "Nutrition tracking & weekly adjustments",
                "Private cohort accountability group",
                "Final performance test & results report",
              ].map((item) => (
                <li key={item} className="flex items-start gap-3 text-sm text-bone/80">
                  <span className="text-gold mt-0.5 shrink-0">—</span>
                  {item}
                </li>
              ))}
            </ul>
            <Link
              href="/signup"
              className="inline-flex items-center gap-3 bg-gold text-ink text-sm font-semibold tracking-wide px-8 py-4 hover:bg-gold-light transition-colors"
            >
              Reserve Your Spot
              <span className="text-base">→</span>
            </Link>
          </div>

          {/* price callout */}
          <div className="border border-bone/10 p-12 flex flex-col gap-6">
            <p className="text-xs tracking-widest uppercase text-bone/40 font-medium">
              Challenge Investment
            </p>
            <div className="flex items-end gap-2">
              <span className="font-serif text-7xl font-bold text-bone leading-none">$597</span>
              <span className="text-bone/40 text-sm mb-2 font-light">one time</span>
            </div>
            <div className="h-px bg-bone/10" />
            <p className="text-bone/50 text-sm font-light leading-relaxed">
              Spots are capped at 20 per cohort to preserve coaching quality.
              Next cohort begins the first Monday of each month.
            </p>
            <div className="mt-2 inline-flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-gold animate-pulse" />
              <span className="text-xs text-gold font-medium tracking-wide">
                6 spots remaining this cohort
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* PRICING */}
      <section id="pricing" className="py-28 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-xs font-semibold tracking-widest2 text-gold uppercase mb-3">
              Membership
            </p>
            <h2 className="font-serif text-5xl sm:text-6xl font-bold text-ink leading-tight mb-4">
              Choose Your Level
            </h2>
            <p className="text-ink-muted max-w-lg mx-auto font-light text-sm leading-relaxed">
              No contracts. No initiation fees. Cancel any time.
              Every tier includes full facility access — the difference is
              the depth of coaching.
            </p>
          </div>

          <div className="grid sm:grid-cols-3 gap-px bg-bone-deeper border border-bone-deeper">
            {tiers.map(({ name, price, period, tagline, features, cta, highlighted }) => (
              <div
                key={name}
                className={`flex flex-col p-10 transition-colors ${
                  highlighted
                    ? "bg-ink text-bone"
                    : "bg-bone hover:bg-bone-dark"
                }`}
              >
                {highlighted && (
                  <span className="text-xs tracking-widest uppercase text-gold font-semibold mb-4">
                    Most Popular
                  </span>
                )}
                <p
                  className={`font-serif text-2xl font-bold mb-1 ${
                    highlighted ? "text-bone" : "text-ink"
                  }`}
                >
                  {name}
                </p>
                <p
                  className={`text-xs tracking-widest uppercase mb-8 font-medium ${
                    highlighted ? "text-bone/50" : "text-ink-muted"
                  }`}
                >
                  {tagline}
                </p>

                <div className="flex items-end gap-1 mb-8">
                  <span
                    className={`font-serif text-6xl font-bold leading-none ${
                      highlighted ? "text-bone" : "text-ink"
                    }`}
                  >
                    {price}
                  </span>
                  <span
                    className={`text-sm mb-2 font-light ${
                      highlighted ? "text-bone/50" : "text-ink-muted"
                    }`}
                  >
                    {period}
                  </span>
                </div>

                <div
                  className={`h-px mb-8 ${highlighted ? "bg-bone/10" : "bg-bone-deeper"}`}
                />

                <ul className="space-y-3 mb-10 flex-1">
                  {features.map((f) => (
                    <li key={f} className="flex items-start gap-3 text-sm">
                      <span className={`shrink-0 mt-0.5 ${highlighted ? "text-gold" : "text-gold"}`}>—</span>
                      <span className={highlighted ? "text-bone/80" : "text-ink-muted"}>{f}</span>
                    </li>
                  ))}
                </ul>

                <Link
                  href="/signup"
                  className={`text-center text-sm font-semibold tracking-wide px-6 py-3.5 transition-colors ${
                    highlighted
                      ? "bg-gold text-ink hover:bg-gold-light"
                      : "border border-ink text-ink hover:bg-bone-deeper"
                  }`}
                >
                  {cta}
                </Link>
              </div>
            ))}
          </div>

          <p className="text-center text-xs text-ink-muted mt-6 font-light">
            All memberships are month-to-month. Cancel with 7 days notice. No hidden fees.
          </p>
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="bg-ink py-28 px-6">
        <div className="max-w-3xl mx-auto text-center">
          <p className="text-xs font-semibold tracking-widest2 text-gold uppercase mb-6">
            The Decision
          </p>
          <h2 className="font-serif text-5xl sm:text-6xl font-bold text-bone leading-tight mb-6">
            The version of you<br />
            that you respect most<br />
            <em className="not-italic text-gold">trains here.</em>
          </h2>
          <p className="text-bone/50 mb-10 font-light leading-relaxed">
            Membership is by application. We work with people who are serious
            about their transformation and ready to commit. If that&apos;s you —
            we want to hear from you.
          </p>
          <Link
            href="/signup"
            className="inline-flex items-center gap-3 bg-gold text-ink text-sm font-semibold tracking-wide px-10 py-4 hover:bg-gold-light transition-colors"
          >
            Apply for Membership
            <span className="text-base">→</span>
          </Link>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-bone-deeper py-10 px-6">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <span className="font-serif text-lg font-bold tracking-wide text-ink">
            CULTUR<span className="text-gold">E</span>
          </span>
          <div className="flex items-center gap-8 text-xs tracking-widest uppercase text-ink-muted font-medium">
            <a href="#performance-code" className="hover:text-ink transition-colors">The Code</a>
            <a href="#challenge" className="hover:text-ink transition-colors">Challenge</a>
            <a href="#pricing" className="hover:text-ink transition-colors">Membership</a>
            <Link href="/login" className="hover:text-ink transition-colors">Sign In</Link>
          </div>
          <p className="text-xs text-ink-muted font-light">
            © {new Date().getFullYear()} CULTURE Performance Center
          </p>
        </div>
      </footer>

    </div>
  );
}
