'use client'

import { useState, useMemo, useCallback } from 'react'
import type { CampaignMember } from '@/app/(dashboard)/dashboard/campaigns/page'

// ── Helpers ───────────────────────────────────────────────────────────────────

function initials(name: string | null | undefined) {
  if (!name) return '?'
  return name.split(' ').map(w => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase()
}

function firstName(name: string | null | undefined) {
  return name?.split(' ')[0]?.trim() || 'there'
}

function fmtDate(iso: string | null | undefined) {
  if (!iso) return null
  const d = new Date(iso)
  const now = new Date()
  const diffDays = Math.floor((now.getTime() - d.getTime()) / 86_400_000)
  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 30)  return `${diffDays}d ago`
  if (diffDays < 365) return `${Math.floor(diffDays / 30)}mo ago`
  return `${Math.floor(diffDays / 365)}y ago`
}

function fmtPhone(raw: string | null | undefined) {
  if (!raw) return null
  const d = raw.replace(/\D/g, '')
  if (d.length === 11 && d[0] === '1')
    return `+1 (${d.slice(1,4)}) ${d.slice(4,7)}-${d.slice(7)}`
  if (d.length === 10)
    return `(${d.slice(0,3)}) ${d.slice(3,6)}-${d.slice(6)}`
  return raw
}

const MESSAGE_TEMPLATE = (name: string) =>
  `Hey ${name}, we miss you at Osos Negros. Come back this week — first session is on us. Reply YES to confirm.`

// ── Sub-components ────────────────────────────────────────────────────────────

function StatPill({
  value, label, accent = false,
}: { value: string | number; label: string; accent?: boolean }) {
  return (
    <div className="flex flex-col gap-1">
      <span className={`font-serif text-4xl font-bold leading-none ${accent ? 'text-gold' : 'text-bone'}`}>
        {value}
      </span>
      <span className="text-xs tracking-widest uppercase text-bone/40 font-medium">{label}</span>
    </div>
  )
}

// ── Confirm modal ─────────────────────────────────────────────────────────────

function ConfirmModal({
  count,
  sampleName,
  onConfirm,
  onCancel,
}: {
  count: number
  sampleName: string
  onConfirm: () => void
  onCancel: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-ink/40 backdrop-blur-[2px]" onClick={onCancel} />

      {/* Modal */}
      <div className="relative bg-bone w-full max-w-md shadow-2xl z-10">
        {/* Header */}
        <div className="bg-ink px-8 py-6">
          <p className="text-xs tracking-widest uppercase text-gold font-semibold mb-1">Confirm Campaign</p>
          <p className="font-serif text-2xl font-bold text-bone">Send {count} messages?</p>
        </div>

        {/* Message preview */}
        <div className="px-8 py-6 border-b border-bone-deeper">
          <p className="text-xs tracking-widest uppercase text-ink-muted font-medium mb-3">Message Preview</p>
          <div className="bg-ink/5 border border-bone-deeper p-4">
            <p className="text-sm text-ink leading-relaxed">
              {MESSAGE_TEMPLATE(sampleName)}
            </p>
          </div>
          <p className="text-xs text-ink-muted mt-2">
            {MESSAGE_TEMPLATE(sampleName).length} characters · each recipient&apos;s first name is substituted automatically
          </p>
        </div>

        {/* Warning */}
        <div className="px-8 py-5 border-b border-bone-deeper bg-bone-dark">
          <div className="flex gap-3">
            <span className="text-gold mt-0.5 shrink-0">—</span>
            <p className="text-sm text-ink-muted leading-relaxed">
              This will immediately send <strong className="text-ink">{count} SMS messages</strong> via Twilio.
              Standard carrier rates apply. This action cannot be undone.
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="px-8 py-6 flex gap-3">
          <button
            onClick={onConfirm}
            className="flex-1 bg-ink text-bone text-sm font-semibold tracking-wide px-6 py-3 hover:bg-ink-light transition-colors"
          >
            Launch Campaign →
          </button>
          <button
            onClick={onCancel}
            className="px-6 py-3 text-sm font-medium text-ink-muted border border-bone-deeper hover:bg-bone-dark transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Results view ──────────────────────────────────────────────────────────────

function ResultsView({
  sent, skipped, failed, errors, onDone,
}: {
  sent: number; skipped: number; failed: number; errors: string[]
  onDone: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
      <div className="absolute inset-0 bg-ink/40 backdrop-blur-[2px]" />
      <div className="relative bg-bone w-full max-w-md shadow-2xl z-10">
        {/* Header */}
        <div className="bg-ink px-8 py-6">
          <p className="text-xs tracking-widest uppercase text-gold font-semibold mb-1">Campaign Complete</p>
          <p className="font-serif text-2xl font-bold text-bone">Messages sent.</p>
        </div>

        {/* Stats */}
        <div className="px-8 py-6 border-b border-bone-deeper">
          <div className="grid grid-cols-3 gap-px bg-bone-deeper border border-bone-deeper">
            <div className="bg-bone p-5 text-center">
              <p className="font-serif text-4xl font-bold text-gold">{sent}</p>
              <p className="text-xs tracking-widest uppercase text-ink-muted mt-1">Sent</p>
            </div>
            <div className="bg-bone p-5 text-center">
              <p className="font-serif text-4xl font-bold text-ink-muted">{skipped}</p>
              <p className="text-xs tracking-widest uppercase text-ink-muted mt-1">Skipped</p>
            </div>
            <div className="bg-bone p-5 text-center">
              <p className={`font-serif text-4xl font-bold ${failed > 0 ? 'text-[#b45454]' : 'text-ink-muted'}`}>{failed}</p>
              <p className="text-xs tracking-widest uppercase text-ink-muted mt-1">Failed</p>
            </div>
          </div>
          {skipped > 0 && (
            <p className="text-xs text-ink-muted mt-3">
              {skipped} member{skipped > 1 ? 's' : ''} skipped — no phone number on file.
              Run the import script after applying migration 002 to backfill contact data.
            </p>
          )}
        </div>

        {errors.length > 0 && (
          <div className="px-8 py-4 border-b border-bone-deeper">
            <p className="text-xs tracking-widest uppercase text-ink-muted font-medium mb-2">Errors</p>
            <ul className="space-y-1">
              {errors.map((e, i) => (
                <li key={i} className="text-xs text-[#b45454] leading-relaxed">{e}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="px-8 py-6">
          <button
            onClick={onDone}
            className="w-full bg-ink text-bone text-sm font-semibold tracking-wide px-6 py-3 hover:bg-ink-light transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

type SendState = 'idle' | 'confirming' | 'sending' | 'done'
type SendResult = { sent: number; skipped: number; failed: number; errors: string[] }

export function CampaignPanel({ members }: { members: CampaignMember[] }) {
  const withPhone = useMemo(() => members.filter(m => m.profile?.phone), [members])

  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(withPhone.map(m => m.id))
  )
  const [search,    setSearch]    = useState('')
  const [sendState, setSendState] = useState<SendState>('idle')
  const [result,    setResult]    = useState<SendResult | null>(null)
  const [sendError, setSendError] = useState<string | null>(null)

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim()
    if (!q) return members
    return members.filter(m => {
      const name  = m.profile?.full_name?.toLowerCase() ?? ''
      const phone = m.profile?.phone ?? ''
      return name.includes(q) || phone.includes(q)
    })
  }, [members, search])

  const selectedCount = useMemo(
    () => Array.from(selected).filter(id => members.find(m => m.id === id)).length,
    [selected, members]
  )

  const allVisibleSelected = filtered.length > 0 && filtered.every(m => selected.has(m.id))

  const toggleAll = useCallback(() => {
    setSelected(prev => {
      const next = new Set(prev)
      if (allVisibleSelected) {
        filtered.forEach(m => next.delete(m.id))
      } else {
        filtered.forEach(m => { if (m.profile?.phone) next.add(m.id) })
      }
      return next
    })
  }, [allVisibleSelected, filtered])

  const toggleOne = useCallback((id: string, hasPhone: boolean) => {
    if (!hasPhone) return
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) { next.delete(id) } else { next.add(id) }
      return next
    })
  }, [])

  async function handleSend() {
    setSendState('sending')
    setSendError(null)
    try {
      const res = await fetch('/api/campaigns/sms', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ memberIds: Array.from(selected) }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Unknown server error')
      setResult(data)
      setSendState('done')
    } catch (err) {
      setSendError(err instanceof Error ? err.message : String(err))
      setSendState('idle')
    }
  }

  // A sample first name for the message preview
  const sampleName = firstName(withPhone[0]?.profile?.full_name) || 'Maria'

  return (
    <>
      {/* ── Page header ─────────────────────────────────────────────────── */}
      <div className="border-b border-bone-deeper px-10 py-5 flex items-center justify-between">
        <div>
          <p className="text-xs tracking-widest uppercase text-ink-muted font-medium">Campaigns</p>
          <h2 className="font-serif text-2xl font-bold text-ink mt-0.5">SMS Re-engagement</h2>
        </div>
      </div>

      <div className="px-10 py-10 space-y-10">

        {/* ── Campaign stats + message preview ─────────────────────────── */}
        <div className="bg-ink flex flex-col lg:flex-row gap-px">

          {/* Stats column */}
          <div className="lg:w-72 shrink-0 p-8 flex flex-col justify-between gap-8 border-r border-bone/8">
            <div>
              <p className="text-xs tracking-widest uppercase text-gold font-semibold mb-6">Campaign Overview</p>
              <div className="space-y-6">
                <StatPill value={members.length}  label="Inactive members" />
                <StatPill value={withPhone.length} label="Have phone numbers" accent />
                <StatPill value={selectedCount}    label="Selected to receive" />
              </div>
            </div>
            <div className="border-t border-bone/10 pt-6">
              <p className="text-xs text-bone/30 leading-relaxed">
                Requires <span className="text-bone/50 font-medium">TWILIO_ACCOUNT_SID</span>,{' '}
                <span className="text-bone/50 font-medium">TWILIO_AUTH_TOKEN</span>, and{' '}
                <span className="text-bone/50 font-medium">TWILIO_FROM_NUMBER</span> in your environment.
              </p>
            </div>
          </div>

          {/* Message preview */}
          <div className="flex-1 p-8">
            <p className="text-xs tracking-widest uppercase text-bone/40 font-medium mb-4">Message Preview</p>
            {/* SMS bubble */}
            <div className="max-w-sm">
              <div className="bg-bone/10 rounded-2xl rounded-tl-sm px-5 py-4 inline-block">
                <p className="text-sm text-bone leading-relaxed">
                  {MESSAGE_TEMPLATE(sampleName)}
                </p>
              </div>
              <p className="text-[10px] text-bone/25 mt-2 ml-1">
                {MESSAGE_TEMPLATE(sampleName).length} chars · 1 SMS segment ·{' '}
                <span className="italic">first name personalised per recipient</span>
              </p>
            </div>
          </div>
        </div>

        {/* ── Error banner ─────────────────────────────────────────────── */}
        {sendError && (
          <div className="border border-[#b45454]/30 bg-[#b45454]/5 px-6 py-4 flex items-start gap-3">
            <span className="text-[#b45454] font-bold shrink-0">!</span>
            <p className="text-sm text-[#b45454] leading-relaxed">{sendError}</p>
          </div>
        )}

        {/* ── Member list ──────────────────────────────────────────────── */}
        <div>
          {/* List header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5">
            <p className="text-xs tracking-widest uppercase text-ink-muted font-medium">
              Inactive Members
            </p>
            {/* Search */}
            <div className="relative">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted/50" width="13" height="13" viewBox="0 0 13 13" fill="none">
                <circle cx="5.5" cy="5.5" r="4" stroke="currentColor" strokeWidth="1.3"/>
                <path d="M9 9l3 3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
              </svg>
              <input
                type="text"
                placeholder="Search…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-8 pr-4 py-2 text-sm bg-bone-dark border border-bone-deeper text-ink placeholder:text-ink-muted/50 focus:outline-none focus:border-gold transition-colors w-48"
              />
            </div>
          </div>

          <div className="border border-bone-deeper">
            {/* Table head */}
            <div className="grid grid-cols-[auto_1fr_1fr_1fr_auto] gap-0 border-b border-bone-deeper bg-bone-dark">
              {/* Select-all checkbox */}
              <div className="px-4 py-3 flex items-center">
                <button
                  onClick={toggleAll}
                  className={`w-4 h-4 border flex items-center justify-center shrink-0 transition-colors ${
                    allVisibleSelected
                      ? 'bg-ink border-ink'
                      : 'border-bone-deeper hover:border-ink-muted'
                  }`}
                  aria-label="Select all"
                >
                  {allVisibleSelected && (
                    <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                      <path d="M1 4l2 2 4-4" stroke="white" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  )}
                </button>
              </div>
              <div className="px-4 py-3 text-xs tracking-widest uppercase text-ink-muted font-medium">Name</div>
              <div className="px-4 py-3 text-xs tracking-widest uppercase text-ink-muted font-medium hidden md:block">Phone</div>
              <div className="px-4 py-3 text-xs tracking-widest uppercase text-ink-muted font-medium hidden sm:block">Last Active</div>
              <div className="px-6 py-3 text-xs tracking-widest uppercase text-ink-muted font-medium text-right">Status</div>
            </div>

            {/* Rows */}
            <div className="divide-y divide-bone-deeper">
              {filtered.length === 0 ? (
                <div className="px-10 py-16 text-center">
                  <p className="font-serif text-3xl font-bold text-bone-deeper mb-2">0</p>
                  <p className="text-sm text-ink-muted">No members match your search</p>
                </div>
              ) : filtered.map(member => {
                const name    = member.profile?.full_name || 'Unknown'
                const phone   = fmtPhone(member.profile?.phone)
                const hasPhone = !!member.profile?.phone
                const isSelected = selected.has(member.id)
                const lastSeen = fmtDate(member.last_seen ?? member.joined_at)

                return (
                  <div
                    key={member.id}
                    className={`grid grid-cols-[auto_1fr_1fr_1fr_auto] gap-0 transition-colors ${
                      hasPhone
                        ? isSelected
                          ? 'bg-bone hover:bg-bone-dark cursor-pointer'
                          : 'bg-bone hover:bg-bone-dark cursor-pointer opacity-50'
                        : 'bg-bone/50 opacity-40 cursor-not-allowed'
                    }`}
                    onClick={() => toggleOne(member.id, hasPhone)}
                  >
                    {/* Checkbox */}
                    <div className="px-4 py-4 flex items-center">
                      <div className={`w-4 h-4 border flex items-center justify-center shrink-0 transition-colors ${
                        isSelected && hasPhone
                          ? 'bg-ink border-ink'
                          : 'border-bone-deeper'
                      }`}>
                        {isSelected && hasPhone && (
                          <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                            <path d="M1 4l2 2 4-4" stroke="white" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        )}
                      </div>
                    </div>

                    {/* Name */}
                    <div className="px-4 py-4 flex items-center gap-3 min-w-0">
                      <div className="w-7 h-7 rounded-full bg-ink flex items-center justify-center shrink-0">
                        <span className="text-[9px] font-bold text-bone">{initials(name)}</span>
                      </div>
                      <span className="text-sm font-medium text-ink truncate">{name}</span>
                    </div>

                    {/* Phone */}
                    <div className="px-4 py-4 items-center hidden md:flex">
                      {phone
                        ? <span className="text-sm text-ink-muted">{phone}</span>
                        : <span className="text-xs text-ink-muted/40 italic">No phone</span>
                      }
                    </div>

                    {/* Last active */}
                    <div className="px-4 py-4 items-center hidden sm:flex">
                      <span className="text-sm text-ink-muted">{lastSeen ?? '—'}</span>
                    </div>

                    {/* Will receive indicator */}
                    <div className="px-6 py-4 flex items-center justify-end">
                      {hasPhone && isSelected && (
                        <span className="text-[10px] tracking-widest uppercase font-semibold text-gold">Will receive</span>
                      )}
                      {hasPhone && !isSelected && (
                        <span className="text-[10px] tracking-widest uppercase font-semibold text-ink-muted/40">Excluded</span>
                      )}
                      {!hasPhone && (
                        <span className="text-[10px] tracking-widest uppercase font-semibold text-ink-muted/30">No phone</span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Table footer */}
            <div className="px-5 py-3 border-t border-bone-deeper bg-bone-dark flex items-center justify-between gap-4">
              <p className="text-xs text-ink-muted">
                {selectedCount} of {members.length} selected ·{' '}
                {members.length - withPhone.length} have no phone on file
              </p>
              <button
                onClick={() => setSelected(new Set(withPhone.map(m => m.id)))}
                className="text-xs tracking-widest uppercase font-semibold text-ink-muted hover:text-gold transition-colors"
              >
                Select all with phone
              </button>
            </div>
          </div>
        </div>

        {/* ── Send bar ─────────────────────────────────────────────────── */}
        <div className="border border-bone-deeper bg-bone-dark px-8 py-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <p className="font-serif text-xl font-bold text-ink">
              Ready to send to {selectedCount} member{selectedCount !== 1 ? 's' : ''}
            </p>
            <p className="text-sm text-ink-muted mt-0.5">
              {members.length - withPhone.length > 0
                ? `${members.length - withPhone.length} will be skipped — no phone number.`
                : 'All selected members have phone numbers on file.'}
            </p>
          </div>
          <button
            onClick={() => setSendState('confirming')}
            disabled={selectedCount === 0 || sendState === 'sending'}
            className="shrink-0 bg-ink text-bone text-sm font-semibold tracking-wide px-8 py-3.5 hover:bg-ink-light transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-3"
          >
            {sendState === 'sending' ? (
              <>
                <span className="w-3 h-3 border border-bone/30 border-t-bone rounded-full animate-spin" />
                Sending…
              </>
            ) : (
              <>Launch Campaign →</>
            )}
          </button>
        </div>

        {/* ── Footer ───────────────────────────────────────────────────── */}
        <div className="flex items-center gap-4 pt-2">
          <div className="h-px flex-1 bg-bone-deeper" />
          <p className="text-xs text-ink-muted font-light tracking-wide">
            SMS delivered via Twilio · standard carrier rates apply · {new Date().getFullYear()}
          </p>
          <div className="h-px flex-1 bg-bone-deeper" />
        </div>

      </div>

      {/* ── Modals ───────────────────────────────────────────────────────── */}
      {sendState === 'confirming' && (
        <ConfirmModal
          count={selectedCount}
          sampleName={sampleName}
          onConfirm={handleSend}
          onCancel={() => setSendState('idle')}
        />
      )}

      {sendState === 'done' && result && (
        <ResultsView
          {...result}
          onDone={() => {
            setSendState('idle')
            setResult(null)
            // Deselect everyone who was sent to
            setSelected(new Set())
          }}
        />
      )}
    </>
  )
}
