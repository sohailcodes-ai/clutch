'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { api, ApiError, type AdminUserListItemDto } from '@/lib/api'
import AdminNav from '@/components/clutch/admin/admin-nav'
import { ErrorState, Loading, Panel, SectionTitle } from '@/components/clutch/states'

export default function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUserListItemDto[] | null>(null)
  const [query, setQuery] = useState('')
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async (q: string) => {
    try {
      const res = await api.get<{ users: AdminUserListItemDto[] }>(
        `/admin/users${q ? `?query=${encodeURIComponent(q)}` : ''}`,
      )
      setUsers(res.users)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load users')
    }
  }, [])

  useEffect(() => {
    void load('')
  }, [load])

  return (
    <>
      <AdminNav />
      <main className="mx-auto max-w-[1100px] space-y-6 px-4 py-8">
        <SectionTitle>Users</SectionTitle>

        <form
          onSubmit={(e) => {
            e.preventDefault()
            void load(query)
          }}
          className="flex gap-3"
        >
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by handle…"
            className="flex-1 border border-border bg-background px-3 py-2 font-mono text-sm outline-none focus:border-primary"
          />
          <button className="label-mono border border-border-strong px-4 py-2 text-[0.65rem] uppercase hover:border-primary hover:text-primary">
            Search
          </button>
        </form>

        {error ? <ErrorState message={error} /> : null}

        {!users ? (
          <Loading />
        ) : (
          <Panel className="overflow-x-auto p-0">
            <table className="w-full min-w-[720px] text-left font-mono text-xs">
              <thead>
                <tr className="border-b border-border text-muted-foreground">
                  <th className="px-4 py-2">Handle</th>
                  <th className="px-4 py-2">Role</th>
                  <th className="px-4 py-2">Status</th>
                  <th className="px-4 py-2">Rating</th>
                  <th className="px-4 py-2">Tier</th>
                  <th className="px-4 py-2">W/L/D</th>
                  <th className="px-4 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.userId} className="border-b border-border/40">
                    <td className="px-4 py-2">@{u.handle}</td>
                    <td className="px-4 py-2 text-muted-foreground">{u.role}</td>
                    <td className={u.status === 'active' ? 'text-emerald-400' : 'text-red-400'}>{u.status}</td>
                    <td>{u.bestRating ?? '—'}</td>
                    <td className="text-muted-foreground">{u.tierId ?? '—'}</td>
                    <td className="text-muted-foreground">
                      {u.wins}/{u.losses}/{u.draws}
                    </td>
                    <td className="px-4 py-2 text-right">
                      <Link href={`/admin/users/${u.userId}`} className="text-primary underline">
                        Inspect
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Panel>
        )}
      </main>
    </>
  )
}
