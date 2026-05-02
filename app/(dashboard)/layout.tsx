import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { SignOutButton } from '@/components/SignOutButton'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profileData } = await supabase
    .from('profiles')
    .select('*, gyms(*)')
    .eq('id', user.id)
    .single()

  const profile = profileData as {
    full_name: string | null
    gym_id: string | null
    gyms: { name: string } | null
  } | null

  return (
    <div className="min-h-screen bg-zinc-950 flex">
      <aside className="w-64 bg-zinc-900 border-r border-zinc-800 flex flex-col">
        <div className="p-6 border-b border-zinc-800">
          <h1 className="text-2xl font-black tracking-tight text-white">
            CULTUR<span className="text-orange-500">E</span>
          </h1>
          <p className="text-xs text-zinc-500 mt-1 truncate">
            {profile?.gyms ? (profile.gyms as { name: string }).name : 'Gym Management'}
          </p>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {[
            { href: '/dashboard', label: 'Overview', icon: '⊞' },
            { href: '/dashboard/members', label: 'Members', icon: '👥' },
            { href: '/dashboard/memberships', label: 'Memberships', icon: '🎫' },
            { href: '/dashboard/classes', label: 'Classes', icon: '🏋️' },
            { href: '/dashboard/check-ins', label: 'Check-ins', icon: '✅' },
            { href: '/dashboard/settings', label: 'Settings', icon: '⚙️' },
          ].map(({ href, label, icon }) => (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors text-sm font-medium"
            >
              <span>{icon}</span>
              {label}
            </Link>
          ))}
        </nav>

        <div className="p-4 border-t border-zinc-800">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 rounded-full bg-orange-500 flex items-center justify-center text-white font-bold text-sm">
              {profile?.full_name?.[0]?.toUpperCase() ?? user.email?.[0]?.toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">{profile?.full_name ?? 'User'}</p>
              <p className="text-xs text-zinc-500 truncate">{user.email}</p>
            </div>
          </div>
          <SignOutButton />
        </div>
      </aside>

      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  )
}
