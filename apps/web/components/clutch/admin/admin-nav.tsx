'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useSession } from '@/lib/session'
import { isAdminRoleUi } from '@/lib/api'
import { cn } from '@/lib/utils'
import { ClutchLogo } from '@/components/brand/clutch-logo'

const LINKS = [
  { href: '/admin', label: 'Dashboard' },
  { href: '/admin/matches', label: 'Live Matches' },
  { href: '/admin/questions', label: 'Questions' },
  { href: '/admin/users', label: 'Users' },
  { href: '/admin/moderation', label: 'Moderation' },
  { href: '/admin/events', label: 'Events' },
  { href: '/admin/tournaments', label: 'Tournaments' },
  { href: '/admin/audit', label: 'Audit Log' },
]

/**
 * Admin navigation. Rendered ONLY for administrative roles.
 *
 * SECURITY NOTE: this is presentation convenience — hiding navigation is NOT
 * security. Every /admin API endpoint independently verifies authorization
 * against the database-backed session role.
 */
export function AdminNav() {
  const { user, loading } = useSession()
  const pathname = usePathname()
  const router = useRouter()

  if (loading) return null
  if (!user || !isAdminRoleUi(user.role)) {
    return (
      <div className="mx-auto max-w-[1200px] px-4 py-16 text-center">
        <p className="label-mono text-sm text-red-400">403 — Administrator access required</p>
        <button onClick={() => router.push('/home')} className="label-mono mt-4 text-xs text-primary underline">
          Back to player home
        </button>
      </div>
    )
  }

  return (
    <header className="sticky top-0 z-40 border-b border-primary/30 bg-background/95 backdrop-blur-sm">
      <nav className="mx-auto flex h-14 max-w-[1200px] items-center gap-2 px-4">
        <Link href="/admin" className="mr-3 flex items-center gap-2">
          <span className="grid size-6 place-items-center border border-primary bg-primary/10 text-primary">
            <ClutchLogo size={13} label="Clutch admin console" />
          </span>
          <span className="label-mono hidden text-xs uppercase tracking-widest text-primary sm:inline">Admin</span>
        </Link>
        <div className="flex flex-1 items-center gap-0.5 overflow-x-auto">
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={cn(
                'label-mono whitespace-nowrap px-2.5 py-1.5 text-[0.68rem] transition-colors',
                pathname === l.href ? 'text-primary' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {l.label}
            </Link>
          ))}
        </div>
        <span className="label-mono hidden text-[0.62rem] text-muted-foreground lg:inline">
          @{user.profile?.handle ?? ''} · {user.role}
        </span>
      </nav>
    </header>
  )
}

export default AdminNav
