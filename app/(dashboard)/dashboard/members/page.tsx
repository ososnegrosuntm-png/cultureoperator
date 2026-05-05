import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { MembersTable } from '@/components/MembersTable'

export const dynamic = 'force-dynamic'

export type MemberRow = {
  id: string
  status: 'active' | 'inactive' | 'suspended' | 'lead'
  joined_at: string
  expires_at: string | null
  profile: {
    id: string
    full_name: string | null
    email: string | null
    phone: string | null
    instagram: string | null
    birthday: string | null
    avatar_url: string | null
  } | null
}

export default async function MembersPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: gymData } = await supabase
    .from('gyms')
    .select('id')
    .eq('owner_id', user.id)
    .single()

  const gymId = gymData?.id ?? ''

  // Fetch all members joined with their profiles.
  // email / phone / instagram / birthday exist after migration 002_extend_profiles runs.
  const { data: raw, error } = await supabase
    .from('members')
    .select(`
      id,
      status,
      joined_at,
      expires_at,
      profiles (
        id,
        full_name,
        email,
        phone,
        instagram,
        birthday,
        avatar_url
      )
    `)
    .eq('gym_id', gymId)
    .order('joined_at', { ascending: false })

  if (error) {
    console.error('Members query error:', error.message)
  }

  // Normalize the profiles relation (Supabase returns it as array or object)
  type RawRow = {
    id: string; status: string; joined_at: string; expires_at: string | null
    profiles: MemberRow['profile'] | MemberRow['profile'][]
  }
  const members: MemberRow[] = ((raw ?? []) as unknown as RawRow[]).map(m => ({
    id: m.id,
    status: m.status as MemberRow['status'],
    joined_at: m.joined_at,
    expires_at: m.expires_at,
    profile: Array.isArray(m.profiles) ? (m.profiles[0] ?? null) : (m.profiles ?? null),
  }))

  return (
    <div className="min-h-full bg-bone">
      <MembersTable members={members} />
    </div>
  )
}
