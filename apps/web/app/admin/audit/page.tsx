'use client'

import { useCallback, useEffect, useState } from 'react'
import { api, ApiError, type AdminAuditEntryDto } from '@/lib/api'
import AdminNav from '@/components/clutch/admin/admin-nav'
import { ErrorState, Loading, Panel, SectionTitle } from '@/components/clutch/states'

export default function AdminAuditPage() {
  const [entries, setEntries] = useState<AdminAuditEntryDto[] | null>(null)
  const [action, setAction] = useState('')
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async (a: string) => {
    try {
      const res = await api.get<{ entries: AdminAuditEntryDto[] }>(
        `/admin/audit${a ? `?action=${encodeURIComponent(a)}` : ''}`,
      )
      setEntries(res.entries)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load audit log')
    }
  }, [])

  useEffect(() => {
    void load('')
  }, [load])

  return (
    <>
      <AdminNav />
      <main className="mx-auto max-w-[1100px] space-y-6 px-4 py-8">
        <SectionTitle>Audit log</SectionTitle>
        <p className="-mt-3 text-xs text-muted-foreground">
          Append-only record of privileged actions. There is no API to delete or rewrite audit history.
        </p>

        <form
          onSubmit={(e) => {
            e.preventDefault()
            void load(action)
          }}
          className="flex gap-3"
        >
          <input
            value={action}
            onChange={(e) => setAction(e.target.value)}
            placeholder="Filter by action (e.g. admin.match.adjudicate)"
            className="flex-1 border border-border bg-background px-3 py-2 font-mono text-sm outline-none focus:border-primary"
          />
          <button className="label-mono border border-border-strong px-4 py-2 text-[0.65rem] uppercase hover:border-primary hover:text-primary">
            Filter
          </button>
        </form>

        {error ? <ErrorState message={error} /> : null}

        {!entries ? (
          <Loading />
        ) : (
          <Panel className="overflow-x-auto p-0">
            <table className="w-full min-w-[820px] text-left font-mono text-xs">
              <thead>
                <tr className="border-b border-border text-muted-foreground">
                  <th className="px-4 py-2">Time</th>
                  <th className="px-4 py-2">Admin</th>
                  <th className="px-4 py-2">Action</th>
                  <th className="px-4 py-2">Resource</th>
                  <th className="px-4 py-2">Metadata</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((e) => (
                  <tr key={e.id} className="border-b border-border/40 align-top">
                    <td className="whitespace-nowrap px-4 py-2 text-muted-foreground">
                      {new Date(e.createdAt).toLocaleString()}
                    </td>
                    <td className="px-4 py-2">@{e.actorHandle ?? 'system'}</td>
                    <td className="px-4 py-2 text-primary">{e.action}</td>
                    <td className="px-4 py-2 text-muted-foreground">
                      {e.resourceType}:{e.resourceId}
                    </td>
                    <td className="max-w-[280px] truncate px-4 py-2 text-muted-foreground">
                      {JSON.stringify(e.metadata)}
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
