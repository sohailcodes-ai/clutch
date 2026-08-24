'use client'

import { use, useCallback, useEffect, useMemo, useState } from 'react'
import { api, ApiError, type AdminInspectionDto } from '@/lib/api'
import AdminNav from '@/components/clutch/admin/admin-nav'
import { ErrorState, Loading, Panel, SectionTitle } from '@/components/clutch/states'
import { cn } from '@/lib/utils'

function fmt(sec: number | null) {
  if (sec === null) return '—'
  return `${String(Math.floor(sec / 60)).padStart(2, '0')}:${String(sec % 60).padStart(2, '0')}`
}

export default function AdminMatchInspectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [match, setMatch] = useState<AdminInspectionDto | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  // Adjudication form state
  const [winnerUserId, setWinnerUserId] = useState('')
  const [reason, setReason] = useState('')
  const [confirming, setConfirming] = useState(false)

  const load = useCallback(async () => {
    try {
      const res = await api.get<{ match: AdminInspectionDto }>(`/admin/matches/${id}`)
      setMatch(res.match)
      setError(null)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to inspect match')
    }
  }, [id])

  useEffect(() => {
    void load()
    const t = setInterval(() => void load(), 4000)
    return () => clearInterval(t)
  }, [load])

  async function act(fn: () => Promise<unknown>, okMessage: string) {
    setBusy(true)
    setError(null)
    setNotice(null)
    try {
      await fn()
      setNotice(okMessage)
      await load()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Action failed')
    } finally {
      setBusy(false)
    }
  }

  const adjudicable = useMemo(
    () => match !== null && ['matched', 'starting', 'active', 'evaluating', 'abandoned'].includes(match.status),
    [match],
  )

  if (error && !match) return <ErrorState message={error} onRetry={() => void load()} />
  if (!match) return <Loading label="Loading inspection" />

  return (
    <>
      <AdminNav />
      <main className="mx-auto max-w-[1100px] space-y-6 px-4 py-8">
        <SectionTitle>
          Match inspection · <span className="text-primary">{match.publicId}</span>
        </SectionTitle>

        {/* OBSERVER BANNER */}
        <Panel className="border-primary/60 bg-primary/5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="label-mono text-xs font-black uppercase tracking-widest text-primary">
              🛡 Observing — not a participant
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => void act(() => api.post(`/admin/matches/${id}/observe`), 'Observer mode joined — participants notified.')}
                disabled={busy}
                className="label-mono border border-border-strong bg-primary px-4 py-2 text-[0.62rem] font-bold uppercase text-primary-foreground disabled:opacity-50"
              >
                Join as observer
              </button>
              <button
                onClick={() => void act(() => api.delete(`/admin/matches/${id}/observe`), 'Left observer mode — participants notified.')}
                disabled={busy}
                className="label-mono border border-border px-4 py-2 text-[0.62rem] uppercase transition-colors hover:border-red-400 hover:text-red-400"
              >
                Leave observation
              </button>
            </div>
          </div>
          <p className="mt-2 text-[0.68rem] text-muted-foreground">
            Observation is strictly read-only: it never affects slots, matchmaking, timers or ratings.
            Joining broadcasts a server-generated system event to both players.
          </p>
        </Panel>

        {error ? <ErrorState message={error} /> : null}
        {notice ? (
          <p className="label-mono border border-emerald-500/40 bg-emerald-400/5 px-4 py-2 text-xs text-emerald-300">
            {notice}
          </p>
        ) : null}

        {/* MATCH STATE */}
        <div className="grid gap-4 lg:grid-cols-3">
          <Panel>
            <SectionTitle>Match</SectionTitle>
            <dl className="space-y-1.5 font-mono text-xs">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Status</dt>
                <dd>{match.status}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Resolution</dt>
                <dd className={match.resolutionLabel === 'admin_adjudication' ? 'text-primary' : ''}>
                  {match.resolutionLabel === 'admin_adjudication' ? 'ADMIN ADJUDICATION' : match.resolutionLabel.toUpperCase()}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Stack / difficulty</dt>
                <dd>{match.stackName} · {match.difficultyId}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Question</dt>
                <dd className="truncate pl-4">{match.questionTitle}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Timer (server)</dt>
                <dd className="font-bold tabular-nums text-primary">{fmt(match.remainingSec)}</dd>
              </div>
            </dl>
          </Panel>

          {match.participants.map((p) => (
            <Panel key={p.userId}>
              <SectionTitle>Player {p.slot}</SectionTitle>
              <p className="font-mono text-sm font-bold">@{p.handle ?? '?'}</p>
              <p className="label-mono mt-1 text-[0.6rem] uppercase text-muted-foreground">
                rating {p.ratingBefore}
                {p.ratingAfter !== null ? ` → ${p.ratingAfter}` : ''}
                {p.tierId ? ` · ${p.tierId}` : ''}
                {p.result ? ` · ${p.result}` : ''}
                {match.winnerUserId === p.userId ? ' · WINNER' : ''}
              </p>
              <ul className="mt-3 space-y-1 font-mono text-xs">
                {p.submissions.length === 0 ? (
                  <li className="text-muted-foreground">No submissions.</li>
                ) : (
                  p.submissions.map((s) => (
                    <li key={s.id} className="flex justify-between gap-2">
                      <span className={cn(s.status === 'accepted' && 'text-emerald-400')}>
                        {s.isFinal ? 'final' : 'test'} · {s.status.replace(/_/g, ' ')}
                      </span>
                      <span className="text-muted-foreground">
                        {s.passedCount}/{s.totalCount} tests
                      </span>
                    </li>
                  ))
                )}
              </ul>
            </Panel>
          ))}
        </div>

        {/* EVENT LOG */}
        <Panel>
          <SectionTitle>Event log</SectionTitle>
          <ul className="max-h-64 space-y-1 overflow-y-auto font-mono text-xs">
            {[...match.events].reverse().map((e) => (
              <li key={e.id} className="flex gap-3">
                <span className="w-20 shrink-0 text-muted-foreground">
                  {new Date(e.createdAt).toLocaleTimeString()}
                </span>
                <span className="w-36 shrink-0 text-primary">{e.type}</span>
                <span className="truncate text-muted-foreground">
                  {e.type === 'admin.joined' || e.type === 'admin.left'
                    ? `ADMIN @${String(e.payload.handle ?? '?')} has ${e.type === 'admin.joined' ? 'joined' : 'left'} the match.`
                    : e.type === 'match.adjudicated'
                      ? `Adjudicated: ${String(e.payload.reason ?? '')}`
                      : JSON.stringify(e.payload)}
                </span>
              </li>
            ))}
          </ul>
        </Panel>

        {/* ADJUDICATION */}
        <Panel className={cn(adjudicable ? 'border-red-400/40' : 'opacity-60')}>
          <SectionTitle>Declare winner (administrative override)</SectionTitle>
          {!adjudicable ? (
            <p className="text-xs text-muted-foreground">
              This match is in a terminal state and can no longer be adjudicated.
            </p>
          ) : (
            <div className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                {match.participants.map((p) => (
                  <button
                    key={p.userId}
                    onClick={() => setWinnerUserId(p.userId)}
                    className={cn(
                      'border px-4 py-3 text-left font-mono text-sm transition-colors',
                      winnerUserId === p.userId
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border hover:border-border-strong',
                    )}
                  >
                    Winner: @{p.handle ?? '?'}
                  </button>
                ))}
              </div>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
                placeholder="Reason (required) — e.g. evaluation infrastructure failure confirmed by manual review…"
                className="w-full border border-border bg-background px-3 py-2 font-mono text-xs outline-none focus:border-primary"
              />
              {!confirming ? (
                <button
                  onClick={() => setConfirming(true)}
                  disabled={!winnerUserId || reason.trim().length < 10}
                  className="label-mono border border-red-400/60 px-5 py-2 text-[0.65rem] font-bold uppercase text-red-300 transition-colors hover:bg-red-400/10 disabled:opacity-40"
                >
                  Prepare adjudication
                </button>
              ) : (
                <div className="flex flex-wrap items-center gap-3 border border-red-400/60 bg-red-400/5 px-4 py-3">
                  <p className="text-xs text-red-200">
                    Confirm: winner{' '}
                    <span className="font-bold">
                      @{match.participants.find((p) => p.userId === winnerUserId)?.handle ?? '?'}
                    </span>
                    . This applies standard ELO rules transactionally and is permanently audited.
                  </p>
                  <button
                    onClick={() =>
                      void act(
                        () => api.post(`/admin/matches/${id}/adjudicate`, { winnerUserId, reason }),
                        'Match adjudicated. Ratings updated through the standard pipeline.',
                      )
                    }
                    disabled={busy}
                    className="label-mono ml-auto border border-red-400 bg-red-400/20 px-5 py-2 text-[0.65rem] font-bold uppercase text-red-100 disabled:opacity-50"
                  >
                    Confirm adjudication
                  </button>
                  <button
                    onClick={() => setConfirming(false)}
                    className="label-mono border border-border px-4 py-2 text-[0.62rem] uppercase text-muted-foreground"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>
          )}
        </Panel>
      </main>
    </>
  )
}
