import { createClient } from '@/lib/supabase/server'

export default async function DashboardPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: profileData } = await supabase
    .from('profiles')
    .select('*, gyms(*)')
    .eq('id', user!.id)
    .single()

  const profile = profileData as {
    full_name: string | null
    gym_id: string | null
    gyms: { name: string } | null
  } | null

  const gymId = profile?.gym_id

  const [
    { count: totalMembers },
    { count: activeToday },
    { count: upcomingClasses },
  ] = await Promise.all([
    supabase.from('members').select('*', { count: 'exact', head: true }).eq('gym_id', gymId ?? ''),
    supabase.from('check_ins').select('*', { count: 'exact', head: true })
      .eq('gym_id', gymId ?? '')
      .gte('checked_in_at', new Date().toISOString().split('T')[0]),
    supabase.from('classes').select('*', { count: 'exact', head: true })
      .eq('gym_id', gymId ?? '')
      .gte('scheduled_at', new Date().toISOString()),
  ])

  const stats = [
    { label: 'Total Members', value: totalMembers ?? 0, icon: '👥', color: 'text-blue-400' },
    { label: 'Check-ins Today', value: activeToday ?? 0, icon: '✅', color: 'text-green-400' },
    { label: 'Upcoming Classes', value: upcomingClasses ?? 0, icon: '🏋️', color: 'text-purple-400' },
    { label: 'Revenue (MTD)', value: '$0', icon: '💰', color: 'text-orange-400' },
  ]

  return (
    <div className="p-8">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-white">
          Welcome back{profile?.full_name ? `, ${profile.full_name.split(' ')[0]}` : ''} 👊
        </h2>
        <p className="text-zinc-400 mt-1 text-sm">Here&apos;s what&apos;s happening at your gym today.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {stats.map(({ label, value, icon, color }) => (
          <div key={label} className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
            <div className="flex items-center justify-between mb-3">
              <span className="text-2xl">{icon}</span>
              <span className={`text-2xl font-black ${color}`}>{value}</span>
            </div>
            <p className="text-zinc-400 text-sm font-medium">{label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
          <h3 className="text-white font-semibold mb-4">Recent Check-ins</h3>
          <div className="text-center py-8 text-zinc-600">
            <p className="text-4xl mb-2">📋</p>
            <p className="text-sm">No check-ins yet today</p>
          </div>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
          <h3 className="text-white font-semibold mb-4">Today&apos;s Classes</h3>
          <div className="text-center py-8 text-zinc-600">
            <p className="text-4xl mb-2">🏋️</p>
            <p className="text-sm">No classes scheduled today</p>
          </div>
        </div>
      </div>
    </div>
  )
}
