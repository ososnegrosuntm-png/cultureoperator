import { createClient } from '@/lib/supabase/server'
import { redirect }     from 'next/navigation'
import { CampaignPanel } from '@/components/CampaignPanel'

export const dynamic = 'force-dynamic'

export type CampaignMember = {
  id:           string
  joined_at:    string
  last_seen:    string | null   // max(checked_in_at) or null
  profile: {
    full_name:  string | null
    phone:      string | null
    avatar_url: string | null
  } | null
}

export default async function CampaignsPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: gymData } = await supabase
    .from('gyms')
    .select('id')
    .eq('owner_id', user.id)
    .single()

  const gymId = gymData?.id ?? ''

  // Fetch inactive members with their profiles and check-in history.
  // check_ins gives us last_seen; if empty the member was never checked in.
  const { data: raw, error } = await supabase
    .from('members')
    .select(`
      id,
      joined_at,
      profiles ( full_name, phone, avatar_url ),
      check_ins ( checked_in_at )
    `)
    .eq('gym_id', gymId)
    .eq('status', 'inactive')
    .order('joined_at', { ascending: false })

  if (error) console.error('Campaigns query error:', error.message)

  type RawCampaignRow = {
    id: string; joined_at: string
    profiles: CampaignMember['profile'] | CampaignMember['profile'][]
    check_ins: { checked_in_at: string }[] | { checked_in_at: string }
  }
  const members: CampaignMember[] = ((raw ?? []) as unknown as RawCampaignRow[]).map(m => {
    const profile = Array.isArray(m.profiles) ? m.profiles[0] ?? null : m.profiles ?? null
    const checkins: { checked_in_at: string }[] = Array.isArray(m.check_ins) ? m.check_ins : []
    const last_seen = checkins.length > 0
      ? checkins.reduce((a, b) => a.checked_in_at > b.checked_in_at ? a : b).checked_in_at
      : null

    return { id: m.id, joined_at: m.joined_at, last_seen, profile }
  })

  return (
    <div className="min-h-full bg-bone">
      <CampaignPanel members={members} />
    </div>
  )
}
