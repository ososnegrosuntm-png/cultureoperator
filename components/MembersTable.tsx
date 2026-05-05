'use client'

import { useState, useMemo, useEffect, useRef } from 'react'
import type { MemberRow } from '@/app/(dashboard)/dashboard/members/page'

// ── Types & helpers ────────────────────────────────────────────────────────────

type Filter = 'all' | 'active' | 'inactive' | 'lead'

const STATUS_META = {
  active:    { label: 'Active',   dot: '#b8904a', text: 'text-[#b8904a]',   bg: 'bg-[#b8904a]/10' },
  inactive:  { label: 'Inactive', dot: '#b45454', text: 'text-[#b45454]',   bg: 'bg-[#b45454]/10' },
  lead:      { label: 'Lead',     dot: '#4a7eb8', text: 'text-[#4a7eb8]',   bg: 'bg-[#4a7eb8]/10' },
  suspended: { label: 'Suspended',dot: '#8a7a5a', text: 'text-[#8a7a5a]',   bg: 'bg-[#8a7a5a]/10' },
} as const

function initials(name: string | null | undefined) {
  if (!name) return '?'
  return name.split(' ').map(w => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase()
}

function fmtDate(iso: string | null | undefined) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function fmtPhone(raw: string | null | undefined) {
  if (!raw) return null
  const digits = raw.replace(/\D/g, '')
  if (digits.length === 11 && digits[0] === '1') {
    return `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`
  }
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`
  }
  return raw
}

// ── Status badge ───────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: MemberRow['status'] }) {
  const meta = STATUS_META[status] ?? STATUS_META.suspended
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold tracking-wide rounded-full ${meta.bg} ${meta.text}`}>
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: meta.dot }} />
      {meta.label}
    </span>
  )
}

// ── Member panel (side drawer) ─────────────────────────────────────────────────

function MemberPanel({
  member,
  onClose,
}: {
  member: MemberRow
  onClose: () => void
}) {
  const p = member.profile
  const name = p?.full_name || 'Unknown Member'
  const phone = fmtPhone(p?.phone)

  // Close on Escape key
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  const quickActionLabel =
    member.status === 'lead'     ? 'Mark as Active Member' :
    member.status === 'inactive' ? 'Re-engage Member'      :
    member.status === 'active'   ? 'View Full History'     :
                                   'Manage Member'

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-ink/20 z-40 backdrop-blur-[1px]"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <aside className="fixed inset-y-0 right-0 w-full max-w-[440px] bg-bone z-50 flex flex-col shadow-2xl overflow-y-auto">

        {/* Header */}
        <div className="flex items-center justify-between px-8 py-6 border-b border-bone-deeper shrink-0">
          <p className="text-xs tracking-widest uppercase font-semibold text-ink-muted">Member Profile</p>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-bone-dark transition-colors text-ink-muted hover:text-ink"
            aria-label="Close panel"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M1 1l12 12M13 1L1 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        {/* Identity block */}
        <div className="px-8 py-8 border-b border-bone-deeper">
          <div className="flex items-start gap-5">
            <div className="w-16 h-16 rounded-full bg-ink flex items-center justify-center shrink-0">
              <span className="font-serif text-xl font-bold text-bone">{initials(name)}</span>
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="font-serif text-2xl font-bold text-ink leading-tight">{name}</h2>
              <div className="mt-2">
                <StatusBadge status={member.status} />
              </div>
              {p?.instagram && (
                <p className="text-xs text-ink-muted mt-2">@{p.instagram.replace('@', '')}</p>
              )}
            </div>
          </div>
        </div>

        {/* Contact */}
        <div className="px-8 py-6 border-b border-bone-deeper">
          <p className="text-xs tracking-widest uppercase text-ink-muted font-medium mb-4">Contact</p>
          <dl className="space-y-3">
            <div className="flex gap-3">
              <dt className="text-xs text-ink-muted w-16 shrink-0 pt-0.5">Email</dt>
              <dd className="text-sm text-ink font-medium break-all">
                {p?.email
                  ? <a href={`mailto:${p.email}`} className="hover:text-gold transition-colors">{p.email}</a>
                  : <span className="text-ink-muted font-normal">—</span>}
              </dd>
            </div>
            <div className="flex gap-3">
              <dt className="text-xs text-ink-muted w-16 shrink-0 pt-0.5">Phone</dt>
              <dd className="text-sm text-ink font-medium">
                {phone
                  ? <a href={`tel:${p?.phone}`} className="hover:text-gold transition-colors">{phone}</a>
                  : <span className="text-ink-muted font-normal">—</span>}
              </dd>
            </div>
            <div className="flex gap-3">
              <dt className="text-xs text-ink-muted w-16 shrink-0 pt-0.5">Birthday</dt>
              <dd className="text-sm text-ink font-medium">
                {p?.birthday
                  ? new Date(p.birthday).toLocaleDateString('en-US', { month: 'long', day: 'numeric' })
                  : <span className="text-ink-muted font-normal">—</span>}
              </dd>
            </div>
          </dl>
        </div>

        {/* Membership */}
        <div className="px-8 py-6 border-b border-bone-deeper">
          <p className="text-xs tracking-widest uppercase text-ink-muted font-medium mb-4">Membership</p>
          <dl className="space-y-3">
            <div className="flex gap-3">
              <dt className="text-xs text-ink-muted w-16 shrink-0 pt-0.5">Status</dt>
              <dd><StatusBadge status={member.status} /></dd>
            </div>
            <div className="flex gap-3">
              <dt className="text-xs text-ink-muted w-16 shrink-0 pt-0.5">Joined</dt>
              <dd className="text-sm text-ink font-medium">{fmtDate(member.joined_at)}</dd>
            </div>
            <div className="flex gap-3">
              <dt className="text-xs text-ink-muted w-16 shrink-0 pt-0.5">Expires</dt>
              <dd className="text-sm text-ink font-medium">{fmtDate(member.expires_at)}</dd>
            </div>
          </dl>
        </div>

        {/* Quick actions */}
        <div className="px-8 py-6 mt-auto">
          <p className="text-xs tracking-widest uppercase text-ink-muted font-medium mb-4">Actions</p>
          <div className="space-y-2">
            <button
              className="w-full text-left text-sm font-semibold tracking-wide bg-ink text-bone px-5 py-3 hover:bg-ink-light transition-colors"
              onClick={onClose}
            >
              {quickActionLabel}
            </button>
            {p?.email && (
              <a
                href={`mailto:${p.email}`}
                className="block w-full text-center text-sm font-medium tracking-wide border border-bone-deeper text-ink-muted px-5 py-3 hover:bg-bone-dark hover:text-ink transition-colors"
              >
                Send Email
              </a>
            )}
          </div>
        </div>

      </aside>
    </>
  )
}

// ── Main table component ───────────────────────────────────────────────────────

export function MembersTable({ members }: { members: MemberRow[] }) {
  const [filter, setFilter] = useState<Filter>('all')
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<MemberRow | null>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  const counts = useMemo(() => ({
    all:      members.length,
    active:   members.filter(m => m.status === 'active').length,
    inactive: members.filter(m => m.status === 'inactive').length,
    lead:     members.filter(m => m.status === 'lead').length,
  }), [members])

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim()
    return members.filter(m => {
      const matchesFilter = filter === 'all' || m.status === filter
      if (!matchesFilter) return false
      if (!q) return true
      const name  = m.profile?.full_name?.toLowerCase() ?? ''
      const email = m.profile?.email?.toLowerCase() ?? ''
      const phone = m.profile?.phone ?? ''
      return name.includes(q) || email.includes(q) || phone.includes(q)
    })
  }, [members, filter, search])

  const TABS: { key: Filter; label: string }[] = [
    { key: 'all',      label: 'All' },
    { key: 'active',   label: 'Active' },
    { key: 'inactive', label: 'Inactive' },
    { key: 'lead',     label: 'Leads' },
  ]

  return (
    <>
      {/* ── Page header ───────────────────────────────────────────────────── */}
      <div className="border-b border-bone-deeper px-10 py-5 flex items-center justify-between">
        <div>
          <p className="text-xs tracking-widest uppercase text-ink-muted font-medium">Directory</p>
          <h2 className="font-serif text-2xl font-bold text-ink mt-0.5">Members</h2>
        </div>
        <span className="font-serif text-4xl font-bold text-ink-muted/30">{counts.all}</span>
      </div>

      {/* ── Filter tabs + search ───────────────────────────────────────────── */}
      <div className="px-10 pt-6 pb-0 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-bone-deeper">
        {/* Tabs */}
        <div className="flex gap-0">
          {TABS.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={`px-5 py-3 text-sm font-medium tracking-wide border-b-2 transition-colors whitespace-nowrap ${
                filter === key
                  ? 'border-gold text-ink font-semibold'
                  : 'border-transparent text-ink-muted hover:text-ink'
              }`}
            >
              {label}
              <span className={`ml-2 text-xs ${filter === key ? 'text-gold' : 'text-ink-muted/50'}`}>
                {counts[key] ?? members.length}
              </span>
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative mb-px">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted/50"
            width="14" height="14" viewBox="0 0 14 14" fill="none"
          >
            <circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1.3"/>
            <path d="M9.5 9.5L13 13" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
          </svg>
          <input
            ref={searchRef}
            type="text"
            placeholder="Search members…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 pr-4 py-2 text-sm bg-bone-dark border border-bone-deeper text-ink placeholder:text-ink-muted/50 focus:outline-none focus:border-gold transition-colors w-56"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-muted hover:text-ink"
              aria-label="Clear search"
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path d="M1 1l10 10M11 1L1 11" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* ── Table ─────────────────────────────────────────────────────────── */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-bone-deeper">
              <th className="px-10 py-3 text-left text-xs tracking-widest uppercase text-ink-muted font-medium">Member</th>
              <th className="px-4 py-3 text-left text-xs tracking-widest uppercase text-ink-muted font-medium hidden md:table-cell">Email</th>
              <th className="px-4 py-3 text-left text-xs tracking-widest uppercase text-ink-muted font-medium hidden lg:table-cell">Phone</th>
              <th className="px-4 py-3 text-left text-xs tracking-widest uppercase text-ink-muted font-medium">Status</th>
              <th className="px-4 py-3 text-left text-xs tracking-widest uppercase text-ink-muted font-medium hidden sm:table-cell">Joined</th>
              <th className="px-6 py-3 text-right text-xs tracking-widest uppercase text-ink-muted font-medium">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-bone-deeper">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-10 py-20 text-center">
                  <p className="font-serif text-3xl font-bold text-bone-deeper mb-2">0</p>
                  <p className="text-sm text-ink-muted">
                    {search ? `No members match "${search}"` : 'No members in this group'}
                  </p>
                </td>
              </tr>
            ) : (
              filtered.map(member => {
                const name  = member.profile?.full_name || 'Unknown'
                const email = member.profile?.email
                const phone = fmtPhone(member.profile?.phone)

                const quickLabel =
                  member.status === 'lead'     ? 'Convert'   :
                  member.status === 'inactive' ? 'Re-engage' :
                                                 'View'

                return (
                  <tr
                    key={member.id}
                    className="hover:bg-bone-dark transition-colors cursor-pointer group"
                    onClick={() => setSelected(member)}
                  >
                    {/* Name + avatar */}
                    <td className="px-10 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-ink flex items-center justify-center shrink-0">
                          <span className="text-[10px] font-bold text-bone">{initials(name)}</span>
                        </div>
                        <span className="text-sm font-medium text-ink">{name}</span>
                      </div>
                    </td>

                    {/* Email */}
                    <td className="px-4 py-4 hidden md:table-cell">
                      <span className="text-sm text-ink-muted">
                        {email ?? <span className="text-bone-deeper select-none">—</span>}
                      </span>
                    </td>

                    {/* Phone */}
                    <td className="px-4 py-4 hidden lg:table-cell">
                      <span className="text-sm text-ink-muted">
                        {phone ?? <span className="text-bone-deeper select-none">—</span>}
                      </span>
                    </td>

                    {/* Status */}
                    <td className="px-4 py-4">
                      <StatusBadge status={member.status} />
                    </td>

                    {/* Joined */}
                    <td className="px-4 py-4 hidden sm:table-cell">
                      <span className="text-sm text-ink-muted">{fmtDate(member.joined_at)}</span>
                    </td>

                    {/* Action */}
                    <td className="px-6 py-4 text-right" onClick={e => e.stopPropagation()}>
                      <button
                        onClick={() => setSelected(member)}
                        className="text-xs tracking-widest uppercase font-semibold text-ink-muted hover:text-gold transition-colors opacity-0 group-hover:opacity-100"
                      >
                        {quickLabel} →
                      </button>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {/* ── Result count ──────────────────────────────────────────────────── */}
      {filtered.length > 0 && (
        <div className="px-10 py-4 border-t border-bone-deeper">
          <p className="text-xs text-ink-muted">
            Showing {filtered.length} of {members.length} members
            {filter !== 'all' && ` · filtered by ${filter}`}
            {search && ` · search "${search}"`}
          </p>
        </div>
      )}

      {/* ── Side panel ────────────────────────────────────────────────────── */}
      {selected && (
        <MemberPanel member={selected} onClose={() => setSelected(null)} />
      )}
    </>
  )
}
