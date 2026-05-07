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

  const navItems = [
    { href: '/dashboard',              label: 'Overview',    icon: Overview },
    { href: '/dashboard/members',      label: 'Members',     icon: Members },
    { href: '/dashboard/messages',     label: 'Messages',    icon: MessagesIcon },
    { href: '/dashboard/campaigns',    label: 'Campaigns',   icon: Campaigns },
    { href: '/dashboard/coach',        label: 'AI Coach',    icon: Coach },
    { href: '/dashboard/classes',      label: 'Classes',     icon: Classes },
    { href: '/dashboard/check-ins',    label: 'Check-ins',   icon: Checkins },
    { href: '/dashboard/settings',     label: 'Settings',    icon: Settings },
  ]

  const initials = (profile?.full_name ?? user.email ?? '?')
    .split(' ')
    .map(w => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()

  return (
    <div className="min-h-screen bg-bone flex">
      {/* Sidebar */}
      <aside className="w-60 bg-ink flex flex-col shrink-0">
        {/* Logo */}
        <div className="px-7 pt-8 pb-7 border-b border-bone/8">
          <Link href="/dashboard">
            <span className="font-serif text-xl font-bold tracking-wide text-bone">
              CULTUR<span className="text-gold">E</span>
            </span>
          </Link>
          <p className="text-xs tracking-widest uppercase text-bone/30 mt-1.5 font-medium truncate">
            {profile?.gyms ? (profile.gyms as { name: string }).name : 'Performance Center'}
          </p>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-4 py-6 space-y-0.5">
          {navItems.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-3 px-3 py-2.5 rounded-sm text-bone/50 hover:text-bone hover:bg-bone/6 transition-colors text-sm font-medium tracking-wide group"
            >
              <Icon />
              {label}
            </Link>
          ))}
        </nav>

        {/* User */}
        <div className="px-4 pb-6 border-t border-bone/8 pt-4">
          <div className="flex items-center gap-3 px-3 mb-3">
            <div className="w-8 h-8 rounded-full bg-gold flex items-center justify-center text-ink font-bold text-xs shrink-0">
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-bone truncate leading-tight">
                {profile?.full_name ?? 'Owner'}
              </p>
              <p className="text-xs text-bone/30 truncate">{user.email}</p>
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

// ── Inline SVG icons (avoids icon-library dep) ────────────────────────────────

function Overview() {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" className="opacity-60 group-hover:opacity-100 transition-opacity">
      <rect x="1" y="1" width="5.5" height="5.5" rx="0.5" stroke="currentColor" strokeWidth="1.2"/>
      <rect x="8.5" y="1" width="5.5" height="5.5" rx="0.5" stroke="currentColor" strokeWidth="1.2"/>
      <rect x="1" y="8.5" width="5.5" height="5.5" rx="0.5" stroke="currentColor" strokeWidth="1.2"/>
      <rect x="8.5" y="8.5" width="5.5" height="5.5" rx="0.5" stroke="currentColor" strokeWidth="1.2"/>
    </svg>
  )
}
function Coach() {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" className="opacity-60 group-hover:opacity-100 transition-opacity">
      <circle cx="7.5" cy="7.5" r="5.5" stroke="currentColor" strokeWidth="1.2"/>
      <path d="M5 7.5h5M7.5 5v5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
      <path d="M7.5 2V1M7.5 14v-1M2 7.5H1M14 7.5h-1" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round"/>
    </svg>
  )
}
function Campaigns() {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" className="opacity-60 group-hover:opacity-100 transition-opacity">
      <path d="M1 3.5l6 3 6-3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
      <rect x="1" y="2" width="13" height="9" rx="0.75" stroke="currentColor" strokeWidth="1.2"/>
      <path d="M4 13h7" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
      <path d="M7.5 11v2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
    </svg>
  )
}
function Members() {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" className="opacity-60 group-hover:opacity-100 transition-opacity">
      <circle cx="7.5" cy="4.5" r="2.5" stroke="currentColor" strokeWidth="1.2"/>
      <path d="M2 13c0-2.761 2.462-5 5.5-5s5.5 2.239 5.5 5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
    </svg>
  )
}
function Classes() {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" className="opacity-60 group-hover:opacity-100 transition-opacity">
      <rect x="1.5" y="2.5" width="12" height="10" rx="0.75" stroke="currentColor" strokeWidth="1.2"/>
      <path d="M5 2.5V1M10 2.5V1M1.5 6h12" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
    </svg>
  )
}
function Checkins() {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" className="opacity-60 group-hover:opacity-100 transition-opacity">
      <path d="M2.5 8L5.5 11L12.5 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}
function Settings() {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" className="opacity-60 group-hover:opacity-100 transition-opacity">
      <circle cx="7.5" cy="7.5" r="2" stroke="currentColor" strokeWidth="1.2"/>
      <path d="M7.5 1v1.5M7.5 12.5V14M1 7.5h1.5M12.5 7.5H14M3.05 3.05l1.06 1.06M10.89 10.89l1.06 1.06M3.05 11.95l1.06-1.06M10.89 4.11l1.06-1.06" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
    </svg>
  )
}
function MessagesIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" className="opacity-60 group-hover:opacity-100 transition-opacity">
      <path d="M1 2.5C1 1.948 1.448 1.5 2 1.5h11c.552 0 1 .448 1 1v8c0 .552-.448 1-1 1H5l-4 3V2.5z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/>
    </svg>
  )
}
