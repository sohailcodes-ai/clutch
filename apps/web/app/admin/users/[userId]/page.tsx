'use client'

import { use, useCallback, useEffect, useState } from 'react'
import { api, ApiError, type AdminUserDetailDto } from '@/lib/api'
import AdminNav from '@/components/clutch/admin/admin-nav'
import { ErrorState, Loading, Panel, SectionTitle } from '@/components/clutch/states'

export default function AdminUserDetailPage({ params }: { params: Promise<{ userId: string }> }) {
  const { userId } = use(params)
  const [user, setUser] = useState<AdminUserDetailDto | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    try {
      const res = await api.get<{ user: AdminUserDetailDto }>(`/admin/users/${userId}`)
      setUser(res.user)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load user')
    }
  }, [userId])

  useEffect(() => {
    void load()
  }, [load])

  async function setStatus(status: 'active' | 'suspended' | 'banned') {
    setBusy(true)
    setError(null)
    try {
      await api.patch(`/admin/users/${userId}/status`, { status })
      await load()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Moderation action failed')
    } finally {
      setBusy(false)
    }
  }

  if (error && !user) return <ErrorState message={error} />
  if (!user) return <Loading />

  return (
    <>
      <AdminNav />
      <main className="mx-auto max-w-[900px] space-y-6 px-4 py-8">
        <SectionTitle>User · @{user.handle}</SectionTitle>

        {error ? <ErrorState message={error} /> : null}

        <Panel>
          <dl className="grid grid-cols-2 gap-x-8 gap-y-2 font-mono text-xs sm:grid-cols-3">
            <div>
              <dt className="text-muted-foreground">Handle</dt>
              <dd>@{user.handle}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Role</dt>
              <dd>{user.role}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Status</dt>
              <dd className={user.status === 'active' ? 'text-emerald-400' : 'text-red-400'}>{user.status}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Member since</dt>
              <dd>{new Date(user.memberSince).toLocaleDateString()}</dd>
            </div>
            {user.email ? (
              <div>
                <dt className="text-primary">Email (security view)</dt>
                <dd>{user.email}</dd>
              </div>
            ) : null}
            {user.equippedTitle ? (
              <div>
                <dt className="text-muted-foreground">Equipped title</dt>
                <dd>{user.equippedTitle.name}</dd>
              </div>
            ) : null}
          </dl>

          <div className="mt-5">
            <p className="label-mono mb-2 text-[0.6rem] uppercase text-muted-foreground">Stack ratings</p>
            <ul className="space-y-1 font-mono text-xs">
              {user.ratings.map((r) => (
                <li key={r.stackId} className="flex justify-between">
                  <span>{r.stackId}</span>
                  <span>
                    {r.rating} ({r.tierId ?? '—'}) · {r.wins}W/{r.losses}L/{r.draws}D
                  </span>
                </li>
              ))}
            </ul>
          </div>

          {user.security ? (
            <div className="mt-5 border-t border-border pt-4">
              <p className="label-mono mb-2 text-[0.6rem] uppercase text-primary">
                Security metadata (restricted clearance)
              </p>
              <ul className="space-y-1 font-mono text-[0.68rem] text-muted-foreground">
                {user.security.recentSessions.map((s, i) => (
                  <li key={i}>
                    {s.ipAddress ?? 'unknown ip'} · {new Date(s.createdAt).toLocaleString()}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </Panel>

        {/* MODERATION — administrators cannot be moderated (server-enforced). */}
        {user.role === 'user' ? (
          <Panel>
            <SectionTitle>Moderation</SectionTitle>
            <div className="flex flex-wrap gap-3">
              {(['active', 'suspended', 'banned'] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => void setStatus(s)}
                  disabled={busy || user.status === s}
                  className={`label-mono border px-4 py-2 text-[0.62rem] uppercase transition-colors disabled:opacity-40 ${
                    s === 'active'
                      ? 'border-emerald-500/50 hover:bg-emerald-400/10'
                      : 'border-red-400/60 hover:bg-red-400/10'
                  }`}
                >
                  Set {s}
                </button>
              ))}
            </div>
            <p className="mt-2 text-[0.66rem] text-muted-foreground">
              Suspending or banning also invalidates all active sessions (server-side).
            </p>
          </Panel>
        ) : null}
      </main>
    </>
  )
}
