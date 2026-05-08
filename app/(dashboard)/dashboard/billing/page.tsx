import { createClient } from '@/lib/supabase/server'
import { redirect }     from 'next/navigation'
import { BillingPanel } from '@/components/BillingPanel'

export const dynamic = 'force-dynamic'

export default async function BillingPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profileRaw } = await supabase
    .from('profiles')
    .select('full_name, role, gym_id')
    .eq('id', user.id)
    .single()

  const profile = profileRaw as {
    full_name: string | null
    role: string | null
    gym_id: string | null
  } | null

  const isOwner = profile?.role === 'owner'

  return (
    <BillingPanel
      isOwner={isOwner}
      userEmail={user.email ?? ''}
    />
  )
}
