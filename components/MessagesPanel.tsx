'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

export type Message = {
  id: string
  gym_id: string
  sender_id: string
  recipient_id: string
  body: string
  read: boolean
  created_at: string
}

export type ContactProfile = {
  id: string
  full_name: string | null
  email: string | null
}

type Props = {
  currentUserId: string
  gymId: string
  isOwner: boolean
  initialMessages: Message[]
  contacts: ContactProfile[]
  ownerId: string
}

type InviteState = 'idle' | 'sending' | 'sent' | 'already_active' | 'no_email' | 'error'

function initials(name: string | null | undefined) {
  if (!name) return '?'
  return name.split(' ').map(w => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase()
}

function fmtTime(ts: string) {
  const d = new Date(ts)
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
  if (diffDays === 0) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7) return d.toLocaleDateString([], { weekday: 'short' })
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' })
}

// ── Shared message bubble ──────────────────────────────────────────────────────
function Bubble({ msg, isMe }: { msg: Message; isMe: boolean }) {
  return (
    <div className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-md px-4 py-3 ${
          isMe
            ? 'bg-ink text-bone'
            : 'bg-bone-dark border border-bone-deeper text-ink'
        }`}
      >
        <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.body}</p>
        <p className={`text-[10px] mt-1.5 ${isMe ? 'text-bone/40' : 'text-ink-muted'}`}>
          {fmtTime(msg.created_at)}
          {isMe && msg.read && <span className="ml-1.5">✓</span>}
        </p>
      </div>
    </div>
  )
}

// ── Compose bar ───────────────────────────────────────────────────────────────
function ComposeBar({
  value,
  onChange,
  onSend,
  disabled,
}: {
  value: string
  onChange: (v: string) => void
  onSend: () => void
  disabled: boolean
}) {
  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      onSend()
    }
  }
  return (
    <div className="border-t border-bone-deeper px-8 py-4 flex gap-3 bg-bone">
      <textarea
        value={value}
        onChange={e => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Type a message… (Enter to send, Shift+Enter for new line)"
        rows={1}
        className="flex-1 resize-none bg-bone-dark border border-bone-deeper text-sm text-ink placeholder:text-ink-muted/50 px-4 py-2.5 focus:outline-none focus:border-gold transition-colors"
      />
      <button
        onClick={onSend}
        disabled={disabled || !value.trim()}
        className="text-xs tracking-widest uppercase font-semibold bg-ink text-bone px-5 py-2.5 hover:bg-ink-light transition-colors disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
      >
        Send
      </button>
    </div>
  )
}

// ── Main panel ────────────────────────────────────────────────────────────────
export function MessagesPanel({
  currentUserId,
  gymId,
  isOwner,
  initialMessages,
  contacts,
  ownerId,
}: Props) {
  const [messages, setMessages] = useState<Message[]>(initialMessages)
  const [selectedId, setSelectedId] = useState<string | null>(
    isOwner ? null : ownerId
  )
  const [body, setBody] = useState('')
  const [sending, setSending] = useState(false)
  const [inviteStates, setInviteStates] = useState<Record<string, InviteState>>({})
  const [inviteErrors, setInviteErrors] = useState<Record<string, string>>({})
  const threadRef = useRef<HTMLDivElement>(null)
  const supabase = createClient()

  // Scroll thread to bottom whenever messages or selection changes
  const scrollToBottom = useCallback(() => {
    setTimeout(() => {
      if (threadRef.current) {
        threadRef.current.scrollTop = threadRef.current.scrollHeight
      }
    }, 50)
  }, [])

  useEffect(() => { scrollToBottom() }, [messages, selectedId, scrollToBottom])

  // ── Real-time subscription ─────────────────────────────────────────────────
  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const channel = (supabase as any)
      .channel(`messages:gym:${gymId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `gym_id=eq.${gymId}` },
        (payload: { new: Message }) => {
          const m = payload.new
          if (m.sender_id === currentUserId || m.recipient_id === currentUserId) {
            setMessages(prev => [...prev, m])
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'messages', filter: `gym_id=eq.${gymId}` },
        (payload: { new: Message }) => {
          setMessages(prev => prev.map(m => (m.id === payload.new.id ? payload.new : m)))
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [gymId, currentUserId, supabase])

  // ── Mark messages read when opening a thread ───────────────────────────────
  const messagesRef = useRef(messages)
  useEffect(() => { messagesRef.current = messages }, [messages])

  useEffect(() => {
    if (!selectedId) return
    const unreadIds = messagesRef.current
      .filter(m => m.sender_id === selectedId && m.recipient_id === currentUserId && !m.read)
      .map(m => m.id)
    if (unreadIds.length === 0) return

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(supabase as any)
      .from('messages')
      .update({ read: true })
      .in('id', unreadIds)
      .then(() => {
        setMessages(prev =>
          prev.map(m => (unreadIds.includes(m.id) ? { ...m, read: true } : m))
        )
      })
  }, [selectedId, supabase, currentUserId])

  // ── Derived data ───────────────────────────────────────────────────────────
  const conversations = contacts
    .map(contact => {
      const thread = messages.filter(
        m =>
          (m.sender_id === contact.id && m.recipient_id === currentUserId) ||
          (m.sender_id === currentUserId && m.recipient_id === contact.id)
      )
      const latest = thread.length > 0 ? thread[thread.length - 1] : null
      const unread = thread.filter(
        m => m.sender_id === contact.id && m.recipient_id === currentUserId && !m.read
      ).length
      return { contact, latest, unread }
    })
    .sort((a, b) => {
      if (!a.latest && !b.latest) return 0
      if (!a.latest) return 1
      if (!b.latest) return -1
      return new Date(b.latest.created_at).getTime() - new Date(a.latest.created_at).getTime()
    })

  const activeThread = selectedId
    ? messages
        .filter(
          m =>
            (m.sender_id === selectedId && m.recipient_id === currentUserId) ||
            (m.sender_id === currentUserId && m.recipient_id === selectedId)
        )
        .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
    : []

  const activeContact = contacts.find(c => c.id === selectedId)
  const totalUnread = conversations.reduce((acc, c) => acc + c.unread, 0)

  // ── Send ───────────────────────────────────────────────────────────────────
  async function sendMessage() {
    if (!body.trim() || !selectedId || sending) return
    setSending(true)
    const text = body.trim()
    setBody('')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any).from('messages').insert({
      gym_id: gymId,
      sender_id: currentUserId,
      recipient_id: selectedId,
      body: text,
      read: false,
    })
    if (error) {
      console.error('[messages] send failed:', error.message)
      setBody(text) // restore on error
    }
    setSending(false)
  }

  // ── Invite ─────────────────────────────────────────────────────────────────
  async function sendInvite(contactId: string) {
    const contact = contacts.find(c => c.id === contactId)
    if (!contact) return
    if (!contact.email) {
      setInviteStates(p => ({ ...p, [contactId]: 'no_email' }))
      return
    }
    setInviteStates(p => ({ ...p, [contactId]: 'sending' }))
    setInviteErrors(p => { const n = { ...p }; delete n[contactId]; return n })
    try {
      const res  = await fetch('/api/invite', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ profileId: contactId }),
      })
      const data = await res.json()
      if (data.already_active) {
        setInviteStates(p => ({ ...p, [contactId]: 'already_active' }))
      } else if (!res.ok) {
        setInviteStates(p => ({ ...p, [contactId]: 'error' }))
        setInviteErrors(p => ({ ...p, [contactId]: data.error ?? 'Invite failed' }))
      } else {
        setInviteStates(p => ({ ...p, [contactId]: 'sent' }))
      }
    } catch {
      setInviteStates(p => ({ ...p, [contactId]: 'error' }))
      setInviteErrors(p => ({ ...p, [contactId]: 'Network error' }))
    }
  }

  // ── Member view (single thread, no sidebar) ────────────────────────────────
  if (!isOwner) {
    return (
      <div className="min-h-full bg-bone flex flex-col h-screen">
        <div className="border-b border-bone-deeper px-10 py-5 flex items-center gap-4 shrink-0">
          <div className="w-9 h-9 rounded-full bg-ink flex items-center justify-center shrink-0">
            <span className="text-[10px] font-bold text-bone">{initials(activeContact?.full_name)}</span>
          </div>
          <div>
            <p className="text-xs tracking-widest uppercase text-ink-muted font-medium">Direct Message</p>
            <h2 className="font-serif text-xl font-bold text-ink mt-0.5">
              {activeContact?.full_name ?? 'Coach'}
            </h2>
          </div>
        </div>

        <div ref={threadRef} className="flex-1 overflow-y-auto px-10 py-6 space-y-4">
          {activeThread.length === 0 ? (
            <div className="text-center py-16">
              <p className="font-serif text-2xl font-bold text-bone-deeper mb-2">Start the conversation</p>
              <p className="text-sm text-ink-muted">Send a message to your coach below</p>
            </div>
          ) : (
            activeThread.map(msg => (
              <Bubble key={msg.id} msg={msg} isMe={msg.sender_id === currentUserId} />
            ))
          )}
        </div>

        <ComposeBar
          value={body}
          onChange={setBody}
          onSend={sendMessage}
          disabled={sending}
        />
      </div>
    )
  }

  // ── Owner view (sidebar + thread) ──────────────────────────────────────────
  return (
    <div className="min-h-full bg-bone flex h-screen">

      {/* ── Conversation sidebar ─────────────────────────────────────────── */}
      <div className="w-72 border-r border-bone-deeper flex flex-col shrink-0">
        <div className="px-6 py-5 border-b border-bone-deeper">
          <p className="text-xs tracking-widest uppercase text-ink-muted font-medium">Messages</p>
          <div className="flex items-center gap-3 mt-0.5">
            <h2 className="font-serif text-2xl font-bold text-ink">Inbox</h2>
            {totalUnread > 0 && (
              <span className="bg-gold text-ink text-xs font-bold px-2 py-0.5 rounded-full">
                {totalUnread}
              </span>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-bone-deeper">
          {conversations.length === 0 && (
            <div className="px-6 py-12 text-center">
              <p className="text-sm text-ink-muted">No members to message</p>
            </div>
          )}
          {conversations.map(({ contact, latest, unread }) => (
            <button
              key={contact.id}
              onClick={() => setSelectedId(contact.id)}
              className={`w-full text-left px-6 py-4 transition-colors flex items-center gap-3 ${
                selectedId === contact.id
                  ? 'bg-bone-dark'
                  : 'hover:bg-bone-dark'
              }`}
            >
              {/* Avatar with unread badge */}
              <div className="w-9 h-9 rounded-full bg-ink flex items-center justify-center shrink-0 relative">
                <span className="text-[10px] font-bold text-bone">
                  {initials(contact.full_name)}
                </span>
                {unread > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-gold rounded-full text-[9px] font-bold text-ink flex items-center justify-center leading-none">
                    {unread > 9 ? '9+' : unread}
                  </span>
                )}
              </div>

              {/* Name + preview */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-1">
                  <p className={`text-sm truncate ${unread > 0 ? 'font-semibold text-ink' : 'font-medium text-ink'}`}>
                    {contact.full_name ?? 'Unknown'}
                  </p>
                  {latest && (
                    <p className="text-[10px] text-ink-muted shrink-0 leading-none">
                      {fmtTime(latest.created_at)}
                    </p>
                  )}
                </div>
                <p className={`text-xs truncate mt-0.5 ${unread > 0 ? 'text-ink font-medium' : 'text-ink-muted'}`}>
                  {latest
                    ? latest.sender_id === currentUserId
                      ? `You: ${latest.body}`
                      : latest.body
                    : 'No messages yet'}
                </p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* ── Thread panel ────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0">
        {!selectedId ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <p className="font-serif text-3xl font-bold text-bone-deeper mb-2">Select a conversation</p>
              <p className="text-sm text-ink-muted">
                Choose a member from the left to start messaging
              </p>
            </div>
          </div>
        ) : (
          <>
            {/* Thread header */}
            <div className="border-b border-bone-deeper px-8 py-5 flex items-center gap-4 shrink-0">
              <div className="w-9 h-9 rounded-full bg-ink flex items-center justify-center shrink-0">
                <span className="text-[10px] font-bold text-bone">
                  {initials(activeContact?.full_name)}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-ink">
                  {activeContact?.full_name ?? 'Member'}
                </p>
                <p className="text-xs text-ink-muted">{activeContact?.email ?? ''}</p>
              </div>

              {/* ── Invite button ── */}
              {selectedId && (() => {
                const st  = inviteStates[selectedId] ?? (activeContact?.email ? 'idle' : 'no_email')
                const err = inviteErrors[selectedId]
                if (st === 'sent') return (
                  <span className="text-xs font-semibold text-gold tracking-wide shrink-0">
                    Invitation sent ✓
                  </span>
                )
                if (st === 'already_active') return (
                  <span className="text-xs text-ink-muted tracking-wide shrink-0">
                    Already has account
                  </span>
                )
                if (st === 'no_email') return (
                  <span className="text-xs text-ink-muted/50 tracking-wide shrink-0">
                    No email on file
                  </span>
                )
                if (st === 'error') return (
                  <div className="shrink-0 text-right">
                    <button
                      onClick={() => sendInvite(selectedId)}
                      className="text-xs font-semibold text-[#b45454] hover:underline tracking-wide"
                      title={err}
                    >
                      Failed — retry?
                    </button>
                    {err && <p className="text-[10px] text-[#b45454]/70 mt-0.5 max-w-[180px] truncate">{err}</p>}
                  </div>
                )
                return (
                  <button
                    onClick={() => sendInvite(selectedId)}
                    disabled={st === 'sending'}
                    className="shrink-0 text-xs tracking-widest uppercase font-semibold border border-gold text-gold px-4 py-2 hover:bg-gold hover:text-bone transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {st === 'sending' ? 'Inviting…' : 'Invite to app'}
                  </button>
                )
              })()}
            </div>

            {/* Messages */}
            <div ref={threadRef} className="flex-1 overflow-y-auto px-8 py-6 space-y-4">
              {activeThread.length === 0 ? (
                <div className="text-center py-16">
                  <p className="font-serif text-2xl font-bold text-bone-deeper mb-2">No messages yet</p>
                  <p className="text-sm text-ink-muted">
                    Send a message to start the conversation with {activeContact?.full_name?.split(' ')[0] ?? 'this member'}
                  </p>
                </div>
              ) : (
                activeThread.map(msg => (
                  <Bubble key={msg.id} msg={msg} isMe={msg.sender_id === currentUserId} />
                ))
              )}
            </div>

            <ComposeBar
              value={body}
              onChange={setBody}
              onSend={sendMessage}
              disabled={sending}
            />
          </>
        )}
      </div>
    </div>
  )
}
