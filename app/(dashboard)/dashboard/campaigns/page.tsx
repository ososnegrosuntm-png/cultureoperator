import { createClient } from '@/lib/supabase/server'
import { redirect }     from 'next/navigation'
import { CampaignPanel } from '@/components/CampaignPanel'
import type { CampaignMember } from '@/components/CampaignPanel'

export const dynamic = 'force-dynamic'

const GYM_ID = '6d52ca68-4f58-436c-a8f3-66933830e2e9'

export default async function CampaignsPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: raw, error } = await supabase
    .from('profiles')
    .select('id, full_name, phone')
    .eq('gym_id', GYM_ID)
    .eq('role', 'member')
    .order('full_name', { ascending: true })

  if (error) console.error('Campaigns query error:', error.message)

  const members: CampaignMember[] = ((raw ?? []) as unknown as CampaignMember[])

  return <CampaignPanel members={members} />
}
