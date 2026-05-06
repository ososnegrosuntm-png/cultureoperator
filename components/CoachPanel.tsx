'use client'

import { useState } from 'react'

export type CoachMessage = {
  id: string
  profile_id: string
  message: string
  workout_summary: string | null
  recovery_status: 'good' | 'low' | null
  recommended_action: string | null
  streak_days: number
  message_date: string
  full_name: string | null
}

type GenerateResult = {
  generated: number
  failed: number
  total: number
  date: string
  errors: string[]
}

export function CoachPanel({
  initialMessages,
  initialDate,
}: {
  initialMessages: CoachMessage[]
  initialDate: string
}) {
  const [messages]                  = useState<CoachMessage[]>(initialMessages)
  const [generating, setGenerating] = useState(false)
  const [result, setResult]         = useState<GenerateResult | null>(null)
  const [error, setError]           = useState<string | null>(null)
  const [search, setSearch]         = useState('')

  async function handleGenerate() {
    setGenerating(true)
    setError(null)
    setResult(null)
    try {
      const res  = await fetch('/api/coach/daily', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Generation failed')
      setResult(data)
      // Reload messages by refreshing the page data via navigation
      window.location.reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      setGenerating(false)
    }
  }

  const filtered = messages.filter(m => {
    const q = search.toLowerCase().trim()
    if (!q) return true
    return (
      m.full_name?.toLowerCase().includes(q) ||
      m.message.toLowerCase().includes(q)
    )
  })

  const goodCount = messages.filter(m => m.recovery_status === 'good').length
  const lowCount  = messages.filter(m => m.recovery_status === 'low').length

  return (
    <div className="min-h-full bg-bone">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="border-b border-bone-deeper px-10 py-5 flex items-center justify-between">
        <div>
          <p className="text-xs tracking-widest uppercase text-ink-muted font-medium">AI Coach</p>
          <h2 className="font-serif text-2xl font-bold text-ink mt-0.5">Daily Messages</h2>
        </div>
        <div className="flex items-center gap-4">
          <p className="text-xs text-ink-muted">{initialDate}</p>
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="text-xs tracking-widest uppercase font-semibold bg-ink text-bone px-5 py-2.5 hover:bg-ink-light transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {generating ? 'Generating…' : 'Generate Today'}
          </button>
        </div>
      </div>

      <div className="px-10 py-8 space-y-8">

        {/* ── Result banner ───────────────────────────────────────────────── */}
        {result && (
          <div className="bg-ink text-bone px-8 py-5 flex items-center justify-between">
            <div>
              <p className="font-serif text-3xl font-bold text-gold">{result.generated}</p>
              <p className="text-xs text-bone/50 mt-0.5">messages generated for {result.date}</p>
            </div>
            {result.failed > 0 && (
              <p className="text-xs text-bone/50">{result.failed} failed</p>
            )}
          </div>
        )}
        {error && (
          <div className="bg-[#b45454]/10 border border-[#b45454]/20 px-6 py-4">
            <p className="text-sm text-[#b45454]">{error}</p>
          </div>
        )}

        {/* ── Stats strip ─────────────────────────────────────────────────── */}
        <div className="grid grid-cols-3 gap-px bg-bone-deeper border border-bone-deeper">
          <div className="bg-bone p-6">
            <p className="font-serif text-4xl font-bold text-ink">{messages.length}</p>
            <p className="text-xs text-ink-muted mt-1">messages today</p>
          </div>
          <div className="bg-bone p-6">
            <p className="font-serif text-4xl font-bold text-gold">{goodCount}</p>
            <p className="text-xs text-ink-muted mt-1">good recovery</p>
          </div>
          <div className="bg-bone p-6">
            <p className="font-serif text-4xl font-bold text-[#b45454]">{lowCount}</p>
            <p className="text-xs text-ink-muted mt-1">low recovery — rest day</p>
          </div>
        </div>

        {/* ── Sample message preview ──────────────────────────────────────── */}
        {messages.length > 0 && (
          <div className="bg-ink px-8 py-7">
            <p className="text-xs tracking-widest uppercase text-gold/60 font-medium mb-4">Sample Message</p>
            <p className="text-bone font-light leading-relaxed text-sm">
              &ldquo;{messages[0].message}&rdquo;
            </p>
            <p className="text-xs text-bone/30 mt-3">— sent to {messages[0].full_name ?? 'member'}</p>
          </div>
        )}

        {/* ── Search + table ──────────────────────────────────────────────── */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <p className="text-xs tracking-widest uppercase text-ink-muted font-medium">All Messages</p>
            <div className="relative">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted/50" width="12" height="12" viewBox="0 0 14 14" fill="none">
                <circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1.3"/>
                <path d="M9.5 9.5L13 13" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
              </svg>
              <input
                type="text"
                placeholder="Search…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-8 pr-4 py-1.5 text-sm bg-bone-dark border border-bone-deeper text-ink placeholder:text-ink-muted/50 focus:outline-none focus:border-gold transition-colors w-48"
              />
            </div>
          </div>

          {messages.length === 0 ? (
            <div className="border border-bone-deeper px-10 py-16 text-center">
              <p className="font-serif text-3xl font-bold text-bone-deeper mb-2">0</p>
              <p className="text-sm text-ink-muted">No messages generated yet for today.</p>
              <p className="text-xs text-ink-muted mt-1">Click &ldquo;Generate Today&rdquo; to create messages for all members.</p>
            </div>
          ) : (
            <div className="border border-bone-deeper divide-y divide-bone-deeper">
              {filtered.map(m => (
                <div key={m.id} className="px-6 py-5 hover:bg-bone-dark transition-colors">
                  <div className="flex items-start justify-between gap-6">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-2">
                        <p className="text-sm font-semibold text-ink">{m.full_name ?? 'Unknown'}</p>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          m.recovery_status === 'good'
                            ? 'bg-gold/10 text-gold'
                            : 'bg-[#b45454]/10 text-[#b45454]'
                        }`}>
                          {m.recovery_status === 'good' ? 'Good recovery' : 'Low recovery'}
                        </span>
                        <span className="text-xs text-ink-muted">Day {m.streak_days}</span>
                      </div>
                      <p className="text-sm text-ink-muted font-light leading-relaxed">{m.message}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {filtered.length > 0 && (
            <p className="text-xs text-ink-muted mt-3">
              Showing {filtered.length} of {messages.length} messages
            </p>
          )}
        </div>

      </div>
    </div>
  )
}
