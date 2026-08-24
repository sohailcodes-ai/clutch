'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import { api, ApiError, isOnboarded, type SessionUser, type StackDto } from '@/lib/api'
import { useSession } from '@/lib/session'
import { ClutchLogo } from '@/components/brand/clutch-logo'
import { ErrorState, Loading, Panel } from '@/components/clutch/states'
import { cn } from '@/lib/utils'

/**
 * First-time onboarding. Short, honest, server-state-gated:
 * - reachable only by authenticated players the server has NOT yet marked
 *   as onboarded (`profile.onboardingCompletedAt === null`)
 * - asks nothing that isn't needed: handle confirmation, optional avatar,
 *   primary stack, placement explanation
 * - competitive initialization stays entirely server-side.
 */
export default function OnboardingPage() {
  const { user, loading: sessionLoading, refresh } = useSession()
  const router = useRouter()

  const [step, setStep] = useState(0)
  const [handle, setHandle] = useState('')
  const [avatarUrl, setAvatarUrl] = useState('')
  const [stackId, setStackId] = useState('')
  const [stacks, setStacks] = useState<StackDto[] | null>(null)
  const [placementTotal, setPlacementTotal] = useState(5)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  // Routing guards derive from SERVER state only.
  useEffect(() => {
    if (sessionLoading) return
    if (!user) router.replace('/login')
    else if (isOnboarded(user)) router.replace('/home')
  }, [sessionLoading, user, router])

  useEffect(() => {
    if (!user) return
    setHandle(user.profile?.handle ?? '')
    api
      .get<{ stacks: StackDto[] }>('/meta/stacks')
      .then((r) => {
        setStacks(r.stacks)
        const preferred = r.stacks.find((s) => s.id === user.profile?.primaryStackId)
        if (preferred) setStackId(preferred.id)
      })
      .catch(() => setError('Could not load supported stacks.'))
    // Placement count comes from the backend-initialized rating rows.
    api
      .get<{ ratings: { gamesPlayed: number; placementRemaining: number }[] }>('/profile')
      .then((r) => {
        const first = r.ratings[0]
        if (first) setPlacementTotal(first.gamesPlayed + first.placementRemaining)
      })
      .catch(() => {})
  }, [user])

  const canContinue = useMemo(() => step !== 2 || stackId !== '', [step, stackId])

  async function finish() {
    setBusy(true)
    setError(null)
    try {
      // Optional profile edits first (handle change + avatar URL), then the
      // authoritative onboarding completion marker.
      const profileEdits: Record<string, string> = {}
      if (user && handle.trim() && handle.trim() !== user.profile?.handle) {
        profileEdits.handle = handle.trim()
      }
      if (avatarUrl.trim()) {
        profileEdits.avatarUrl = avatarUrl.trim()
      }
      if (Object.keys(profileEdits).length > 0) {
        await api.patch('/profile', profileEdits)
      }
      if (!stackId) throw new ApiError('VALIDATION', 'Choose your primary stack', 400)
      await api.post('/profile/onboarding', { primaryStackId: stackId })
      await refresh()
      router.push('/home')
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.status === 409
            ? 'That handle is already taken — pick another one.'
            : err.message
          : 'Something went wrong',
      )
    } finally {
      setBusy(false)
    }
  }

  if (sessionLoading || !user || isOnboarded(user)) return <Loading label="Preparing arena" />

  const STEPS = ['Welcome', 'Handle', 'Avatar', 'Stack', 'Placements']
  const progress = ((step + 1) / STEPS.length) * 100

  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center px-4 py-10">
      {/* Progress */}
      <div className="mb-8">
        <div className="flex items-center justify-between gap-3">
          <span className="inline-flex items-center gap-2 text-primary">
            <ClutchLogo size={16} label="" />
            <span className="text-display text-base">Clutch</span>
          </span>
          <span className="label-mono text-[0.58rem] uppercase text-muted-foreground">
            {STEPS[step]} · {step + 1}/{STEPS.length}
          </span>
        </div>
        <div
          className="mt-3 h-0.5 w-full border border-border"
          role="progressbar"
          aria-valuenow={Math.round(progress)}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div className="h-full bg-primary transition-all duration-500" style={{ width: `${progress}%` }} />
        </div>
      </div>

      <Panel className="min-h-[320px]">
        {/* ------------------------------ WELCOME ------------------------------ */}
        {step === 0 ? (
          <div className="flex h-full flex-col items-start gap-4 py-4 text-left">
            <h1 className="text-display text-3xl sm:text-4xl">
              Account created.
              <br />
              <span className="text-primary">Welcome to Clutch.</span>
            </h1>
            <p className="text-sm leading-relaxed text-muted-foreground">
              You are about to enter head-to-head competitive programming. Four quick steps and
              you&apos;re in the arena — no personal details required beyond what other players
              already see.
            </p>
            <ul className="label-mono space-y-2 text-[0.62rem] uppercase text-muted-foreground">
              <li className="flex items-center gap-2"><span className="size-1 bg-primary" /> Public identity</li>
              <li className="flex items-center gap-2"><span className="size-1 bg-primary" /> Avatar</li>
              <li className="flex items-center gap-2"><span className="size-1 bg-primary" /> Primary stack</li>
              <li className="flex items-center gap-2"><span className="size-1 bg-primary" /> Placement briefing</li>
            </ul>
          </div>
        ) : null}

        {/* ------------------------------- HANDLE ------------------------------ */}
        {step === 1 ? (
          <div className="space-y-4 py-2">
            <h2 className="font-mono text-lg font-bold">Your public handle</h2>
            <p className="text-sm text-muted-foreground">
              This is how other players will see you — on ladders, in match results and on your
              public profile. It is not your real name and never will be.
            </p>
            <span className="flex items-stretch">
              <span
                aria-hidden
                className="grid place-items-center border border-r-0 border-border bg-muted px-3 font-mono text-sm text-muted-foreground"
              >
                @
              </span>
              <input
                value={handle}
                onChange={(e) => setHandle(e.target.value)}
                minLength={3}
                maxLength={24}
                pattern="[a-zA-Z0-9_]+"
                spellCheck={false}
                className="w-full border border-border bg-background px-3 py-2 font-mono text-sm uppercase outline-none focus:border-primary"
              />
            </span>
            <p className="label-mono text-[0.55rem] uppercase tracking-normal normal-case text-muted-foreground/70">
              3–24 characters · letters, numbers, underscore · must be unique
            </p>
          </div>
        ) : null}

        {/* ------------------------------- AVATAR ------------------------------ */}
        {step === 2 ? (
          <div className="space-y-4 py-2">
            <h2 className="font-mono text-lg font-bold">Avatar</h2>
            <p className="text-sm text-muted-foreground">
              Optional. Paste a link to an image you have the right to use, or skip and use the
              default mark.
            </p>

            <div className="flex items-center gap-4">
              {avatarUrl.trim() ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={avatarUrl}
                  alt="Avatar preview"
                  className="size-16 border border-border object-cover"
                />
              ) : (
                <span className="grid size-16 place-items-center border border-border font-mono text-lg font-black text-primary">
                  {(handle || user.profile?.handle || '?').slice(0, 2).toUpperCase()}
                </span>
              )}
              <input
                value={avatarUrl}
                onChange={(e) => setAvatarUrl(e.target.value)}
                type="url"
                placeholder="https://… (optional image URL)"
                aria-label="Avatar image URL"
                className="flex-1 border border-border bg-background px-3 py-2 font-mono text-xs outline-none focus:border-primary"
              />
            </div>

            <button
              onClick={() => setAvatarUrl('')}
              disabled={!avatarUrl}
              className="label-mono border border-border px-4 py-1.5 text-[0.6rem] uppercase text-muted-foreground transition-colors hover:border-primary hover:text-primary disabled:opacity-40"
            >
              Use default
            </button>
            <p className="text-[0.66rem] text-muted-foreground/70">
              File uploads aren&apos;t supported yet — an https image link keeps things simple and safe.
            </p>
          </div>
        ) : null}

        {/* -------------------------------- STACK ------------------------------ */}
        {step === 3 ? (
          <div className="space-y-4 py-2">
            <h2 className="font-mono text-lg font-bold">What do you code in?</h2>
            <p className="text-sm text-muted-foreground">
              Pick your primary language — we&apos;ll pre-select it when you queue. You can compete
              in any supported stack at any time; every stack has its own ladder.
            </p>
            {!stacks ? (
              <Loading label="Loading supported stacks" />
            ) : (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3" role="radiogroup" aria-label="Primary stack">
                {stacks.map((s) => (
                  <button
                    key={s.id}
                    role="radio"
                    aria-checked={stackId === s.id}
                    onClick={() => setStackId(s.id)}
                    className={cn(
                      'border px-3 py-2.5 text-left font-mono text-xs transition-colors',
                      stackId === s.id
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border hover:border-border-strong',
                    )}
                  >
                    <span className="block">{s.name}</span>
                    <span className="label-mono text-[0.5rem] uppercase text-muted-foreground">
                      {s.symbol}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : null}

        {/* ----------------------------- PLACEMENTS ---------------------------- */}
        {step === 4 ? (
          <div className="space-y-4 py-2">
            <h2 className="text-display text-3xl">
              Welcome to <span className="text-primary">Clutch</span>
            </h2>
            <p className="font-mono text-sm">
              You&apos;re currently{' '}
              <span className="font-black uppercase text-warning">Unranked</span>.
            </p>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Clutch needs a few real competitive matches to determine where you belong. Your
              placement matches:
            </p>
            <ul className="space-y-1.5 text-sm text-muted-foreground">
              <li>· are played against real players</li>
              <li>· affect your rating</li>
              <li>· help calibrate your starting rank</li>
              <li>· are not bot matches</li>
            </ul>
            <div className="border border-border bg-background/60 px-4 py-3">
              <p className="label-mono text-[0.58rem] uppercase text-muted-foreground">Placement</p>
              <p className="data-mono mt-1 text-2xl font-black">
                0<span className="text-muted-foreground"> / {placementTotal}</span>
              </p>
            </div>
            <p className="text-[0.68rem] text-muted-foreground/70">
              Your starting rating is provisional until placements complete. Nothing here is
              pre-analyzed — the ladder decides.
            </p>
          </div>
        ) : null}

        {error ? <div className="mt-4"><ErrorState message={error} /></div> : null}

        {/* NAV */}
        <div className="mt-6 flex items-center justify-between border-t border-border pt-5">
          <button
            onClick={() => setStep((s) => Math.max(0, s - 1))}
            disabled={step === 0 || busy}
            className="label-mono border border-border px-4 py-2 text-[0.6rem] uppercase text-muted-foreground transition-colors hover:text-foreground disabled:opacity-30"
          >
            Back
          </button>
          {step < STEPS.length - 1 ? (
            <button
              onClick={() => setStep((s) => s + 1)}
              disabled={!canContinue}
              className="label-mono border border-border-strong bg-primary px-6 py-2 text-[0.65rem] font-bold uppercase text-primary-foreground disabled:opacity-40"
            >
              Continue
            </button>
          ) : (
            <button
              onClick={() => void finish()}
              disabled={busy || !stackId}
              autoFocus
              className="label-mono border border-border-strong bg-primary px-6 py-2 text-[0.65rem] font-bold uppercase text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-40"
            >
              {busy ? 'Entering…' : `Start placement (${placementTotal} matches)`}
            </button>
          )}
        </div>
      </Panel>

      <p className="label-mono mt-6 text-center text-[0.55rem] uppercase text-muted-foreground/60">
        Signed in as @{user.profile?.handle} · session secured server-side
      </p>
    </main>
  )
}
