import { createClient }   from '@/lib/supabase/server'
import { redirect }        from 'next/navigation'
import { PowerListPanel }  from '@/components/PowerListPanel'

export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profileRaw } = await supabase
    .from('profiles')
    .select('full_name, gym_id')
    .eq('id', user.id)
    .single()

  const profile = profileRaw as { full_name: string | null; gym_id: string | null } | null

  return (
    <PowerListPanel
      userId={user.id}
      gymId={profile?.gym_id ?? null}
    />
  )
}
