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

  // Members live in profiles, filtered by gym_id.
  // The members table is separate; profiles is the source of truth for imported members.
  const { data: raw, error } = await supabase
    .from('profiles')
    .select('id, full_name, role, gym_id, created_at, email, phone, instagram, birthday, avatar_url')
    .eq('gym_id', gymId)
    .neq('role', 'owner')
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Members query error:', error.message)
  }

  type RawProfile = {
    id: string; full_name: string | null; role: string; gym_id: string
    created_at: string; email: string | null; phone: string | null
    instagram: string | null; birthday: string | null; avatar_url: string | null
  }
  const members: MemberRow[] = ((raw ?? []) as unknown as RawProfile[]).map(p => ({
    id: p.id,
    status: 'active' as MemberRow['status'],
    joined_at: p.created_at,
    expires_at: null,
    profile: {
      id: p.id,
      full_name: p.full_name,
      email: p.email,
      phone: p.phone,
      instagram: p.instagram,
      birthday: p.birthday,
      avatar_url: p.avatar_url,
    },
  }))

  return (
    <div className="min-h-full bg-bone">
      <MembersTable members={members} />
    </div>
  )
}
