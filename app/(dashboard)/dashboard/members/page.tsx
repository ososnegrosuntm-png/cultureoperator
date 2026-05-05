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

  const GYM_ID = '6d52ca68-4f58-436c-a8f3-66933830e2e9'

  const { data: raw, error } = await supabase
    .from('profiles')
    .select('id, full_name, role, gym_id')
    .eq('gym_id', GYM_ID)

  if (error) {
    console.error('Members query error:', error.message)
  }

  type RawProfile = { id: string; full_name: string | null; role: string; gym_id: string }
  const members: MemberRow[] = ((raw ?? []) as unknown as RawProfile[]).map(p => ({
    id: p.id,
    status: (p.role === 'owner' ? 'active' : 'active') as MemberRow['status'],
    joined_at: new Date().toISOString(),
    expires_at: null,
    profile: {
      id: p.id,
      full_name: p.full_name,
      email: null,
      phone: null,
      instagram: null,
      birthday: null,
      avatar_url: null,
    },
  }))

  return (
    <div className="min-h-full bg-bone">
      <MembersTable members={members} />
    </div>
  )
}
