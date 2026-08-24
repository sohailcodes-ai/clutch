'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { api, ApiError, type AdminMatchListItemDto } from '@/lib/api'
import AdminNav from '@/components/clutch/admin/admin-nav'
import { ErrorState, Loading, Panel, SectionTitle } from '@/components/clutch/states'

export default function AdminMatchesPage() {
  const [matches, setMatches] = useState<AdminMatchListItemDto[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const res = await api.get<{ matches: AdminMatchListItemDto[] }>('/admin/matches')
      setMatches(res.matches)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load live matches')
    }
  }, [])

  useEffect(() => {
    void load()
    const t = setInterval(() => void load(), 5000)
    return () => clearInterval(t)
  }, [load])

  return (
    <>
      <AdminNav />
      <main className="mx-auto max-w-[1200px] space-y-6 px-4 py-8">
        <SectionTitle>Live matches</SectionTitle>
        {error ? <ErrorState message={error} onRetry={() => void load()} /> : null}
        {!matches ? (
          <Loading />
        ) : matches.length === 0 ? (
          <Panel className="label-mono text-xs text-muted-foreground">No ongoing matches.</Panel>
        ) : (
          <div className="space-y-2">
            {matches.map((m) => {
              const mins = m.remainingSec !== null ? Math.floor(m.remainingSec / 60) : null
              const secs = m.remainingSec !== null ? m.remainingSec % 60 : null
              return (
                <Link
                  key={m.publicId}
                  href={`/admin/matches/${m.id}`}
                  className="flex flex-wrap items-center justify-between gap-3 border border-border bg-card/30 px-4 py-3 transition-colors hover:border-primary/60"
                >
                  <div>
                    <p className="font-mono text-sm">{m.publicId}</p>
                    <p className="label-mono text-[0.62rem] uppercase text-muted-foreground">
                      {m.stackName} · {m.difficultyId} · {m.questionTitle}
                      {m.ranked ? '' : ' · unranked'}
                    </p>
                  </div>
                  <div className="flex items-center gap-6">
                    <div className="text-right font-mono text-xs">
                      {m.participants.map((p) => (
                        <p key={p.handle ?? 'x'}>
                          @{p.handle ?? '?'} — {p.submissionState} ({p.passedCount}/{p.attempts})
                        </p>
                      ))}
                    </div>
                    <div className="w-16 text-right">
                      <span className="font-mono text-sm font-bold tabular-nums text-primary">
                        {mins !== null && secs !== null
                          ? `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
                          : '—'}
                      </span>
                      <p className="label-mono text-[0.58rem] uppercase text-muted-foreground">{m.status}</p>
                    </div>
                    <span className="label-mono border border-border px-3 py-1.5 text-[0.62rem] uppercase hover:border-primary hover:text-primary">
                      Inspect
                    </span>
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </main>
    </>
  )
}
