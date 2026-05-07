import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { MessagesPanel } from '@/components/MessagesPanel'
import type { Message, ContactProfile } from '@/components/MessagesPanel'

export const dynamic = 'force-dynamic'

const GYM_ID = '6d52ca68-4f58-436c-a8f3-66933830e2e9'

type RawProfile = { id: string; full_name: string | null; email: string | null; role: string }
type RawMessage = {
  id: string; gym_id: string; sender_id: string; recipient_id: string
  body: string; read: boolean; created_at: string
}

export default async function MessagesPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // ── Current user profile ──────────────────────────────────────────────────
  const { data: profileRaw } = await supabase
    .from('profiles')
    .select('id, full_name, email, role')
    .eq('id', user.id)
    .single()

  const profile = profileRaw as RawProfile | null
  const isOwner = profile?.role === 'owner' || profile?.role === 'trainer'

  // ── Gym owner profile (needed as default contact for members) ─────────────
  const { data: ownerRaw } = await supabase
    .from('profiles')
    .select('id, full_name, email')
    .eq('gym_id', GYM_ID)
    .eq('role', 'owner')
    .single()

  const ownerProfile = ownerRaw as { id: string; full_name: string | null; email: string | null } | null
  const ownerId = ownerProfile?.id ?? user.id

  let contacts: ContactProfile[] = []
  let initialMessages: Message[] = []

  if (isOwner) {
    // ── Owner: all member contacts + all gym messages ───────────────────────
    const { data: membersRaw } = await supabase
      .from('profiles')
      .select('id, full_name, email')
      .eq('gym_id', GYM_ID)
      .eq('role', 'member')
      .order('full_name', { ascending: true })

    contacts = ((membersRaw ?? []) as unknown as ContactProfile[])

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: msgsRaw } = await (supabase as any)
      .from('messages')
      .select('id, gym_id, sender_id, recipient_id, body, read, created_at')
      .eq('gym_id', GYM_ID)
      .order('created_at', { ascending: true })

    initialMessages = ((msgsRaw ?? []) as unknown as RawMessage[]).map(m => ({
      id: m.id, gym_id: m.gym_id, sender_id: m.sender_id,
      recipient_id: m.recipient_id, body: m.body, read: m.read, created_at: m.created_at,
    })) as Message[]

  } else {
    // ── Member: only their conversation with the owner ─────────────────────
    if (ownerProfile) {
      contacts = [{ id: ownerProfile.id, full_name: ownerProfile.full_name, email: ownerProfile.email }]
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: msgsRaw } = await (supabase as any)
      .from('messages')
      .select('id, gym_id, sender_id, recipient_id, body, read, created_at')
      .eq('gym_id', GYM_ID)
      .or(`sender_id.eq.${user.id},recipient_id.eq.${user.id}`)
      .order('created_at', { ascending: true })

    initialMessages = ((msgsRaw ?? []) as unknown as RawMessage[]).map(m => ({
      id: m.id, gym_id: m.gym_id, sender_id: m.sender_id,
      recipient_id: m.recipient_id, body: m.body, read: m.read, created_at: m.created_at,
    })) as Message[]
  }

  return (
    <MessagesPanel
      currentUserId={user.id}
      gymId={GYM_ID}
      isOwner={isOwner}
      initialMessages={initialMessages}
      contacts={contacts}
      ownerId={ownerId}
    />
  )
}
