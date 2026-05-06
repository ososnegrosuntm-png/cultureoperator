'use client'

import { useState, useCallback } from 'react'

export type CampaignMember = {
  id: string
  full_name: string | null
  phone: string | null
  email: string | null
}

type SendStatus = 'idle' | 'sending' | 'sent' | 'failed'

function initials(name: string | null | undefined) {
  if (!name) return '?'
  return name.split(' ').map(w => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase()
}

function fmtPhone(raw: string | null | undefined) {
  if (!raw) return null
  const d = raw.replace(/\D/g, '')
  if (d.length === 11 && d[0] === '1') return `+1 (${d.slice(1,4)}) ${d.slice(4,7)}-${d.slice(7)}`
  if (d.length === 10) return `(${d.slice(0,3)}) ${d.slice(3,6)}-${d.slice(6)}`
  return raw
}

type SyncState = 'idle' | 'syncing' | 'done' | 'error'
type SyncResult = { synced: number; updated: number; errored: number; skipped_no_email: number; total_fetched: number }

export function CampaignPanel({ members }: { members: CampaignMember[] }) {
  const [statuses, setStatuses] = useState<Record<string, SendStatus>>({})
  const [sendingAll, setSendingAll] = useState(false)
  const [allResult, setAllResult] = useState<{ sent: number; failed: number } | null>(null)
  const [search, setSearch] = useState('')
  const [syncState, setSyncState]   = useState<SyncState>('idle')
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null)
  const [syncError, setSyncError]   = useState<string | null>(null)

  const withPhone  = members.filter(m => m.phone)
  const filtered   = members.filter(m => {
    const q = search.toLowerCase().trim()
    if (!q) return true
    return (
      m.full_name?.toLowerCase().includes(q) ||
      (m.phone ?? '').includes(q)
    )
  })

  const setStatus = (id: string, s: SendStatus) =>
    setStatuses(prev => ({ ...prev, [id]: s }))

  const sendOne = useCallback(async (member: CampaignMember) => {
    if (!member.phone) return
    setStatus(member.id, 'sending')
    try {
      const res  = await fetch('/api/sms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profileIds: [member.id] }),
      })
      const data = await res.json()
      if (!res.ok || data.failed > 0) throw new Error(data.errors?.[0] ?? 'Send failed')
      setStatus(member.id, 'sent')
    } catch {
      setStatus(member.id, 'failed')
    }
  }, [])

  const sendAll = useCallback(async () => {
    setSendingAll(true)
    setAllResult(null)
    const ids = withPhone.map(m => m.id)
    // Mark all as sending
    setStatuses(Object.fromEntries(ids.map(id => [id, 'sending' as SendStatus])))
    try {
      const res  = await fetch('/api/sms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profileIds: ids }),
      })
      const data = await res.json()
      // Mark individually
      setStatuses(prev => {
        const next = { ...prev }
        ids.forEach(id => { next[id] = 'sent' })
        return next
      })
      setAllResult({ sent: data.sent, failed: data.failed })
    } catch {
      setStatuses(Object.fromEntries(ids.map(id => [id, 'failed' as SendStatus])))
    } finally {
      setSendingAll(false)
    }
  }, [withPhone])

  const syncToMailchimp = useCallback(async () => {
    setSyncState('syncing')
    setSyncResult(null)
    setSyncError(null)
    try {
      const res  = await fetch('/api/mailchimp/sync', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ members }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Mailchimp sync failed')
      setSyncResult(data as SyncResult)
      setSyncState('done')
    } catch (err) {
      setSyncError(err instanceof Error ? err.message : String(err))
      setSyncState('error')
    }
  }, [members])

  const sentCount   = Object.values(statuses).filter(s => s === 'sent').length
  const failedCount = Object.values(statuses).filter(s => s === 'failed').length

  return (
    <div className="min-h-full bg-bone">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="border-b border-bone-deeper px-10 py-5 flex items-center justify-between gap-6">
        <div>
          <p className="text-xs tracking-widest uppercase text-ink-muted font-medium">SMS Campaign</p>
          <h2 className="font-serif text-2xl font-bold text-ink mt-0.5">Re-engagement</h2>
        </div>

        <div className="flex items-center gap-3 shrink-0 flex-wrap justify-end">
          {allResult && (
            <p className="text-xs text-ink-muted">
              {allResult.sent} sent{allResult.failed > 0 ? ` · ${allResult.failed} failed` : ''}
            </p>
          )}
          <button
            onClick={sendAll}
            disabled={sendingAll || withPhone.length === 0}
            className="text-xs tracking-widest uppercase font-semibold bg-ink text-bone px-5 py-2.5 hover:bg-ink-light transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {sendingAll ? 'Sending…' : `Send All (${withPhone.length})`}
          </button>
          <button
            onClick={syncToMailchimp}
            disabled={syncState === 'syncing'}
            className="text-xs tracking-widest uppercase font-semibold border border-gold text-gold px-5 py-2.5 hover:bg-gold hover:text-bone transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {syncState === 'syncing' ? 'Syncing…' : 'Sync to Mailchimp'}
          </button>
        </div>
      </div>

      <div className="px-10 py-8 space-y-8">

        {/* ── Mailchimp sync result ───────────────────────────────────────────── */}
        {syncState === 'done' && syncResult && (
          <div className="bg-ink px-8 py-5 flex items-center justify-between">
            <div>
              <p className="text-xs tracking-widest uppercase text-gold/60 font-medium mb-1">Mailchimp Sync Complete</p>
              <p className="text-sm text-bone font-light">
                <span className="font-semibold text-gold">{syncResult.synced}</span> new
                {' · '}
                <span className="font-semibold text-bone">{syncResult.updated}</span> updated
                {syncResult.errored > 0 && <span className="text-[#b45454]"> · {syncResult.errored} errors</span>}
                {syncResult.skipped_no_email > 0 && <span className="text-bone/40"> · {syncResult.skipped_no_email} skipped (no email)</span>}
              </p>
            </div>
            <button onClick={() => setSyncState('idle')} className="text-bone/30 hover:text-bone transition-colors text-lg leading-none">×</button>
          </div>
        )}
        {syncState === 'error' && syncError && (
          <div className="bg-[#b45454]/10 border border-[#b45454]/20 px-6 py-4 flex items-center justify-between">
            <p className="text-sm text-[#b45454]">{syncError}</p>
            <button onClick={() => setSyncState('idle')} className="text-[#b45454]/50 hover:text-[#b45454] transition-colors text-lg leading-none ml-4">×</button>
          </div>
        )}

        {/* ── Stats ──────────────────────────────────────────────────────────── */}
        <div className="grid grid-cols-3 gap-px bg-bone-deeper border border-bone-deeper">
          <div className="bg-bone p-6">
            <p className="font-serif text-4xl font-bold text-ink">{members.length}</p>
            <p className="text-xs text-ink-muted mt-1">members</p>
          </div>
          <div className="bg-bone p-6">
            <p className="font-serif text-4xl font-bold text-gold">{withPhone.length}</p>
            <p className="text-xs text-ink-muted mt-1">with phone numbers</p>
          </div>
          <div className="bg-bone p-6">
            <p className="font-serif text-4xl font-bold text-ink">{sentCount}</p>
            <p className="text-xs text-ink-muted mt-1">sent this session</p>
          </div>
        </div>

        {/* ── Message preview ─────────────────────────────────────────────── */}
        <div className="bg-ink px-8 py-6">
          <p className="text-xs tracking-widest uppercase text-gold/60 font-medium mb-3">Message Template</p>
          <p className="text-sm text-bone font-light leading-relaxed">
            &ldquo;Hey [First Name], we miss you at Osos Negros! Come back this week — first session is on us. Reply YES to confirm.&rdquo;
          </p>
        </div>

        {/* ── Search ──────────────────────────────────────────────────────── */}
        <div className="relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted/50" width="14" height="14" viewBox="0 0 14 14" fill="none">
            <circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1.3"/>
            <path d="M9.5 9.5L13 13" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
          </svg>
          <input
            type="text"
            placeholder="Search members…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 text-sm bg-bone-dark border border-bone-deeper text-ink placeholder:text-ink-muted/50 focus:outline-none focus:border-gold transition-colors"
          />
        </div>

        {/* ── Member list ─────────────────────────────────────────────────── */}
        <div className="border border-bone-deeper divide-y divide-bone-deeper">
          {filtered.length === 0 ? (
            <div className="px-10 py-16 text-center">
              <p className="text-sm text-ink-muted">No members match &ldquo;{search}&rdquo;</p>
            </div>
          ) : (
            filtered.map(member => {
              const status  = statuses[member.id] ?? 'idle'
              const phone   = fmtPhone(member.phone)
              const name    = member.full_name || 'Unknown'
              const hasPhone = !!member.phone

              return (
                <div
                  key={member.id}
                  className="flex items-center gap-4 px-6 py-4 hover:bg-bone-dark transition-colors group"
                >
                  {/* Avatar */}
                  <div className="w-9 h-9 rounded-full bg-ink flex items-center justify-center shrink-0">
                    <span className="text-[10px] font-bold text-bone">{initials(name)}</span>
                  </div>

                  {/* Name + phone */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-ink truncate">{name}</p>
                    <p className="text-xs text-ink-muted mt-0.5">
                      {phone ?? <span className="italic">No phone on file</span>}
                    </p>
                  </div>

                  {/* Status / Send button */}
                  <div className="shrink-0">
                    {status === 'sent' && (
                      <span className="text-xs font-semibold text-gold tracking-wide">Sent ✓</span>
                    )}
                    {status === 'failed' && (
                      <span className="text-xs font-semibold text-[#b45454] tracking-wide">Failed</span>
                    )}
                    {status === 'sending' && (
                      <span className="text-xs text-ink-muted tracking-wide">Sending…</span>
                    )}
                    {status === 'idle' && (
                      <button
                        onClick={() => sendOne(member)}
                        disabled={!hasPhone}
                        className="text-xs tracking-widest uppercase font-semibold text-ink-muted hover:text-gold transition-colors opacity-0 group-hover:opacity-100 disabled:opacity-20 disabled:cursor-not-allowed"
                      >
                        Send →
                      </button>
                    )}
                  </div>
                </div>
              )
            })
          )}
        </div>

        {/* ── Footer count ────────────────────────────────────────────────── */}
        {filtered.length > 0 && (
          <p className="text-xs text-ink-muted">
            Showing {filtered.length} of {members.length} members
            {sentCount > 0 && ` · ${sentCount} sent`}
            {failedCount > 0 && ` · ${failedCount} failed`}
          </p>
        )}

      </div>
    </div>
  )
}
