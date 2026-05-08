'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

// ── Types ─────────────────────────────────────────────────────────────────────
export type MemberInsight = {
  profileId: string
  name: string
  daysSinceLast: number | null
  checkInsThisMonth: number
  checkInsLast7Days: number
  atlasIntensity: 'easy' | 'moderate' | 'hard'
  atlasMessage: string
  streak: number
  disciplineScore: number
  ironMessage: string
  nutritionScore: number
  weeklyNutritionCompliance: number
  forgeMessage: string
  recoveryScore: number
  overtrained: boolean
  deloadNeeded: boolean
  havenMessage: string
  compassMessage: string
}

export type GymInsight = {
  totalMembers: number
  activeThisMonth: number
  churningMembers: { profileId: string; name: string; daysSinceLast: number }[]
  estimatedMRR: number
  lastMonthMRR: number
  mrrGrowth: number
  unconvertedLeads: number
}

type Props = {
  currentUserId: string
  gymId: string
  members: MemberInsight[]
  gymInsight: GymInsight
}

type SendState = 'idle' | 'sending' | 'sent' | 'error'
type CoachKey = 'atlas' | 'iron' | 'forge' | 'haven' | 'apex' | 'compass'

// ── Helpers ───────────────────────────────────────────────────────────────────
function initials(name: string) {
  return name.split(' ').map(w => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase()
}

function fmt(n: number) {
  return n >= 1000 ? `$${(n / 1000).toFixed(1)}k` : `$${n}`
}

// ── Shared sub-components ─────────────────────────────────────────────────────
function IntensityBadge({ level }: { level: 'easy' | 'moderate' | 'hard' }) {
  const styles = {
    easy:     'bg-gold/10 text-gold',
    moderate: 'bg-bone-deeper text-ink-muted border border-bone-deeper',
    hard:     'bg-[#b45454]/10 text-[#b45454]',
  }
  return (
    <span className={`text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 ${styles[level]}`}>
      {level}
    </span>
  )
}

function ScoreBadge({ score, suffix = '/100' }: { score: number; suffix?: string }) {
  const color = score >= 70 ? 'text-gold' : score >= 40 ? 'text-ink' : 'text-ink-muted'
  return (
    <span className={`font-serif text-lg font-bold ${color}`}>
      {score}<span className="text-xs font-sans font-normal text-ink-muted">{suffix}</span>
    </span>
  )
}

function Pill({ label, color = 'bone' }: { label: string; color?: 'gold' | 'red' | 'bone' }) {
  const c = color === 'gold' ? 'bg-gold/10 text-gold' : color === 'red' ? 'bg-[#b45454]/10 text-[#b45454]' : 'bg-bone-deeper text-ink-muted'
  return <span className={`text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 ${c}`}>{label}</span>
}

// ── Coach section wrapper ─────────────────────────────────────────────────────
function CoachSection({
  code, role, tagline, description, accentClass, icon, children,
}: {
  code: string; role: string; tagline: string; description: string
  accentClass: string; icon: React.ReactNode; children: React.ReactNode
}) {
  return (
    <div className="border border-bone-deeper">
      <div className="bg-ink px-8 py-6 flex items-start gap-6">
        <div className={`w-11 h-11 flex items-center justify-center shrink-0 ${accentClass} border border-current/20`}>
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-3">
            <h3 className={`font-serif text-2xl font-bold tracking-wide ${accentClass}`}>{code}</h3>
            <span className="text-xs tracking-widest uppercase text-bone/40 font-medium">{role}</span>
          </div>
          <p className="text-xs text-bone/50 italic mt-1">&ldquo;{tagline}&rdquo;</p>
          <p className="text-xs text-bone/40 mt-2 leading-relaxed max-w-xl">{description}</p>
        </div>
      </div>
      {children}
    </div>
  )
}

// ── Advisor block ─────────────────────────────────────────────────────────────
function AdvisorBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-ink/5 border-b border-bone-deeper">
      <div className="px-8 py-5">
        <p className="text-[10px] tracking-widest uppercase font-semibold text-gold mb-4">{title}</p>
        {children}
      </div>
    </div>
  )
}

function AdvisorRow({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="flex items-start gap-3 mb-3 last:mb-0">
      <span className="text-[10px] tracking-widest uppercase text-ink-muted font-medium w-36 shrink-0 pt-0.5">{label}</span>
      <span className={`text-xs leading-relaxed ${accent ? 'text-gold font-medium' : 'text-ink'}`}>{value}</span>
    </div>
  )
}

// ── Weekly program toggle ─────────────────────────────────────────────────────
function WeeklyBlock({
  label, children, onSendAll, sending,
}: {
  label: string; children: React.ReactNode
  onSendAll: () => void; sending: boolean
}) {
  const [open, setOpen] = useState(false)
  return (
    <div className="border-b border-bone-deeper">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-8 py-3.5 hover:bg-bone-dark transition-colors bg-bone text-left"
      >
        <span className="text-[10px] tracking-widest uppercase font-semibold text-ink-muted">{label}</span>
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className={`text-ink-muted transition-transform ${open ? 'rotate-180' : ''}`}>
          <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>
      {open && (
        <div className="bg-bone px-8 pb-6">
          {children}
          <button
            onClick={onSendAll}
            disabled={sending}
            className="mt-5 text-[10px] tracking-widest uppercase font-semibold bg-ink text-bone px-5 py-2.5 hover:bg-ink/90 transition-colors disabled:opacity-40"
          >
            {sending ? 'Sending…' : 'Send to All Members'}
          </button>
        </div>
      )}
    </div>
  )
}

// ── Day card ──────────────────────────────────────────────────────────────────
function DayCard({ day, name, content }: { day: string; name: string; content: React.ReactNode }) {
  return (
    <div className="border border-bone-deeper p-4 bg-white/40">
      <div className="flex items-baseline gap-2 mb-2">
        <span className="text-[9px] font-bold tracking-widest uppercase text-ink-muted">{day}</span>
        <span className="text-xs font-semibold text-ink">{name}</span>
      </div>
      {content}
    </div>
  )
}

function ScaleRow({ level, text }: { level: string; text: string }) {
  const c = level === 'Beginner' ? 'text-gold' : level === 'Intermediate' ? 'text-ink' : 'text-[#b45454]'
  return (
    <div className="flex gap-2 text-xs leading-snug mt-1">
      <span className={`font-semibold shrink-0 w-24 ${c}`}>{level}</span>
      <span className="text-ink-muted">{text}</span>
    </div>
  )
}

// ── Controls bar ──────────────────────────────────────────────────────────────
function ControlsBar({
  search, setSearch, count, sentCount, onSendAll, sending, label,
}: {
  search: string; setSearch: (v: string) => void; count: number; sentCount: number
  onSendAll: () => void; sending: boolean; label: string
}) {
  return (
    <div className="px-6 py-3 border-b border-bone-deeper flex items-center gap-4 bg-bone">
      <div className="relative flex-1 max-w-64">
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted/50" width="12" height="12" viewBox="0 0 14 14" fill="none">
          <circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1.3"/>
          <path d="M9.5 9.5L13 13" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
        </svg>
        <input
          type="text" value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search members…"
          className="w-full pl-8 pr-3 py-1.5 text-xs bg-bone-dark border border-bone-deeper text-ink placeholder:text-ink-muted/50 focus:outline-none focus:border-gold transition-colors"
        />
      </div>
      <p className="text-xs text-ink-muted ml-auto">
        {count} members{sentCount > 0 && ` · ${sentCount} sent`}
      </p>
      <button
        onClick={onSendAll} disabled={sending}
        className="text-[10px] tracking-widest uppercase font-semibold bg-ink text-bone px-4 py-2 hover:bg-ink/90 transition-colors disabled:opacity-40"
      >
        {sending ? 'Sending…' : `Send All (${count})`}
      </button>
      <span className="text-[10px] tracking-widest uppercase font-semibold text-ink-muted ml-1">{label}</span>
    </div>
  )
}

// ── Main panel ────────────────────────────────────────────────────────────────
export function SyndicatePanel({ currentUserId, gymId, members, gymInsight }: Props) {
  const supabase = createClient()

  // Send states per coach
  const [states, setStates] = useState<Record<CoachKey, Record<string, SendState>>>({
    atlas: {}, iron: {}, forge: {}, haven: {}, apex: {}, compass: {},
  })
  const [sendingAll, setSendingAll] = useState<CoachKey | 'all' | null>(null)
  const [weekSending, setWeekSending] = useState<CoachKey | null>(null)

  // Search per coach
  const [search, setSearch] = useState<Record<CoachKey, string>>({
    atlas: '', iron: '', forge: '', haven: '', apex: '', compass: '',
  })

  function setCoachSearch(coach: CoachKey, val: string) {
    setSearch(p => ({ ...p, [coach]: val }))
  }

  // ── Send helpers ────────────────────────────────────────────────────────
  function msgFor(m: MemberInsight, coach: CoachKey): string {
    if (coach === 'atlas')   return m.atlasMessage
    if (coach === 'iron')    return m.ironMessage
    if (coach === 'forge')   return m.forgeMessage
    if (coach === 'haven')   return m.havenMessage
    return m.compassMessage
  }

  async function sendOne(profileId: string, body: string, coach: CoachKey) {
    setStates(p => ({ ...p, [coach]: { ...p[coach], [profileId]: 'sending' } }))
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any).from('messages').insert({
      gym_id: gymId, sender_id: currentUserId, recipient_id: profileId, body, read: false,
    })
    setStates(p => ({ ...p, [coach]: { ...p[coach], [profileId]: error ? 'error' : 'sent' } }))
  }

  async function sendAllCoach(coach: CoachKey, list: MemberInsight[]) {
    setSendingAll(coach)
    const pending = list.filter(m => {
      const st = states[coach][m.profileId]
      return !st || st === 'idle' || st === 'error'
    })
    setStates(p => {
      const next = { ...p[coach] }
      pending.forEach(m => { next[m.profileId] = 'sending' })
      return { ...p, [coach]: next }
    })
    for (const m of pending) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any).from('messages').insert({
        gym_id: gymId, sender_id: currentUserId, recipient_id: m.profileId,
        body: msgFor(m, coach), read: false,
      })
      setStates(p => ({ ...p, [coach]: { ...p[coach], [m.profileId]: error ? 'error' : 'sent' } }))
    }
    setSendingAll(null)
  }

  async function sendWeeklyAll(coach: CoachKey, buildMsg: (m: MemberInsight) => string) {
    setWeekSending(coach)
    for (const m of members) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any).from('messages').insert({
        gym_id: gymId, sender_id: currentUserId, recipient_id: m.profileId,
        body: buildMsg(m), read: false,
      })
    }
    setWeekSending(null)
  }

  async function sendAllDaily() {
    setSendingAll('all')
    for (const m of members) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any).from('messages').insert({
        gym_id: gymId, sender_id: currentUserId, recipient_id: m.profileId,
        body: m.compassMessage, read: false,
      })
    }
    setSendingAll(null)
  }

  function SendBtn({ profileId, body, coach }: { profileId: string; body: string; coach: CoachKey }) {
    const st = states[coach][profileId] ?? 'idle'
    if (st === 'sent')    return <span className="text-[10px] font-semibold text-gold tracking-wide">Sent ✓</span>
    if (st === 'error')   return <span className="text-[10px] font-semibold text-[#b45454] tracking-wide">Failed</span>
    if (st === 'sending') return <span className="text-[10px] text-ink-muted tracking-wide">Sending&hellip;</span>
    return (
      <button
        onClick={() => sendOne(profileId, body, coach)}
        className="text-[10px] tracking-widest uppercase font-semibold text-ink-muted hover:text-gold transition-colors opacity-0 group-hover:opacity-100"
      >
        Send &rarr;
      </button>
    )
  }

  // ── Filtered lists ──────────────────────────────────────────────────────
  function filtered(coach: CoachKey) {
    const q = search[coach].toLowerCase().trim()
    return q ? members.filter(m => m.name.toLowerCase().includes(q)) : members
  }

  // ── Member row generic ──────────────────────────────────────────────────
  function MemberRow({
    m, coach, meta, badge, msg,
  }: {
    m: MemberInsight; coach: CoachKey
    meta: string; badge: React.ReactNode; msg: string
  }) {
    return (
      <div className="flex items-center gap-4 px-6 py-3 hover:bg-bone-dark transition-colors group">
        <div className="w-8 h-8 rounded-full bg-ink flex items-center justify-center shrink-0">
          <span className="text-[9px] font-bold text-bone">{initials(m.name)}</span>
        </div>
        <div className="w-28 shrink-0">
          <p className="text-xs font-semibold text-ink truncate">{m.name}</p>
          <p className="text-[10px] text-ink-muted mt-0.5">{meta}</p>
        </div>
        <div className="shrink-0 w-20">{badge}</div>
        <p className="flex-1 text-xs text-ink-muted truncate min-w-0">{msg}</p>
        <div className="shrink-0 w-16 text-right">
          <SendBtn profileId={m.profileId} body={msg} coach={coach} />
        </div>
      </div>
    )
  }

  // ────────────────────────────────────────────────────────────────────────────
  // ATLAS weekly WOD
  // ────────────────────────────────────────────────────────────────────────────
  const atlasWeeklyWOD = (
    <div className="grid grid-cols-1 gap-3 mt-1 sm:grid-cols-2 lg:grid-cols-3">
      <DayCard day="Monday" name="Strength" content={
        <div>
          <p className="text-xs text-ink mb-2">Back Squat + Deadlift Complex | 40 min | Cap: 45 min</p>
          <ScaleRow level="Beginner"     text="3x8 goblet squat @ 35lb, 3x8 Romanian DL @ bar" />
          <ScaleRow level="Intermediate" text="4x5 back squat @ 65%, 4x5 deadlift @ 70%" />
          <ScaleRow level="Advanced"     text="5x5 back squat @ 80%, 4x3 deadlift @ 85%" />
          <p className="text-[10px] text-ink-muted mt-2 italic">Coach note: Drive through the full foot. No soft lockout at the top.</p>
        </div>
      }/>
      <DayCard day="Tuesday" name="Conditioning" content={
        <div>
          <p className="text-xs text-ink mb-2">AMRAP 20 | Cap: 20 min</p>
          <ScaleRow level="Beginner"     text="200m row, 10 KB swings @26lb, 8 push-ups" />
          <ScaleRow level="Intermediate" text="400m run, 15 KB swings @53lb, 12 push-ups" />
          <ScaleRow level="Advanced"     text="400m run, 20 KB swings @70lb, 15 pull-ups" />
          <p className="text-[10px] text-ink-muted mt-2 italic">Coach note: Sustainable pace first round — do not redline until minute 15.</p>
        </div>
      }/>
      <DayCard day="Wednesday" name="Gymnastics / Skill" content={
        <div>
          <p className="text-xs text-ink mb-2">Skill work + EMOM 15 | Cap: 40 min</p>
          <ScaleRow level="Beginner"     text="Ring rows 3x10, banded pull-aparts, hollow body hold 3x20s" />
          <ScaleRow level="Intermediate" text="Kipping pull-up drills, EMOM: 5 pull-ups + 10 push-ups" />
          <ScaleRow level="Advanced"     text="Muscle-up practice 3x5, EMOM: 3 MUs + 8 HSPU" />
          <p className="text-[10px] text-ink-muted mt-2 italic">Coach note: Perfect reps only. Kip only after you own the strict version.</p>
        </div>
      }/>
      <DayCard day="Thursday" name="Mixed Modal" content={
        <div>
          <p className="text-xs text-ink mb-2">5 Rounds For Time | Cap: 30 min</p>
          <ScaleRow level="Beginner"     text="10 box step-ups, 8 DB thrusters @20lb, 200m walk" />
          <ScaleRow level="Intermediate" text="12 box jumps @24in, 10 barbell thrusters @75lb, 400m run" />
          <ScaleRow level="Advanced"     text="15 box jumps @30in, 10 thrusters @115lb, 400m run" />
          <p className="text-[10px] text-ink-muted mt-2 italic">Coach note: Thrusters unbroken in rounds 1-2. Break when form breaks, never before.</p>
        </div>
      }/>
      <DayCard day="Friday" name="Hero WOD" content={
        <div>
          <p className="text-xs text-ink mb-2">&ldquo;Murph&rdquo; (scaled) | Cap: 60 min</p>
          <ScaleRow level="Beginner"     text="800m run, 50 pull-ups, 100 push-ups, 150 squats, 800m run (partition)" />
          <ScaleRow level="Intermediate" text="1mi run, 100 pull-ups, 200 push-ups, 300 squats, 1mi run" />
          <ScaleRow level="Advanced"     text="Full Murph with 20lb vest. No partition. Honor the work." />
          <p className="text-[10px] text-ink-muted mt-2 italic">Coach note: This is the week&apos;s benchmark. Show up, do the work, leave better than you arrived.</p>
        </div>
      }/>
    </div>
  )

  // ────────────────────────────────────────────────────────────────────────────
  // IRON weekly mental programming
  // ────────────────────────────────────────────────────────────────────────────
  const ironWeeklyPlan = (
    <div className="grid grid-cols-1 gap-3 mt-1 sm:grid-cols-2 lg:grid-cols-3">
      {[
        { day: 'Monday',    theme: 'Identity',     action: 'Write 3 identity statements: "I am someone who…" Read them before your workout.' },
        { day: 'Tuesday',   theme: 'Commitment',   action: 'Block your next 5 training sessions in your calendar right now. Non-negotiable time.' },
        { day: 'Wednesday', theme: 'Friction',     action: 'Remove one obstacle between you and the gym: lay out gear the night before, prep meals, set an alarm.' },
        { day: 'Thursday',  theme: 'Visualization',action: 'Spend 5 minutes before your session visualizing successful execution. See the reps. Feel the form.' },
        { day: 'Friday',    theme: 'Reflection',   action: 'Write down one thing you did well this week in training. Evidence of identity compounds.' },
        { day: 'Saturday',  theme: 'Community',    action: 'Bring someone to the gym or send a training check-in to a fellow member. Accountability is infrastructure.' },
        { day: 'Sunday',    theme: 'Reset',        action: 'Plan next week\'s training schedule. Review your discipline score. Set one concrete intention.' },
      ].map(({ day, theme, action }) => (
        <DayCard key={day} day={day} name={theme} content={
          <p className="text-xs text-ink-muted leading-relaxed">{action}</p>
        }/>
      ))}
    </div>
  )

  // ────────────────────────────────────────────────────────────────────────────
  // FORGE weekly meal plan (generic template, per-member via send)
  // ────────────────────────────────────────────────────────────────────────────
  const forgeWeeklyPlan = (
    <div className="space-y-3 mt-1">
      {[
        { day: 'Monday',    focus: 'High Protein',    p: 220, c: 180, f: 60,
          meals: 'Meal 1: 4 eggs + oats + blueberries | Meal 2: chicken breast + rice + broccoli | Meal 3: salmon + sweet potato | Snack 1: Greek yogurt + almonds | Snack 2: protein shake + banana' },
        { day: 'Tuesday',   focus: 'Performance Carbs', p: 190, c: 240, f: 55,
          meals: 'Meal 1: oats + whey + honey | Meal 2: turkey + pasta + olive oil | Meal 3: beef + potato + spinach | Snack 1: rice cakes + peanut butter | Snack 2: fruit + cottage cheese' },
        { day: 'Wednesday', focus: 'Recovery Fats',   p: 200, c: 150, f: 80,
          meals: 'Meal 1: eggs + avocado toast + smoked salmon | Meal 2: chicken + quinoa + avocado | Meal 3: tuna salad + olive oil + greens | Snack 1: almonds + dark chocolate | Snack 2: casein shake' },
        { day: 'Thursday',  focus: 'Training Fuel',   p: 210, c: 220, f: 60,
          meals: 'Meal 1: banana + oats + protein | Meal 2: lean beef + rice + peppers | Meal 3: chicken + sweet potato + asparagus | Snack 1: dates + peanut butter | Snack 2: milk + granola' },
        { day: 'Friday',    focus: 'Refeed',          p: 180, c: 260, f: 50,
          meals: 'Meal 1: French toast + syrup + eggs | Meal 2: pasta bolognese | Meal 3: grilled chicken + white rice + sauce | Snack 1: cereal + milk | Snack 2: ice cream (earned it)' },
      ].map(({ day, focus, p, c, f, meals }) => (
        <div key={day} className="border border-bone-deeper p-4 bg-white/40">
          <div className="flex items-baseline gap-3 mb-2">
            <span className="text-[9px] font-bold tracking-widest uppercase text-ink-muted">{day}</span>
            <span className="text-xs font-semibold text-ink">{focus}</span>
            <span className="ml-auto text-[10px] text-ink-muted font-medium">P:{p}g &nbsp; C:{c}g &nbsp; F:{f}g</span>
          </div>
          <p className="text-xs text-ink-muted leading-relaxed">{meals}</p>
        </div>
      ))}
      <div className="border border-bone-deeper p-4 bg-white/40 mt-2">
        <p className="text-[9px] font-bold tracking-widest uppercase text-ink-muted mb-2">Weekly Grocery List</p>
        <p className="text-xs text-ink-muted leading-relaxed">
          Proteins: chicken breast (5lb), salmon fillets (4), ground beef (2lb), eggs (2 dozen), Greek yogurt (4), cottage cheese (2), whey protein<br/>
          Carbs: oats (large), white rice (5lb), sweet potatoes (6), pasta (2 bags), bananas (bunch), blueberries<br/>
          Fats: avocados (4), almonds, peanut butter, olive oil, dark chocolate<br/>
          Produce: broccoli, spinach, asparagus, peppers, garlic, onions
        </p>
      </div>
    </div>
  )

  // ────────────────────────────────────────────────────────────────────────────
  // HAVEN weekly recovery programming
  // ────────────────────────────────────────────────────────────────────────────
  const havenWeeklyPlan = (
    <div className="grid grid-cols-1 gap-3 mt-1 sm:grid-cols-2">
      {[
        { day: 'Monday',    protocol: 'Post-Training Mobility', sleep: '7-8h', active: '10 min foam roll — IT band, quads, hip flexors. 5 min diaphragmatic breathing.', flag: false },
        { day: 'Tuesday',   protocol: 'Active Recovery',        sleep: '8h',   active: '20 min zone 1 walk or easy bike. No intensity. Blood flow only.', flag: false },
        { day: 'Wednesday', protocol: 'Thoracic + Shoulder',    sleep: '7-8h', active: 'Cat-cow x20, thoracic rotations x15/side, doorframe chest stretch 3x60s.', flag: false },
        { day: 'Thursday',  protocol: 'Hip & Posterior Chain',  sleep: '8h',   active: 'Pigeon pose 2x2 min/side. Standing hamstring 3x60s. Glute bridge 3x20.', flag: false },
        { day: 'Friday',    protocol: 'CNS Down-Regulation',    sleep: '9h',   active: 'Box breathing 4x4 before bed. Epsom salt bath if available. Screen off by 9pm.', flag: true },
        { day: 'Saturday',  protocol: 'Full Rest or Yoga',      sleep: '8-9h', active: 'Choice: complete rest OR 45 min yoga. Listen to your body. Mandatory off day.', flag: true },
        { day: 'Sunday',    protocol: 'Recovery Audit',         sleep: '8h',   active: 'Check how you feel: energy, soreness, mood. Adjust next week\'s volume accordingly.', flag: false },
      ].map(({ day, protocol, sleep, active, flag }) => (
        <div key={day} className="border border-bone-deeper p-4 bg-white/40">
          <div className="flex items-baseline gap-2 mb-2">
            <span className="text-[9px] font-bold tracking-widest uppercase text-ink-muted">{day}</span>
            <span className="text-xs font-semibold text-ink">{protocol}</span>
            {flag && <span className="ml-auto text-[9px] font-bold uppercase tracking-widest text-[#b45454]">Rest Flag</span>}
          </div>
          <p className="text-[10px] text-ink-muted mb-1">Sleep target: <span className="text-ink font-medium">{sleep}</span></p>
          <p className="text-xs text-ink-muted leading-relaxed">{active}</p>
        </div>
      ))}
    </div>
  )

  // ────────────────────────────────────────────────────────────────────────────
  // APEX weekly business plan
  // ────────────────────────────────────────────────────────────────────────────
  const apexWeeklyPlan = (
    <div className="grid grid-cols-1 gap-3 mt-1 sm:grid-cols-2">
      {[
        { day: 'Monday',    focus: 'Retention',       task: `Call or text your top 5 churn risks — ${gymInsight.churningMembers.slice(0, 3).map(m => m.name.split(' ')[0]).join(', ')} and others. Personal outreach converts at 4x email.`, impact: '+$750/mo if 1 stays' },
        { day: 'Tuesday',   focus: 'Lead Follow-Up',  task: `Follow up with all ${gymInsight.unconvertedLeads} leads who toured but haven't converted. Offer a free class this week. Urgency drives conversion.`, impact: `+$${(gymInsight.unconvertedLeads * 149 * 0.15).toFixed(0)}/mo potential` },
        { day: 'Wednesday', focus: 'ARM Growth',      task: 'Upsell personal training to 3 active members. Target: members with highest check-in frequency — they\'re already committed.', impact: '+$450-900/mo' },
        { day: 'Thursday',  focus: 'Culture & Community', task: 'Post one member transformation or milestone on social. Tag the member. Community visibility drives referrals — your cheapest acquisition channel.', impact: '1-2 referrals avg' },
        { day: 'Friday',    focus: 'Weekly Review',   task: 'Review check-in rates vs last week. Identify any new churn signals. Write 3 things that worked, 1 thing to improve. Set next week\'s one priority.', impact: 'Operational clarity' },
      ].map(({ day, focus, task, impact }) => (
        <div key={day} className="border border-bone-deeper p-4 bg-white/40">
          <div className="flex items-baseline gap-2 mb-2">
            <span className="text-[9px] font-bold tracking-widest uppercase text-ink-muted">{day}</span>
            <span className="text-xs font-semibold text-ink">{focus}</span>
            <span className="ml-auto text-[10px] text-gold font-medium">{impact}</span>
          </div>
          <p className="text-xs text-ink-muted leading-relaxed">{task}</p>
        </div>
      ))}
    </div>
  )

  // ────────────────────────────────────────────────────────────────────────────
  // Churn risk names for ATLAS advisor
  // ────────────────────────────────────────────────────────────────────────────
  const churnRisks = members.filter(m => m.daysSinceLast !== null && m.daysSinceLast >= 7)
  const overtrainedMembers = members.filter(m => m.overtrained)
  const brokenStreaks = members.filter(m => {
    const hadStreak = m.checkInsThisMonth >= 3
    const streakBroken = m.streak === 0 && hadStreak
    return streakBroken
  })
  const atRisk30 = members.filter(m => m.disciplineScore < 30)
  const deloadCandidates = members.filter(m => m.deloadNeeded)

  const avgProtein = Math.round(members.reduce((a, m) => a + m.nutritionScore, 0) / Math.max(members.length, 1))

  // ── ATLAS advisor content ───────────────────────────────────────────────
  const atlasAdvisor = (
    <AdvisorBlock title="Coach Advisor — ATLAS">
      <div className="grid grid-cols-2 gap-6">
        <div>
          <AdvisorRow label="Churn Risk" value={
            churnRisks.length === 0
              ? 'No members at risk — great retention this week.'
              : `${churnRisks.length} members haven\'t checked in 7+ days: ${churnRisks.slice(0, 5).map(m => m.name.split(' ')[0]).join(', ')}${churnRisks.length > 5 ? ` +${churnRisks.length - 5} more` : ''}`
          } accent />
          <AdvisorRow label="Active This Month" value={`${members.filter(m => m.checkInsThisMonth > 0).length} / ${members.length} members have checked in this month`} />
          <AdvisorRow label="Tomorrow&apos;s Program" value="Conditioning focus — 4 rounds: 400m run, 15 KB swings, 10 box jumps. Scale to member fitness level." />
        </div>
        <div>
          <AdvisorRow label="Action Item" value="Send a personal check-in message to all members who haven't been in 7+ days. Use ATLAS to auto-send." accent />
          <AdvisorRow label="High Performers" value={`${members.filter(m => m.atlasIntensity === 'hard').length} members training at hard intensity this week — acknowledge them.`} />
        </div>
      </div>
    </AdvisorBlock>
  )

  // ── IRON advisor content ────────────────────────────────────────────────
  const ironAdvisor = (
    <AdvisorBlock title="Coach Advisor — IRON">
      <div className="grid grid-cols-2 gap-6">
        <div>
          <AdvisorRow label="Broken Streaks" value={
            brokenStreaks.length === 0
              ? 'No broken streaks detected — strong week.'
              : `${brokenStreaks.length} members broke their streak recently: ${brokenStreaks.slice(0, 5).map(m => m.name.split(' ')[0]).join(', ')}`
          } accent />
          <AdvisorRow label="At-Risk Members" value={
            atRisk30.length === 0
              ? 'No members below discipline score 30.'
              : `${atRisk30.length} members below 30/100: ${atRisk30.slice(0, 5).map(m => m.name.split(' ')[0]).join(', ')}`
          } />
        </div>
        <div>
          <AdvisorRow label="Mental Challenge" value="This week&apos;s gym challenge: 5-day consecutive attendance. Post the board. Make it visible. Competition drives compliance." accent />
          <AdvisorRow label="Top Streaks" value={`${members.filter(m => m.streak >= 7).length} members on 7+ day streaks. Recognize them publicly.`} />
        </div>
      </div>
    </AdvisorBlock>
  )

  // ── FORGE advisor content ───────────────────────────────────────────────
  const forgeAdvisor = (
    <AdvisorBlock title="Coach Advisor — FORGE">
      <div className="grid grid-cols-2 gap-6">
        <div>
          <AdvisorRow label="Nutrition Gap" value={
            `${members.filter(m => m.nutritionScore < 40).length} members with nutrition score below 40. Priority: ${members.filter(m => m.nutritionScore < 40).slice(0, 4).map(m => m.name.split(' ')[0]).join(', ')}`
          } accent />
          <AdvisorRow label="Avg Protein Compliance" value={`${avgProtein}% average across all members this week.`} />
        </div>
        <div>
          <AdvisorRow label="Weekly Focus" value="Protein first protocol: challenge all members to hit 1g per lb bodyweight this week. Simple, measurable, impactful." accent />
          <AdvisorRow label="High Compliance" value={`${members.filter(m => m.nutritionScore >= 70).length} members above 70% — they're your nutrition leaders.`} />
        </div>
      </div>
    </AdvisorBlock>
  )

  // ── HAVEN advisor content ───────────────────────────────────────────────
  const havenAdvisor = (
    <AdvisorBlock title="Coach Advisor — HAVEN">
      <div className="grid grid-cols-2 gap-6">
        <div>
          <AdvisorRow label="Overtraining Risk" value={
            overtrainedMembers.length === 0
              ? 'No overtraining signals detected this week.'
              : `${overtrainedMembers.length} members showing overtraining signals (5+ sessions/7 days): ${overtrainedMembers.slice(0, 4).map(m => m.name.split(' ')[0]).join(', ')}`
          } accent />
          <AdvisorRow label="Deload Candidates" value={
            deloadCandidates.length === 0
              ? 'No deload recommendations this week.'
              : `${deloadCandidates.length} members need a deload week (16+ sessions this month): ${deloadCandidates.slice(0, 4).map(m => m.name.split(' ')[0]).join(', ')}`
          } />
        </div>
        <div>
          <AdvisorRow label="Recovery Protocol" value="This week: mandatory 8+ hour sleep challenge. Post reminders in group chat at 9pm nightly. Sleep is the highest ROI recovery tool." accent />
          <AdvisorRow label="Avg Recovery Score" value={`${Math.round(members.reduce((a, m) => a + m.recoveryScore, 0) / Math.max(members.length, 1))}/100 average across all members.`} />
        </div>
      </div>
    </AdvisorBlock>
  )

  // ── APEX advisor content ────────────────────────────────────────────────
  const apexAdvisor = (
    <AdvisorBlock title="Coach Advisor — APEX">
      <div className="grid grid-cols-2 gap-6">
        <div>
          <AdvisorRow label="Estimated MRR" value={`${fmt(gymInsight.estimatedMRR)}/mo — ${gymInsight.mrrGrowth >= 0 ? '+' : ''}${fmt(gymInsight.mrrGrowth)} vs last month`} accent />
          <AdvisorRow label="Top Churn Risks" value={
            gymInsight.churningMembers.length === 0
              ? 'No churn risks this week.'
              : gymInsight.churningMembers.slice(0, 5).map(m => `${m.name.split(' ')[0]} (${m.daysSinceLast}d)`).join(', ')
          } />
          <AdvisorRow label="Unconverted Leads" value={`${gymInsight.unconvertedLeads} leads who toured but haven't joined. Revenue opportunity: ${fmt(gymInsight.unconvertedLeads * 149 * 0.15)}/mo at 15% conversion.`} />
        </div>
        <div>
          <AdvisorRow label="Business Move Today" value="Call your top 3 churn risks by name. Don't text — call. Personal outreach converts at 4x over automated messages. 15 minutes, potentially $450/mo retained." accent />
          <AdvisorRow label="Active Rate" value={`${gymInsight.activeThisMonth}/${gymInsight.totalMembers} members active this month (${Math.round(gymInsight.activeThisMonth / Math.max(gymInsight.totalMembers, 1) * 100)}%)`} />
        </div>
      </div>
    </AdvisorBlock>
  )

  // ────────────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-full bg-bone">

      {/* Page header */}
      <div className="bg-ink border-b border-bone/8 px-10 py-8">
        <p className="text-xs tracking-widest uppercase text-gold/50 font-medium">AI System</p>
        <h1 className="font-serif text-3xl font-bold text-bone mt-1">
          The <span className="text-gold">Syndicate</span>
        </h1>
        <p className="text-sm text-bone/40 mt-1.5">
          Six specialized AI coaches. Each one built for a different dimension of your members&apos; performance.
        </p>
      </div>

      <div className="px-10 py-8 space-y-6">

        {/* ── ATLAS ─────────────────────────────────────────────────────── */}
        <CoachSection
          code="ATLAS" role="Fitness Coach"
          tagline="The body adapts to what you demand of it."
          description="Analyzes each member's check-in history to generate a personalized daily workout. Intensity scales from easy to hard based on recent activity and monthly consistency."
          accentClass="text-gold"
          icon={<svg width="22" height="22" viewBox="0 0 22 22" fill="none" className="text-gold"><path d="M3 11h3M16 11h3M6 11h10M6 8v6M16 8v6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/><circle cx="4.5" cy="11" r="1.5" stroke="currentColor" strokeWidth="1.3"/><circle cx="17.5" cy="11" r="1.5" stroke="currentColor" strokeWidth="1.3"/></svg>}
        >
          {atlasAdvisor}
          <WeeklyBlock
            label="Weekly Programming — 5-Day WOD"
            onSendAll={() => sendWeeklyAll('atlas', m => `${m.name.split(' ')[0]}, here is your personalized weekly program from ATLAS. Mon: Strength — 5x5 back squat + deadlift. Tue: Conditioning — AMRAP 20. Wed: Gymnastics/Skill — pull-up progression. Thu: Mixed Modal — 5 rounds for time. Fri: Hero WOD — Murph (${m.atlasIntensity === 'hard' ? 'full with vest' : m.atlasIntensity === 'moderate' ? 'standard' : 'scaled'}). Your intensity this week: ${m.atlasIntensity}. Let's build. — ATLAS`)}
            sending={weekSending === 'atlas'}
          >
            {atlasWeeklyWOD}
          </WeeklyBlock>
          <div>
            <ControlsBar
              search={search.atlas} setSearch={v => setCoachSearch('atlas', v)}
              count={filtered('atlas').length}
              sentCount={Object.values(states.atlas).filter(s => s === 'sent').length}
              onSendAll={() => sendAllCoach('atlas', filtered('atlas'))}
              sending={sendingAll === 'atlas'}
              label="Daily Message"
            />
            <div className="divide-y divide-bone-deeper max-h-72 overflow-y-auto">
              {filtered('atlas').map(m => (
                <MemberRow key={m.profileId} m={m} coach="atlas"
                  meta={m.daysSinceLast === null ? 'No check-ins' : `${m.daysSinceLast}d ago · ${m.checkInsThisMonth}/mo`}
                  badge={<IntensityBadge level={m.atlasIntensity} />}
                  msg={m.atlasMessage}
                />
              ))}
            </div>
          </div>
        </CoachSection>

        {/* ── IRON ──────────────────────────────────────────────────────── */}
        <CoachSection
          code="IRON" role="Mental Coach"
          tagline="Discipline is the bridge between goals and results."
          description="Tracks each member's consecutive check-in streak and calculates a discipline score (0-100) based on monthly consistency. Generates a personalized mental performance message."
          accentClass="text-bone"
          icon={<svg width="22" height="22" viewBox="0 0 22 22" fill="none" className="text-bone"><path d="M11 3l2 5h5l-4 3 1.5 5L11 13l-4.5 3L8 11 4 8h5z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/></svg>}
        >
          {ironAdvisor}
          <WeeklyBlock
            label="Weekly Mental Programming — 7-Day Accountability Challenge"
            onSendAll={() => sendWeeklyAll('iron', m => `${m.name.split(' ')[0]}, your 7-day mental challenge from IRON. Mon: Identity — write 3 "I am" statements. Tue: Commitment — block your training in your calendar. Wed: Friction — remove one obstacle to training. Thu: Visualization — 5 min mental rehearsal before your session. Fri: Reflection — write down one win. Sat: Community — check in with a training partner. Sun: Reset — plan next week. Your discipline score: ${m.disciplineScore}/100. Streak: ${m.streak} days. Let's build identity. — IRON`)}
            sending={weekSending === 'iron'}
          >
            {ironWeeklyPlan}
          </WeeklyBlock>
          <div>
            <ControlsBar
              search={search.iron} setSearch={v => setCoachSearch('iron', v)}
              count={filtered('iron').length}
              sentCount={Object.values(states.iron).filter(s => s === 'sent').length}
              onSendAll={() => sendAllCoach('iron', filtered('iron'))}
              sending={sendingAll === 'iron'}
              label="Daily Message"
            />
            <div className="divide-y divide-bone-deeper max-h-72 overflow-y-auto">
              {filtered('iron').map(m => (
                <MemberRow key={m.profileId} m={m} coach="iron"
                  meta={m.streak > 0 ? `${m.streak}-day streak` : 'No streak'}
                  badge={<ScoreBadge score={m.disciplineScore} />}
                  msg={m.ironMessage}
                />
              ))}
            </div>
          </div>
        </CoachSection>

        {/* ── FORGE ─────────────────────────────────────────────────────── */}
        <CoachSection
          code="FORGE" role="Nutrition Coach"
          tagline="You are what you eat. Eat like a champion."
          description="Personalized meal plans and macro targets calibrated to each member's training load and consistency score. Nutrition compliance tracked and communicated weekly."
          accentClass="text-[#e8963d]"
          icon={<svg width="22" height="22" viewBox="0 0 22 22" fill="none" className="text-[#e8963d]"><path d="M11 2C11 2 6 7 6 12a5 5 0 0010 0c0-5-5-10-5-10z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/><path d="M11 14v-4M9 12h4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>}
        >
          {forgeAdvisor}
          <WeeklyBlock
            label="Weekly Meal Programming — 5-Day Plan + Grocery List"
            onSendAll={() => sendWeeklyAll('forge', m => `${m.name.split(' ')[0]}, your weekly meal plan from FORGE. Protein target: ${m.nutritionScore >= 70 ? '220g+' : m.nutritionScore >= 40 ? '190g' : '160g'} daily. Mon (High Protein): oats+whey breakfast, chicken+rice lunch, salmon+potato dinner. Tue (Performance): carb-load day, fuel your training. Wed (Recovery Fats): omega-3 focus, avocado + salmon. Thu (Training Fuel): pre/post workout meals dialed in. Fri (Refeed): earned carbs. Grocery: chicken 5lb, salmon 4 fillets, eggs 2 dozen, rice 5lb, sweet potatoes, oats, whey. Nutrition score: ${m.nutritionScore}%. — FORGE`)}
            sending={weekSending === 'forge'}
          >
            {forgeWeeklyPlan}
          </WeeklyBlock>
          <div>
            <ControlsBar
              search={search.forge} setSearch={v => setCoachSearch('forge', v)}
              count={filtered('forge').length}
              sentCount={Object.values(states.forge).filter(s => s === 'sent').length}
              onSendAll={() => sendAllCoach('forge', filtered('forge'))}
              sending={sendingAll === 'forge'}
              label="Daily Message"
            />
            <div className="divide-y divide-bone-deeper max-h-72 overflow-y-auto">
              {filtered('forge').map(m => (
                <MemberRow key={m.profileId} m={m} coach="forge"
                  meta={`${m.weeklyNutritionCompliance}/7 days logged`}
                  badge={<ScoreBadge score={m.nutritionScore} suffix="%" />}
                  msg={m.forgeMessage}
                />
              ))}
            </div>
          </div>
        </CoachSection>

        {/* ── HAVEN ─────────────────────────────────────────────────────── */}
        <CoachSection
          code="HAVEN" role="Recovery Coach"
          tagline="Recovery is not weakness. It is the weapon."
          description="Detects overtraining signals, deload week needs, and recovery deficits. Generates daily recovery protocols calibrated to each member's training volume."
          accentClass="text-[#7db8c8]"
          icon={<svg width="22" height="22" viewBox="0 0 22 22" fill="none" className="text-[#7db8c8]"><path d="M18 11.5A7 7 0 019 3a7 7 0 100 16 7 7 0 009-7.5z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/></svg>}
        >
          {havenAdvisor}
          <WeeklyBlock
            label="Weekly Recovery Programming — 7-Day Protocol"
            onSendAll={() => sendWeeklyAll('haven', m => `${m.name.split(' ')[0]}, your 7-day recovery protocol from HAVEN. ${m.overtrained ? 'ALERT: Overtraining signals detected — mandatory rest days this week.' : m.deloadNeeded ? 'Deload week recommended — reduce load by 40%.' : ''} Daily protocol: 10 min mobility post-session, 8+ hours sleep, hydration 3L+. Sleep targets: Mon-Thu 7-8h, Fri-Sun 8-9h. Focus areas: hip flexors Mon, active recovery Tue, thoracic mobility Wed, posterior chain Thu, CNS down-regulation Fri. Recovery score: ${m.recoveryScore}/100. — HAVEN`)}
            sending={weekSending === 'haven'}
          >
            {havenWeeklyPlan}
          </WeeklyBlock>
          <div>
            <ControlsBar
              search={search.haven} setSearch={v => setCoachSearch('haven', v)}
              count={filtered('haven').length}
              sentCount={Object.values(states.haven).filter(s => s === 'sent').length}
              onSendAll={() => sendAllCoach('haven', filtered('haven'))}
              sending={sendingAll === 'haven'}
              label="Daily Message"
            />
            <div className="divide-y divide-bone-deeper max-h-72 overflow-y-auto">
              {filtered('haven').map(m => (
                <MemberRow key={m.profileId} m={m} coach="haven"
                  meta={m.overtrained ? 'Overtraining risk' : m.deloadNeeded ? 'Deload recommended' : `${m.checkInsLast7Days} sessions/7d`}
                  badge={
                    m.overtrained
                      ? <Pill label="Overtrained" color="red" />
                      : m.deloadNeeded
                      ? <Pill label="Deload" color="gold" />
                      : <ScoreBadge score={m.recoveryScore} />
                  }
                  msg={m.havenMessage}
                />
              ))}
            </div>
          </div>
        </CoachSection>

        {/* ── APEX ──────────────────────────────────────────────────────── */}
        <CoachSection
          code="APEX" role="Business Coach"
          tagline="The gym is the business. Run it like one."
          description="Gym growth analytics, retention forecasting, and revenue optimization. Turns check-in data into actionable business intelligence for owners and trainers."
          accentClass="text-[#a8c49a]"
          icon={<svg width="22" height="22" viewBox="0 0 22 22" fill="none" className="text-[#a8c49a]"><path d="M3 16l5-5 4 4 7-9" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/><path d="M15 7h4v4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>}
        >
          {apexAdvisor}
          <WeeklyBlock
            label="Weekly Business Programming — 5-Day Action Plan"
            onSendAll={() => sendWeeklyAll('apex', () => `This week's business brief from APEX. MRR: ${fmt(gymInsight.estimatedMRR)} (${gymInsight.mrrGrowth >= 0 ? '+' : ''}${fmt(gymInsight.mrrGrowth)} vs last month). Mon: Call top churn risks personally. Tue: Follow up with ${gymInsight.unconvertedLeads} unconverted leads. Wed: Pitch personal training to 3 high-frequency members. Thu: Post member success story on social. Fri: Weekly review — wins, gaps, next week's priority. One number that matters: ${gymInsight.activeThisMonth}/${gymInsight.totalMembers} members active. — APEX`)}
            sending={weekSending === 'apex'}
          >
            {apexWeeklyPlan}
          </WeeklyBlock>
          <div className="px-8 py-6 bg-bone">
            <p className="text-[10px] tracking-widest uppercase text-ink-muted font-medium mb-4">Churn Risk Board</p>
            <div className="space-y-2">
              {gymInsight.churningMembers.slice(0, 8).map(m => (
                <div key={m.profileId} className="flex items-center gap-4 py-2 border-b border-bone-deeper last:border-0">
                  <div className="w-8 h-8 rounded-full bg-ink flex items-center justify-center shrink-0">
                    <span className="text-[9px] font-bold text-bone">{initials(m.name)}</span>
                  </div>
                  <span className="text-xs font-semibold text-ink flex-1">{m.name}</span>
                  <Pill label={`${m.daysSinceLast}d absent`} color={m.daysSinceLast >= 14 ? 'red' : 'gold'} />
                </div>
              ))}
              {gymInsight.churningMembers.length === 0 && (
                <p className="text-xs text-ink-muted">No churn risks this week. Strong retention.</p>
              )}
            </div>
          </div>
        </CoachSection>

        {/* ── COMPASS ───────────────────────────────────────────────────── */}
        <CoachSection
          code="COMPASS" role="Daily Synthesis"
          tagline="One number. Three actions. Nothing in the way."
          description="Synthesizes all five coaches into one daily brief per member — workout, nutrition target, mental score, recovery note, and business context for owners. The command center of The Syndicate."
          accentClass="text-bone/80"
          icon={<svg width="22" height="22" viewBox="0 0 22 22" fill="none" className="text-bone/80"><circle cx="11" cy="11" r="8.5" stroke="currentColor" strokeWidth="1.4"/><path d="M11 2.5V4M11 18v1.5M2.5 11H4M18 11h1.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/><path d="M14 8l-2 6-2-6 6 2-6 2z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/></svg>}
        >
          {/* Send All Daily Brief — the big button */}
          <div className="bg-ink/5 border-b border-bone-deeper px-8 py-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-ink">Send All Daily Brief</p>
                <p className="text-xs text-ink-muted mt-0.5">
                  Deploys all 5 coaches to all {members.length} members at once — personalized training, nutrition, mental, and recovery notes in one message.
                </p>
              </div>
              <button
                onClick={sendAllDaily}
                disabled={sendingAll === 'all'}
                className="text-[11px] tracking-widest uppercase font-bold bg-ink text-gold border border-gold px-8 py-3 hover:bg-ink/80 transition-colors disabled:opacity-40 ml-8 shrink-0"
              >
                {sendingAll === 'all' ? `Sending to ${members.length}…` : `Deploy to All ${members.length} Members`}
              </button>
            </div>
          </div>

          <div>
            <ControlsBar
              search={search.compass} setSearch={v => setCoachSearch('compass', v)}
              count={filtered('compass').length}
              sentCount={Object.values(states.compass).filter(s => s === 'sent').length}
              onSendAll={() => sendAllCoach('compass', filtered('compass'))}
              sending={sendingAll === 'compass'}
              label="Daily Brief"
            />
            <div className="divide-y divide-bone-deeper max-h-96 overflow-y-auto">
              {filtered('compass').map(m => {
                const overall = Math.round((m.disciplineScore + m.nutritionScore + m.recoveryScore) / 3)
                return (
                  <MemberRow key={m.profileId} m={m} coach="compass"
                    meta={`Overall ${overall}/100`}
                    badge={<ScoreBadge score={overall} />}
                    msg={m.compassMessage}
                  />
                )
              })}
            </div>
          </div>
        </CoachSection>

      </div>
    </div>
  )
}
