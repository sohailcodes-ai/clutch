'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useSession } from '@/lib/session'
import { cn } from '@/lib/utils'
import { ClutchLogo } from '@/components/brand/clutch-logo'

const LINKS = [
  { href: '/home', label: 'Home' },
  { href: '/explore', label: 'Explore' },
  { href: '/friends', label: 'Friends' },
  { href: '/leaderboard', label: 'Ladder' },
  { href: '/rooms', label: 'Rooms' },
  { href: '/titles', label: 'Titles' },
]

export function AppNav() {
  const { user, loading, logout } = useSession()
  const pathname = usePathname()
  const router = useRouter()

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur-sm">
      <nav className="mx-auto flex h-14 max-w-[1200px] items-center gap-2 px-4">
        <Link href="/" className="mr-3 flex items-center gap-2">
          <span className="grid size-6 place-items-center border border-primary/60 text-primary transition-colors hover:bg-primary/10">
            <ClutchLogo size={14} label="Clutch home" />
          </span>
          <span className="label-mono hidden text-xs sm:inline">Clutch</span>
        </Link>

        <div className="flex flex-1 items-center gap-0.5 overflow-x-auto">
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={cn(
                'label-mono whitespace-nowrap px-2.5 py-1.5 text-[0.68rem] transition-colors',
                pathname.startsWith(l.href)
                  ? 'text-primary'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {l.label}
            </Link>
          ))}
        </div>

        <div className="flex items-center gap-3">
          {loading ? null : user ? (
            <>
              <Link
                href={`/profile/${user.profile?.handle ?? ''}`}
                className="label-mono text-[0.68rem] text-muted-foreground hover:text-primary"
              >
                @{user.profile?.handle ?? user.id.slice(0, 8)}
              </Link>
              <button
                onClick={() => void logout().then(() => router.push('/'))}
                className="label-mono border border-border px-2.5 py-1.5 text-[0.65rem] text-muted-foreground transition-colors hover:border-primary hover:text-primary"
              >
                Log out
              </button>
            </>
          ) : (
            <Link
              href="/login"
              className="label-mono border border-border-strong px-3 py-1.5 text-[0.65rem] transition-colors hover:border-primary hover:bg-primary hover:text-primary-foreground"
            >
              Sign in
            </Link>
          )}
        </div>
      </nav>
    </header>
  )
}

export default AppNav
