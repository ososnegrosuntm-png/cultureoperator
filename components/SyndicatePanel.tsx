'use client'

import { useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'

export type MemberInsight = {
  profileId: string
  name: string
  daysSinceLast: number | null
  checkInsThisMonth: number
  atlasIntensity: 'easy' | 'moderate' | 'hard'
  atlasMessage: string
  streak: number
  disciplineScore: number
  ironMessage: string
}

type Props = {
  currentUserId: string
  gymId: string
  members: MemberInsight[]
}

type SendState = 'idle' | 'sending' | 'sent' | 'error'

// ── Helpers ───────────────────────────────────────────────────────────────────
function initials(name: string) {
  return name.split(' ').map(w => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase()
}

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

function ScoreBadge({ score }: { score: number }) {
  const color = score >= 70 ? 'text-gold' : score >= 40 ? 'text-ink' : 'text-ink-muted'
  return (
    <span className={`font-serif text-lg font-bold ${color}`}>
      {score}<span className="text-xs font-sans font-normal text-ink-muted">/100</span>
    </span>
  )
}

// ── Coming Soon coaches ───────────────────────────────────────────────────────
const COMING_SOON = [
  {
    code: 'FORGE',
    role: 'Nutrition Coach',
    description: 'Personalized meal plans and macro targets calibrated to each member&apos;s training load.',
    icon: () => (
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
        <path d="M11 2C11 2 6 7 6 12a5 5 0 0010 0c0-5-5-10-5-10z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/>
        <path d="M11 14v-4M9 12h4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
      </svg>
    ),
  },
  {
    code: 'HAVEN',
    role: 'Recovery Coach',
    description: 'Sleep quality signals, deload detection, and active recovery protocols to prevent burnout.',
    icon: () => (
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
        <path d="M18 11.5A7 7 0 019 3a7 7 0 100 16 7 7 0 009-7.5z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/>
      </svg>
    ),
  },
  {
    code: 'APEX',
    role: 'Business Coach',
    description: 'Gym growth analytics, retention forecasting, and revenue optimization recommendations.',
    icon: () => (
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
        <path d="M3 16l5-5 4 4 7-9" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M15 7h4v4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
  },
  {
    code: 'COMPASS',
    role: 'Life Assistant',
    description: 'Holistic check-ins connecting fitness to life goals, stress levels, and long-term fulfillment.',
    icon: () => (
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
        <circle cx="11" cy="11" r="8.5" stroke="currentColor" strokeWidth="1.4"/>
        <path d="M11 2.5V4M11 18v1.5M2.5 11H4M18 11h1.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
        <path d="M14 8l-2 6-2-6 6 2-6 2z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/>
      </svg>
    ),
  },
]

// ── Coach section ─────────────────────────────────────────────────────────────
function CoachSection({
  code,
  role,
  tagline,
  description,
  icon,
  accentClass,
  memberRows,
}: {
  code: string
  role: string
  tagline: string
  description: string
  icon: React.ReactNode
  accentClass: string
  memberRows: React.ReactNode
}) {
  return (
    <div className="border border-bone-deeper">
      {/* Identity header */}
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
      {/* Member rows */}
      {memberRows}
    </div>
  )
}

// ── Main panel ────────────────────────────────────────────────────────────────
export function SyndicatePanel({ currentUserId, gymId, members }: Props) {
  const [atlasStates, setAtlasStates] = useState<Record<string, SendState>>({})
  const [ironStates,  setIronStates]  = useState<Record<string, SendState>>({})
  const [atlasSearch, setAtlasSearch] = useState('')
  const [ironSearch,  setIronSearch]  = useState('')
  const [sendingAll, setSendingAll]   = useState<'atlas' | 'iron' | null>(null)

  const supabase = createClient()

  // ── Send single message ───────────────────────────────────────────────────
  async function sendMsg(
    profileId: string,
    body: string,
    coach: 'atlas' | 'iron',
  ) {
    const setStates = coach === 'atlas' ? setAtlasStates : setIronStates
    setStates(p => ({ ...p, [profileId]: 'sending' }))
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any).from('messages').insert({
      gym_id:       gymId,
      sender_id:    currentUserId,
      recipient_id: profileId,
      body,
      read: false,
    })
    setStates(p => ({ ...p, [profileId]: error ? 'error' : 'sent' }))
    if (error) console.error(`[${coach}] send failed:`, error.message)
  }

  // ── Send all ──────────────────────────────────────────────────────────────
  async function sendAll(coach: 'atlas' | 'iron') {
    setSendingAll(coach)
    const setStates = coach === 'atlas' ? setAtlasStates : setIronStates
    const pending = members.filter(m => {
      const st = coach === 'atlas' ? atlasStates[m.profileId] : ironStates[m.profileId]
      return !st || st === 'idle' || st === 'error'
    })
    // Mark all sending
    setStates(prev => {
      const next = { ...prev }
      pending.forEach(m => { next[m.profileId] = 'sending' })
      return next
    })
    // Send sequentially to avoid overwhelming
    for (const m of pending) {
      const body = coach === 'atlas' ? m.atlasMessage : m.ironMessage
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any).from('messages').insert({
        gym_id:       gymId,
        sender_id:    currentUserId,
        recipient_id: m.profileId,
        body,
        read: false,
      })
      setStates(prev => ({ ...prev, [m.profileId]: error ? 'error' : 'sent' }))
    }
    setSendingAll(null)
  }

  // ── Filtered lists ────────────────────────────────────────────────────────
  const atlasFiltered = useMemo(() => {
    const q = atlasSearch.toLowerCase().trim()
    return q ? members.filter(m => m.name.toLowerCase().includes(q)) : members
  }, [members, atlasSearch])

  const ironFiltered = useMemo(() => {
    const q = ironSearch.toLowerCase().trim()
    return q ? members.filter(m => m.name.toLowerCase().includes(q)) : members
  }, [members, ironSearch])

  // ── Shared send button ────────────────────────────────────────────────────
  function SendBtn({
    profileId, body, coach,
  }: { profileId: string; body: string; coach: 'atlas' | 'iron' }) {
    const st = (coach === 'atlas' ? atlasStates : ironStates)[profileId] ?? 'idle'
    if (st === 'sent')    return <span className="text-[10px] font-semibold text-gold tracking-wide">Sent ✓</span>
    if (st === 'error')   return <span className="text-[10px] font-semibold text-[#b45454] tracking-wide">Failed</span>
    if (st === 'sending') return <span className="text-[10px] text-ink-muted tracking-wide">Sending…</span>
    return (
      <button
        onClick={() => sendMsg(profileId, body, coach)}
        className="text-[10px] tracking-widest uppercase font-semibold text-ink-muted hover:text-gold transition-colors opacity-0 group-hover:opacity-100"
      >
        Send →
      </button>
    )
  }

  const atlasSentCount = Object.values(atlasStates).filter(s => s === 'sent').length
  const ironSentCount  = Object.values(ironStates).filter(s => s === 'sent').length

  // ── ATLAS member rows ─────────────────────────────────────────────────────
  const atlasRows = (
    <div>
      {/* Controls */}
      <div className="px-6 py-3 border-b border-bone-deeper flex items-center gap-4 bg-bone">
        <div className="relative flex-1 max-w-64">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted/50" width="12" height="12" viewBox="0 0 14 14" fill="none">
            <circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1.3"/>
            <path d="M9.5 9.5L13 13" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
          </svg>
          <input
            type="text" value={atlasSearch} onChange={e => setAtlasSearch(e.target.value)}
            placeholder="Search members…"
            className="w-full pl-8 pr-3 py-1.5 text-xs bg-bone-dark border border-bone-deeper text-ink placeholder:text-ink-muted/50 focus:outline-none focus:border-gold transition-colors"
          />
        </div>
        <p className="text-xs text-ink-muted ml-auto">
          {atlasFiltered.length} members{atlasSentCount > 0 && ` · ${atlasSentCount} sent`}
        </p>
        <button
          onClick={() => sendAll('atlas')}
          disabled={sendingAll === 'atlas'}
          className="text-[10px] tracking-widest uppercase font-semibold bg-ink text-bone px-4 py-2 hover:bg-ink-light transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {sendingAll === 'atlas' ? 'Sending…' : `Send All (${atlasFiltered.length})`}
        </button>
      </div>
      {/* Rows */}
      <div className="divide-y divide-bone-deeper max-h-72 overflow-y-auto">
        {atlasFiltered.map(m => (
          <div key={m.profileId} className="flex items-center gap-4 px-6 py-3 hover:bg-bone-dark transition-colors group">
            <div className="w-8 h-8 rounded-full bg-ink flex items-center justify-center shrink-0">
              <span className="text-[9px] font-bold text-bone">{initials(m.name)}</span>
            </div>
            <div className="w-28 shrink-0">
              <p className="text-xs font-semibold text-ink truncate">{m.name}</p>
              <p className="text-[10px] text-ink-muted mt-0.5">
                {m.daysSinceLast === null ? 'No check-ins' : `${m.daysSinceLast}d ago · ${m.checkInsThisMonth}/mo`}
              </p>
            </div>
            <div className="shrink-0">
              <IntensityBadge level={m.atlasIntensity} />
            </div>
            <p className="flex-1 text-xs text-ink-muted truncate min-w-0">{m.atlasMessage}</p>
            <div className="shrink-0 w-16 text-right">
              <SendBtn profileId={m.profileId} body={m.atlasMessage} coach="atlas" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )

  // ── IRON member rows ──────────────────────────────────────────────────────
  const ironRows = (
    <div>
      {/* Controls */}
      <div className="px-6 py-3 border-b border-bone-deeper flex items-center gap-4 bg-bone">
        <div className="relative flex-1 max-w-64">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted/50" width="12" height="12" viewBox="0 0 14 14" fill="none">
            <circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1.3"/>
            <path d="M9.5 9.5L13 13" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
          </svg>
          <input
            type="text" value={ironSearch} onChange={e => setIronSearch(e.target.value)}
            placeholder="Search members…"
            className="w-full pl-8 pr-3 py-1.5 text-xs bg-bone-dark border border-bone-deeper text-ink placeholder:text-ink-muted/50 focus:outline-none focus:border-gold transition-colors"
          />
        </div>
        <p className="text-xs text-ink-muted ml-auto">
          {ironFiltered.length} members{ironSentCount > 0 && ` · ${ironSentCount} sent`}
        </p>
        <button
          onClick={() => sendAll('iron')}
          disabled={sendingAll === 'iron'}
          className="text-[10px] tracking-widest uppercase font-semibold bg-ink text-bone px-4 py-2 hover:bg-ink-light transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {sendingAll === 'iron' ? 'Sending…' : `Send All (${ironFiltered.length})`}
        </button>
      </div>
      {/* Rows */}
      <div className="divide-y divide-bone-deeper max-h-72 overflow-y-auto">
        {ironFiltered.map(m => (
          <div key={m.profileId} className="flex items-center gap-4 px-6 py-3 hover:bg-bone-dark transition-colors group">
            <div className="w-8 h-8 rounded-full bg-ink flex items-center justify-center shrink-0">
              <span className="text-[9px] font-bold text-bone">{initials(m.name)}</span>
            </div>
            <div className="w-28 shrink-0">
              <p className="text-xs font-semibold text-ink truncate">{m.name}</p>
              <p className="text-[10px] text-ink-muted mt-0.5">
                {m.streak > 0 ? `${m.streak}-day streak` : 'No streak'}
              </p>
            </div>
            <div className="shrink-0 w-20">
              <ScoreBadge score={m.disciplineScore} />
            </div>
            <p className="flex-1 text-xs text-ink-muted truncate min-w-0">{m.ironMessage}</p>
            <div className="shrink-0 w-16 text-right">
              <SendBtn profileId={m.profileId} body={m.ironMessage} coach="iron" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )

  return (
    <div className="min-h-full bg-bone">

      {/* ── Page header ───────────────────────────────────────────────────── */}
      <div className="bg-ink border-b border-bone/8 px-10 py-8">
        <p className="text-xs tracking-widest uppercase text-gold/50 font-medium">AI System</p>
        <h1 className="font-serif text-3xl font-bold text-bone mt-1">
          The <span className="text-gold">Syndicate</span>
        </h1>
        <p className="text-sm text-bone/40 mt-1.5">Six specialized AI coaches. Each one built for a different dimension of your members&apos; performance.</p>
      </div>

      <div className="px-10 py-8 space-y-6">

        {/* ── Active coaches ─────────────────────────────────────────────── */}
        <div className="space-y-2">
          <p className="text-xs tracking-widest uppercase text-ink-muted font-medium">Active Coaches</p>
        </div>

        {/* ATLAS */}
        <CoachSection
          code="ATLAS"
          role="Fitness Coach"
          tagline="The body adapts to what you demand of it."
          description="Analyzes each member&apos;s check-in history to generate a personalized daily workout. Intensity scales from easy to hard based on recent activity and monthly consistency."
          accentClass="text-gold"
          icon={
            <svg width="22" height="22" viewBox="0 0 22 22" fill="none" className="text-gold">
              <path d="M3 11h3M16 11h3M6 11h10M6 8v6M16 8v6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              <circle cx="4.5" cy="11" r="1.5" stroke="currentColor" strokeWidth="1.3"/>
              <circle cx="17.5" cy="11" r="1.5" stroke="currentColor" strokeWidth="1.3"/>
            </svg>
          }
          memberRows={atlasRows}
        />

        {/* IRON */}
        <CoachSection
          code="IRON"
          role="Mental Coach"
          tagline="Discipline is the bridge between goals and results."
          description="Tracks each member&apos;s consecutive check-in streak and calculates a discipline score (0&ndash;100) based on monthly consistency. Generates a personalized mental performance message."
          accentClass="text-bone"
          icon={
            <svg width="22" height="22" viewBox="0 0 22 22" fill="none" className="text-bone">
              <path d="M11 3l2 5h5l-4 3 1.5 5L11 13l-4.5 3L8 11 4 8h5z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/>
            </svg>
          }
          memberRows={ironRows}
        />

        {/* ── Coming soon ────────────────────────────────────────────────── */}
        <div className="pt-4">
          <p className="text-xs tracking-widest uppercase text-ink-muted font-medium mb-4">Coming Soon</p>
          <div className="grid grid-cols-2 gap-3">
            {COMING_SOON.map(({ code, role, description, icon: Icon }) => (
              <div key={code} className="border border-bone-deeper bg-bone p-6 relative overflow-hidden">
                {/* Watermark */}
                <p className="absolute top-4 right-5 text-[10px] tracking-widest uppercase font-semibold text-bone-deeper">
                  Coming Soon
                </p>
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 border border-bone-deeper flex items-center justify-center shrink-0 text-ink-muted/40">
                    <Icon />
                  </div>
                  <div>
                    <p className="font-serif text-lg font-bold text-ink-muted/40 tracking-wide">{code}</p>
                    <p className="text-[10px] tracking-widest uppercase text-ink-muted/40 font-medium -mt-0.5">{role}</p>
                    <p className="text-xs text-ink-muted/50 mt-2 leading-relaxed">{description}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  )
}
