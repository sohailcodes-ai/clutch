'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { api, ApiError, type AdminOverviewDto } from '@/lib/api'
import AdminNav from '@/components/clutch/admin/admin-nav'
import { ErrorState, Loading, Panel, SectionTitle } from '@/components/clutch/states'

export default function AdminDashboardPage() {
  const [data, setData] = useState<AdminOverviewDto | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function load() {
    setError(null)
    try {
      setData(await api.get<AdminOverviewDto>('/admin/overview'))
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load overview')
    }
  }

  useEffect(() => {
    void load()
  }, [])

  return (
    <>
      <AdminNav />
      <main className="mx-auto max-w-[1200px] space-y-8 px-4 py-8">
        <SectionTitle>Admin console</SectionTitle>

        {error ? <ErrorState message={error} onRetry={() => void load()} /> : null}
        {!data ? (
          <Loading label="Loading system status" />
        ) : (
          <>
            {/* SYSTEM STATUS */}
            <div>
              <SectionTitle>System status</SectionTitle>
              <Panel>
                <dl className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                  {[
                    ['API', 'ONLINE'],
                    ['DATABASE', data.serverTimeMs > 0 ? 'ONLINE' : 'DOWN'],
                    ['REDIS', '—'],
                    ['WORKER', '—'],
                  ].map(([k, v]) => (
                    <div key={k}>
                      <dt className="label-mono text-[0.6rem] uppercase text-muted-foreground">{k}</dt>
                      <dd className="label-mono text-xs font-black text-emerald-400">{v}</dd>
                    </div>
                  ))}
                  <div>
                    <dt className="label-mono text-[0.6rem] uppercase text-muted-foreground">Checked</dt>
                    <dd className="label-mono text-xs text-muted-foreground">
                      via <span className="text-primary">GET /ready</span>
                    </dd>
                  </div>
                </dl>
              </Panel>
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              {/* LIVE MATCHES */}
              <div>
                <SectionTitle>Live matches ({data.matches.live})</SectionTitle>
                {data.matches.recent.length === 0 ? (
                  <Panel className="label-mono text-xs text-muted-foreground">No live matches.</Panel>
                ) : (
                  <div className="space-y-2">
                    {data.matches.recent.map((m) => (
                      <Link
                        key={m.publicId}
                        href="/admin/matches"
                        className="flex items-center justify-between border border-border bg-card/30 px-3 py-2 transition-colors hover:border-primary/60"
                      >
                        <span className="font-mono text-xs">{m.publicId}</span>
                        <span className="label-mono text-[0.62rem] text-muted-foreground">
                          {m.players.map((p) => `@${p.handle ?? '?'}`).join(' vs ')} · {m.stackId} · {m.status}
                        </span>
                      </Link>
                    ))}
                  </div>
                )}
              </div>

              {/* QUEUE */}
              <div>
                <SectionTitle>Queue</SectionTitle>
                <Panel>
                  {data.queue.length === 0 ? (
                    <p className="label-mono text-xs text-muted-foreground">Queue is empty.</p>
                  ) : (
                    <ul className="space-y-1.5">
                      {data.queue.map((q) => (
                        <li key={q.stackId} className="flex justify-between font-mono text-xs">
                          <span>{q.stackId}</span>
                          <span className="font-bold text-primary">{q.waiting} waiting</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </Panel>
              </div>

              {/* QUESTIONS */}
              <div>
                <SectionTitle>Questions</SectionTitle>
                <Panel className="flex items-center justify-between">
                  <p className="label-mono text-xs text-muted-foreground">
                    Published: <span className="text-foreground">{data.questions.published}</span> · Drafts:{' '}
                    <span className="text-foreground">{data.questions.drafts}</span> · Archived:{' '}
                    <span className="text-foreground">{data.questions.archived}</span>
                  </p>
                  <Link href="/admin/questions" className="label-mono text-xs text-primary underline">
                    Manage questions
                  </Link>
                </Panel>
              </div>

              {/* EVENTS + MODERATION */}
              <div className="space-y-6">
                <div>
                  <SectionTitle>Events</SectionTitle>
                  <Panel className="label-mono flex justify-between text-xs">
                    <span className="text-emerald-400">{data.events.active} active</span>
                    <span className="text-muted-foreground">{data.events.upcoming} upcoming</span>
                    <Link href="/admin/events" className="underline hover:text-primary">
                      Manage
                    </Link>
                  </Panel>
                </div>
                <div>
                  <SectionTitle>Moderation</SectionTitle>
                  <Panel className="flex items-center justify-between">
                    <span className="label-mono text-xs">
                      <span className="font-black text-red-400">{data.moderation.pendingFlags}</span>{' '}
                      <span className="text-muted-foreground">pending flags</span>
                    </span>
                    <Link href="/admin/moderation" className="label-mono text-xs text-primary underline">
                      Review
                    </Link>
                  </Panel>
                </div>
              </div>
            </div>
          </>
        )}
      </main>
    </>
  )
}
