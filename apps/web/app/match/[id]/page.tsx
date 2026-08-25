'use client'

import { use, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { api, ApiError, type RunResultDto } from '@/lib/api'
import { useSession } from '@/lib/session'
import { useWs } from '@/lib/ws'
import AppNav from '@/components/clutch/app-nav'
import SubmissionStateChip, { type SubmissionState } from '@/components/clutch/submission-state'
import ClutchLogo from '@/components/brand/clutch-logo'
import { ErrorState, Loading, Panel, SectionTitle } from '@/components/clutch/states'
import { cn } from '@/lib/utils'

type Participant = {
  userId: string
  handle: string | null
  avatarUrl: string | null
  slot: number
  ratingBefore: number
  ratingAfter: number | null
  result: string | null
}

type MatchSnapshot = {
  id: string
  publicId: string
  status: string
  stackId: string
  difficultyId: string
  timeLimitSec: number
  startedAt: string | null
  endsAt: string | null
  winnerUserId: string | null
  opponent?: { handle: string | null; avatarUrl: string | null; ratingBefore: number } | null
  questionVersion: {
    id: string
    version: number
    promptMd: string
    examples: unknown[]
    starterCode: Record<string, string>
    testCases: { ordinal: number; input: string; expectedOutput: string; visibility: string }[]
  }
  submissions: {
    id: string
    status: SubmissionState
    passedCount: number
    totalCount: number
    isFinal: boolean
    createdAt: string
  }[]
  participants: Participant[]
  /** Server-authoritative placement context for the viewer. */
  viewerCompetitive?: {
    competitiveStatus: 'unranked' | 'ranked'
    placementMatchesRequired: number
    placementMatchesCompleted: number
    placementRemaining: number
  } | null
}

function Timer({ endsAt, now }: { endsAt: string | null; now: number }) {
  const remaining = useMemo(() => {
    if (!endsAt) return null
    return Math.max(0, Math.floor((new Date(endsAt).getTime() - now) / 1000))
  }, [endsAt, now])
  const urgent = remaining !== null && remaining <= 120

  if (remaining === null) return null
  return (
    <div className="text-right" role="timer" aria-label={`Time remaining ${remaining} seconds`}>
      <p
        className={cn(
          'data-mono text-3xl font-black tabular-nums leading-none sm:text-4xl',
          urgent ? 'animate-pulse text-defeat' : 'text-primary',
        )}
      >
        {String(Math.floor(remaining / 60)).padStart(2, '0')}:
        {String(remaining % 60).padStart(2, '0')}
      </p>
      <p className="label-mono mt-1 text-[0.55rem] uppercase text-muted-foreground">
        server clock
      </p>
    </div>
  )
}

function PlayerIdentity({
  handle,
  avatarUrl,
  rating,
  align = 'left',
}: {
  handle: string | null
  avatarUrl: string | null
  rating?: number | null
  align?: 'left' | 'right'
}) {
  return (
    <div className={cn('flex min-w-0 items-center gap-3', align === 'right' && 'flex-row-reverse')}>
      {avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={avatarUrl} alt="" className="size-9 border border-border object-cover" />
      ) : (
        <span className="grid size-9 shrink-0 place-items-center border border-border text-[0.62rem] font-black text-muted-foreground">
          {(handle ?? '?').slice(0, 2).toUpperCase()}
        </span>
      )}
      <div className={cn('min-w-0', align === 'right' && 'text-right')}>
        <p className="truncate font-mono text-sm font-bold">@{handle ?? '?'}</p>
        {rating !== undefined && rating !== null ? (
          <p className="label-mono text-[0.55rem] uppercase text-muted-foreground">{rating} rating</p>
        ) : null}
      </div>
    </div>
  )
}

export default function MatchPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const [match, setMatch] = useState<MatchSnapshot | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [code, setCode] = useState('')
  const [now, setNow] = useState(() => Date.now())
  const [busy, setBusy] = useState(false)
  const [submitMsg, setSubmitMsg] = useState<string | null>(null)
  const [runResult, setRunResult] = useState<RunResultDto | null>(null)
  const [runBusy, setRunBusy] = useState(false)

  const load = useCallback(async () => {
    try {
      const res = await api.get<{ match: MatchSnapshot }>(`/matches/${id}`)
      setMatch(res.match)
      setCode((prev) => {
        if (prev) return prev
        const starters = res.match.questionVersion.starterCode
        return starters[res.match.stackId] ?? Object.values(starters)[0] ?? ''
      })
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Match not found')
    }
  }, [id])

  // Keep a ref so the WS handler always calls the latest load.
  const loadRef = useRef(load)
  loadRef.current = load

  // Timer tick for countdown (1s, independent of WS).
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])

  // Subscribe to match WebSocket events and refresh on any match event.
  const MATCH_EVENTS = useMemo(
    () =>
      new Set([
        'match.found',
        'match.starting',
        'match.active',
        'match.participant_update',
        'submission.queued',
        'match.evaluating',
        'submission.result',
        'match.resolved',
        'match.adjudicated',
        'match.snapshot',
        'admin.joined',
        'admin.left',
      ]),
    [],
  )

  const { connected, subscribe } = useWs({
    onMessage: useCallback(
      (msg: { type?: string; matchId?: string }) => {
        if (msg.type && MATCH_EVENTS.has(msg.type) && msg.matchId === id) {
          void loadRef.current()
        }
      },
      [id, MATCH_EVENTS],
    ),
  })

  // Subscribe to match channel once connected.
  useEffect(() => {
    if (connected) {
      subscribe('match.subscribe', { matchId: id })
    }
  }, [connected, subscribe, id])

  // Initial load.
  useEffect(() => { void load() }, [load])

  async function ready() {
    setBusy(true)
    try {
      await api.post(`/matches/${id}/ready`)
      await load()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not ready up')
    } finally {
      setBusy(false)
    }
  }

  async function testRun() {
    setRunBusy(true)
    setRunResult(null)
    setSubmitMsg(null)
    try {
      const res = await api.post<RunResultDto>(`/matches/${id}/run`, {
        sourceCode: code,
        stdin: '',
        stackId: match?.stackId ?? '',
      })
      setRunResult(res)
      await load()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Run failed')
    } finally {
      setRunBusy(false)
    }
  }

  async function submitFinal() {
    setBusy(true)
    setSubmitMsg(null)
    setRunResult(null)
    try {
      await api.post(`/matches/${id}/submissions`, {
        sourceCode: code,
        isFinal: true,
        idempotencyKey: crypto.randomUUID(),
      })
      setSubmitMsg('Final submission queued for evaluation.')
      await load()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Submission failed')
    } finally {
      setBusy(false)
    }
  }

  if (error && !match) return <ErrorState message={error} onRetry={() => void load()} />
  if (!match) return <Loading label="Entering arena" />

  const { user } = useSession()
  const viewerId = user?.id ?? ''
  const viewer = match.participants.find((p) => p.userId === viewerId)
  const opponentParticipant = match.participants.find((p) => p.userId !== viewerId)

  // ---------------------------------------------------------------
  // RESULT SCREEN — server-authoritative numbers only.
  // ---------------------------------------------------------------
  if (['resolved', 'draw', 'abandoned', 'cancelled'].includes(match.status)) {
    const myResult =
      viewer?.result === 'win' || viewer?.result === 'loss' || viewer?.result === 'draw'
        ? viewer.result
        : match.status === 'draw'
          ? 'draw'
          : null
    const headline =
      myResult === 'win' ? 'VICTORY' : myResult === 'loss' ? 'DEFEAT' : 'DRAW'
    const delta =
      viewer?.ratingAfter !== null && viewer?.ratingAfter !== undefined && viewer
        ? viewer.ratingAfter - viewer.ratingBefore
        : null
    // Placement context comes from the server snapshot — never guessed.
    const inPlacement = match.viewerCompetitive?.competitiveStatus === 'unranked'
    const placementDone = match.viewerCompetitive
      ? match.viewerCompetitive.placementMatchesCompleted
      : 0
    const placementTotal = match.viewerCompetitive
      ? match.viewerCompetitive.placementMatchesRequired
      : 0
    const placementLeft = match.viewerCompetitive?.placementRemaining ?? 0

    return (
      <>
        <AppNav />
        <main className="mx-auto max-w-[720px] space-y-6 px-4 py-12">
          <div className="border border-border bg-card/40 p-8 text-center sm:p-12">
            <ClutchLogo size={22} label="" className="mx-auto mb-6 text-primary/70" />
            {inPlacement ? (
              <p className="label-mono mb-4 border border-warning/50 px-3 py-1 inline-block text-[0.62rem] font-black uppercase text-warning">
                Placement match {placementDone} / {placementTotal}
              </p>
            ) : null}
            <h1
              className={cn(
                'text-display text-5xl sm:text-7xl',
                myResult === 'win'
                  ? 'text-victory'
                  : myResult === 'loss'
                    ? 'text-defeat'
                    : 'text-foreground',
              )}
            >
              {headline}
            </h1>

            {delta !== null && delta !== 0 ? (
              <p
                className={cn(
                  'data-mono mt-4 text-2xl font-black',
                  delta > 0 ? 'text-victory' : 'text-defeat',
                )}
              >
                {delta > 0 ? '+' : ''}
                {delta} Rating
              </p>
            ) : (
              <p className="label-mono mt-4 text-xs text-muted-foreground">Unrated match</p>
            )}

            {viewer?.ratingAfter !== null && viewer?.ratingAfter != null ? (
              <p className="data-mono mt-2 text-sm text-muted-foreground">
                {viewer.ratingBefore} → {viewer.ratingAfter}
              </p>
            ) : null}

            {inPlacement ? (
              <p className="label-mono mt-4 text-[0.62rem] uppercase text-muted-foreground">
                {placementLeft > 0
                  ? `Clutch is calibrating your rating — ${placementLeft} placement ${placementLeft === 1 ? 'match' : 'matches'} remaining.`
                  : 'Placement complete — you are now ranked.'}
              </p>
            ) : null}

            <div className="mx-auto mt-8 grid max-w-sm grid-cols-3 gap-px border border-border bg-border">
              <div className="bg-background p-3">
                <p className="label-mono text-[0.55rem] text-muted-foreground">You</p>
                <p className="mt-1 truncate font-mono text-xs">@{viewer?.handle ?? '?'}</p>
              </div>
              <div className="bg-background p-3">
                <p className="label-mono text-[0.55rem] text-muted-foreground">Opponent</p>
                <p className="mt-1 truncate font-mono text-xs">@{opponentParticipant?.handle ?? '?'}</p>
              </div>
              <div className="bg-background p-3">
                <p className="label-mono text-[0.55rem] text-muted-foreground">Stack</p>
                <p className="mt-1 font-mono text-xs">{match.stackId}</p>
              </div>
            </div>

            <button
              onClick={() => router.push('/home')}
              autoFocus
              className="label-mono mt-10 border border-border-strong bg-primary px-8 py-3 text-[0.7rem] font-bold uppercase text-primary-foreground transition-opacity hover:opacity-90"
            >
              Back to arena
            </button>
          </div>
        </main>
      </>
    )
  }

  // ---------------------------------------------------------------
  // LOBBY / VS SCREEN (matched | starting)
  // ---------------------------------------------------------------
  if (match.status === 'matched' || match.status === 'starting') {
    return (
      <>
        <AppNav />
        <main className="mx-auto max-w-[900px] px-4 py-12">
          <Panel className="border-primary/40 p-8 sm:p-12">
            <SectionTitle>
              {match.viewerCompetitive?.competitiveStatus === 'unranked'
                ? `Placement match ${Math.min(match.viewerCompetitive.placementMatchesCompleted + 1, match.viewerCompetitive.placementMatchesRequired)} / ${match.viewerCompetitive.placementMatchesRequired}`
                : 'Finding start'}{' '}
              · {match.publicId}
            </SectionTitle>

            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4 py-8 sm:gap-8">
              <div>
                <PlayerIdentity
                  handle={viewer?.handle ?? null}
                  avatarUrl={viewer?.avatarUrl ?? null}
                  rating={
                    match.viewerCompetitive?.competitiveStatus === 'ranked'
                      ? viewer?.ratingBefore
                      : null
                  }
                />
                {match.viewerCompetitive?.competitiveStatus === 'unranked' ? (
                  <p className="label-mono mt-1 border border-warning/50 px-1.5 py-0.5 inline-block text-[0.55rem] font-black uppercase text-warning">
                    Unranked · Placement {match.viewerCompetitive.placementMatchesCompleted}/
                    {match.viewerCompetitive.placementMatchesRequired}
                  </p>
                ) : null}
              </div>
              <div className="text-center">
                <p className="text-display text-3xl text-primary sm:text-5xl">VS</p>
                <p className="label-mono mt-2 animate-pulse text-[0.55rem] uppercase text-muted-foreground">
                  {match.stackId} · {match.difficultyId}
                </p>
              </div>
              <PlayerIdentity
                handle={match.opponent?.handle ?? opponentParticipant?.handle ?? null}
                avatarUrl={
                  match.opponent?.avatarUrl ?? opponentParticipant?.avatarUrl ?? null
                }
                rating={match.opponent?.ratingBefore ?? opponentParticipant?.ratingBefore}
                align="right"
              />
            </div>

            <button
              onClick={() => void ready()}
              disabled={busy}
              autoFocus
              className="label-mono mx-auto flex w-full max-w-xs items-center justify-center border border-border-strong bg-primary py-4 text-sm font-bold uppercase tracking-widest text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {busy ? 'Locking in…' : 'Ready up'}
            </button>
            <p className="label-mono mt-4 text-center text-[0.58rem] text-muted-foreground">
              The duel starts when both players are locked in.
            </p>
          </Panel>
        </main>
      </>
    )
  }

  // ---------------------------------------------------------------
  // ACTIVE DUEL (active | evaluating)
  // ---------------------------------------------------------------
  const latest = match.submissions[match.submissions.length - 1]

  return (
    <>
      <AppNav />
      <main className="mx-auto max-w-[1400px] space-y-4 px-4 py-6">
        {/* Competitive header */}
        <Panel className="flex flex-wrap items-center justify-between gap-4 py-4">
          <div className="flex min-w-0 items-center gap-4">
            <PlayerIdentity
              handle={viewer?.handle ?? null}
              avatarUrl={viewer?.avatarUrl ?? null}
            />
            <span className="text-display shrink-0 text-lg text-muted-foreground/60">VS</span>
            <PlayerIdentity
              handle={match.opponent?.handle ?? opponentParticipant?.handle ?? null}
              avatarUrl={match.opponent?.avatarUrl ?? opponentParticipant?.avatarUrl ?? null}
              align="right"
            />
          </div>
          <div className="flex items-center gap-6">
            <div className="text-right">
              <p className="label-mono text-[0.55rem] uppercase text-muted-foreground">
                {match.publicId} · {match.stackId} · {match.difficultyId}
              </p>
              {latest ? (
                <div className="mt-1 flex justify-end">
                  <SubmissionStateChip state={latest.status} />
                </div>
              ) : null}
            </div>
            <Timer endsAt={match.endsAt} now={now} />
          </div>
        </Panel>

        <div className="grid gap-4 lg:grid-cols-[minmax(320px,0.9fr)_1.1fr]">
          {/* Problem */}
          <Panel className="max-h-[72vh] overflow-y-auto">
            <div className="mb-4 flex items-center justify-between border-b border-border pb-3">
              <h2 className="font-mono text-sm font-bold">
                {match.questionVersion.promptMd.split('\n')[0]?.replace(/^#+\s*/, '')}
              </h2>
              <span className="label-mono shrink-0 text-[0.55rem] uppercase text-muted-foreground">
                v{match.questionVersion.version} · {match.timeLimitSec}s limit
              </span>
            </div>
            <pre className="whitespace-pre-wrap font-mono text-xs leading-relaxed">
              {match.questionVersion.promptMd.replace(/^#.*\n/, '')}
            </pre>
            {Array.isArray(match.questionVersion.examples) &&
            match.questionVersion.examples.length > 0 ? (
              <div className="mt-5 space-y-3">
                {(match.questionVersion.examples as { input?: string; output?: string }[]).map(
                  (ex, i) => (
                    <div key={i} className="border border-border/60 bg-background/60 p-3 font-mono text-xs">
                      <p className="label-mono text-[0.55rem] uppercase text-muted-foreground">Input</p>
                      <pre className="mt-1 whitespace-pre-wrap">{ex.input}</pre>
                      <p className="label-mono mt-2 text-[0.55rem] uppercase text-muted-foreground">Output</p>
                      <pre className="mt-1 whitespace-pre-wrap">{ex.output}</pre>
                    </div>
                  ),
                )}
              </div>
            ) : null}
            <p className="label-mono mt-5 text-[0.55rem] text-muted-foreground/60">
              Hidden tests are judged server-side after your final submit.
            </p>
          </Panel>

          {/* Editor + submissions */}
          <div className="space-y-4">
            <textarea
              value={code}
              onChange={(e) => setCode(e.target.value)}
              spellCheck={false}
              aria-label="Code editor"
              className="h-[48vh] w-full resize-none border border-border bg-background p-4 font-mono text-xs leading-relaxed outline-none focus:border-primary lg:h-[54vh]"
            />

            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={() => void testRun()}
                disabled={runBusy || match.status !== 'active'}
                className="label-mono border border-border-strong px-5 py-2.5 text-[0.65rem] uppercase transition-colors hover:border-primary hover:text-primary disabled:opacity-40"
              >
                {runBusy ? 'Running…' : 'Test run'}
              </button>
              <button
                onClick={() => void submitFinal()}
                disabled={busy || match.status !== 'active'}
                className="label-mono border border-border-strong bg-primary px-6 py-2.5 text-[0.65rem] font-bold uppercase text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-40"
              >
                {busy ? 'Locking in…' : 'Final submit'}
              </button>
              {match.status === 'evaluating' ? (
                <span className="label-mono animate-pulse text-[0.62rem] uppercase text-warning">
                  Evaluating final submissions…
                </span>
              ) : null}
              {submitMsg ? (
                <span className="label-mono text-[0.6rem] text-signal">{submitMsg}</span>
              ) : null}
            </div>

            {/* Run output panel */}
            {runResult ? (
              <Panel className="space-y-3">
                <div className="flex items-center justify-between border-b border-border pb-2">
                  <SectionTitle>Output</SectionTitle>
                  <div className="flex items-center gap-3">
                    <span className={cn(
                      'label-mono text-[0.58rem] uppercase',
                      runResult.status === 'accepted' ? 'text-signal' : 'text-defeat',
                    )}>
                      {runResult.status.replace(/_/g, ' ')}
                    </span>
                    <span className="label-mono text-[0.55rem] text-muted-foreground">
                      {runResult.executionTimeMs}ms
                    </span>
                    {runResult.exitCode !== 0 ? (
                      <span className="label-mono text-[0.55rem] text-muted-foreground">
                        exit {runResult.exitCode}
                      </span>
                    ) : null}
                    {runResult.timedOut ? (
                      <span className="label-mono text-[0.55rem] text-defeat">timeout</span>
                    ) : null}
                  </div>
                </div>
                {runResult.stdout ? (
                  <div>
                    <p className="label-mono mb-1 text-[0.55rem] uppercase text-muted-foreground">stdout</p>
                    <pre className="max-h-[24vh] overflow-auto whitespace-pre-wrap border border-border/60 bg-background/60 p-3 font-mono text-xs leading-relaxed">
                      {runResult.stdout}
                    </pre>
                  </div>
                ) : null}
                {runResult.stderr ? (
                  <div>
                    <p className="label-mono mb-1 text-[0.55rem] uppercase text-muted-foreground">stderr</p>
                    <pre className="max-h-[16vh] overflow-auto whitespace-pre-wrap border border-defeat/30 bg-defeat/5 p-3 font-mono text-xs leading-relaxed text-defeat">
                      {runResult.stderr}
                    </pre>
                  </div>
                ) : null}
                {!runResult.stdout && !runResult.stderr ? (
                  <p className="text-xs text-muted-foreground">No output.</p>
                ) : null}
              </Panel>
            ) : null}

            <Panel>
              <SectionTitle>Submissions</SectionTitle>
              {match.submissions.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  Nothing submitted yet. Use “Test run” to sanity-check, then “Final submit” to lock
                  your solution.
                </p>
              ) : (
                <ul className="space-y-1.5">
                  {[...match.submissions].reverse().map((s) => (
                    <li key={s.id} className="flex items-center justify-between gap-3">
                      <SubmissionStateChip state={s.status} />
                      <span className="data-mono text-[0.65rem] text-muted-foreground">
                        {s.passedCount}/{s.totalCount} tests ·{' '}
                        {new Date(s.createdAt).toLocaleTimeString()}
                        {!s.isFinal ? ' · test' : ' · final'}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>

            {error ? <ErrorState message={error} /> : null}
          </div>
        </div>
      </main>
    </>
  )
}
