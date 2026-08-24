'use client'

import { useCallback, useEffect, useState } from 'react'
import { api, ApiError, type AdminFlagDto } from '@/lib/api'
import AdminNav from '@/components/clutch/admin/admin-nav'
import { ErrorState, Loading, Panel, SectionTitle } from '@/components/clutch/states'

export default function AdminModerationPage() {
  const [flags, setFlags] = useState<AdminFlagDto[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const res = await api.get<{ flags: AdminFlagDto[] }>('/admin/moderation/flags')
      setFlags(res.flags)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load flags')
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function review(flagId: string, decision: 'reviewed' | 'actioned' | 'dismissed') {
    setError(null)
    try {
      await api.post(`/admin/moderation/flags/${flagId}/review`, { decision })
      await load()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Review action failed')
    }
  }

  return (
    <>
      <AdminNav />
      <main className="mx-auto max-w-[1000px] space-y-6 px-4 py-8">
        <SectionTitle>Moderation queue</SectionTitle>
        {error ? <ErrorState message={error} /> : null}
        {!flags ? (
          <Loading />
        ) : flags.length === 0 ? (
          <Panel className="label-mono text-xs text-muted-foreground">No open flags. Clean arena.</Panel>
        ) : (
          <div className="space-y-2">
            {flags.map((f) => (
              <div
                key={f.id}
                className="flex flex-wrap items-center justify-between gap-3 border border-border bg-card/30 px-4 py-3"
              >
                <div>
                  <p className="font-mono text-xs">
                    @{f.userHandle ?? '?'} — <span className="text-primary">{f.flagType}</span>
                  </p>
                  <p className="label-mono mt-0.5 text-[0.6rem] uppercase text-muted-foreground">
                    severity {f.severity} · {new Date(f.createdAt).toLocaleString()}
                  </p>
                </div>
                <div className="flex gap-2">
                  {(['reviewed', 'actioned', 'dismissed'] as const).map((d) => (
                    <button
                      key={d}
                      onClick={() => void review(f.id, d)}
                      className={`label-mono border px-3 py-1.5 text-[0.6rem] uppercase transition-colors ${
                        d === 'dismissed'
                          ? 'border-border hover:border-border-strong'
                          : 'border-red-400/50 hover:bg-red-400/10'
                      }`}
                    >
                      {d}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </>
  )
}
