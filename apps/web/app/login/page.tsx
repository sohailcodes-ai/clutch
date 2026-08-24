'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { z } from 'zod'
import { handleSchema, describeHandleRules } from '@/lib/validation'
import { api, ApiError, isOnboarded, type SessionUser } from '@/lib/api'
import { useSession } from '@/lib/session'
import { ClutchLogo } from '@/components/brand/clutch-logo'
import { ErrorState, Loading } from '@/components/clutch/states'

const credentialsSchema = z
  .object({
    email: z.string().email('Enter a valid email address'),
    password: z.string().min(8, 'At least 8 characters').max(128),
    confirmPassword: z.string(),
  })
  .refine((v) => v.password === v.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  })

type FieldErrors = Partial<Record<'handle' | 'email' | 'password' | 'confirmPassword', string>>

export default function LoginPage() {
  const { user, loading: sessionLoading, refresh } = useSession()
  const router = useRouter()

  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [step, setStep] = useState<1 | 2>(1)

  // Shared fields
  const [identifier, setIdentifier] = useState('')
  const [handle, setHandle] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  function routeAuthenticated(u: SessionUser) {
    // Server state decides: never-onboarded players go through onboarding once.
    router.replace(isOnboarded(u) ? '/home' : '/onboarding')
  }

  useEffect(() => {
    if (!sessionLoading && user) routeAuthenticated(user)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionLoading, user])

  if (sessionLoading || (user && mode === 'login')) return <Loading label="Checking session" />

  async function submitLogin(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setFieldErrors({})
    setBusy(true)
    try {
      await api.post<{ user: SessionUser }>('/auth/login', {
        email: identifier.trim(), // email address OR public handle (server resolves)
        password,
      })
      await refresh()
      router.push('/home')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong')
    } finally {
      setBusy(false)
    }
  }

  function submitHandle(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setFieldErrors({})
    const parsed = handleSchema.safeParse(handle.trim())
    if (!parsed.success) {
      setFieldErrors({ handle: describeHandleRules() })
      return
    }
    setStep(2)
  }

  async function submitRegister(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setFieldErrors({})
    const parsed = credentialsSchema.safeParse({ email, password, confirmPassword })
    if (!parsed.success) {
      const issues = parsed.error.issues
      const next: FieldErrors = {}
      for (const issue of issues) {
        const key = issue.path[0]
        if (key === 'email' || key === 'password' || key === 'confirmPassword') {
          next[key] ??= issue.message
        }
      }
      setFieldErrors(next)
      return
    }
    setBusy(true)
    try {
      await api.post<{ user: SessionUser }>('/auth/register', {
        email: email.trim().toLowerCase(),
        password,
        handle: handle.trim(),
      })
      await refresh()
      routeAuthenticated(await api.get<{ user: SessionUser }>('/auth/me').then((r) => r.user))
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.status === 409
            ? 'That email or handle is already taken.'
            : err.message
          : 'Something went wrong',
      )
      if (err instanceof ApiError && err.status === 409) setStep(1)
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-10">
      {/* BRAND */}
      <div className="mb-8 text-center">
        <span className="inline-flex items-center gap-2 text-primary">
          <ClutchLogo size={20} label="" />
          <span className="text-display text-xl">Clutch</span>
        </span>
        <h1 className="mt-4 font-mono text-2xl font-bold">
          {mode === 'login'
            ? 'Welcome back.'
            : step === 1
              ? 'Create your Clutch identity'
              : 'Secure your account'}
        </h1>
        {mode === 'register' ? (
          <p className="label-mono mt-2 text-[0.6rem] uppercase tracking-widest text-muted-foreground">
            Step {step} of 2
          </p>
        ) : null}
      </div>

      <div className="border border-border bg-card/40 p-6">
        {/* ------------------------------ LOGIN ------------------------------ */}
        {mode === 'login' ? (
          <form onSubmit={submitLogin} className="space-y-4">
            <label className="block space-y-1.5">
              <span className="label-mono text-[0.62rem] uppercase text-muted-foreground">
                Handle or Email
              </span>
              <input
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                required
                autoComplete="username"
                autoFocus
                className="w-full border border-border bg-background px-3 py-2 font-mono text-sm outline-none focus:border-primary"
              />
            </label>

            <label className="block space-y-1.5">
              <span className="label-mono text-[0.62rem] uppercase text-muted-foreground">Password</span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                className="w-full border border-border bg-background px-3 py-2 font-mono text-sm outline-none focus:border-primary"
              />
            </label>

            {error ? <ErrorState message={error} /> : null}

            <button
              type="submit"
              disabled={busy}
              className="label-mono w-full border border-border-strong bg-primary py-2.5 text-[0.7rem] font-bold uppercase text-primary-foreground transition-opacity disabled:opacity-50"
            >
              {busy ? 'Logging in…' : 'Log in'}
            </button>

            <p className="label-mono text-center text-[0.58rem] normal-case tracking-normal text-muted-foreground/70">
              Password reset is not available yet.
            </p>
          </form>
        ) : null}

        {/* ------------------------- REGISTER · STEP 1 ------------------------ */}
        {mode === 'register' && step === 1 ? (
          <form onSubmit={submitHandle} className="space-y-4">
            <label className="block space-y-1.5">
              <span className="label-mono text-[0.62rem] uppercase text-muted-foreground">
                Public handle
              </span>
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
                  required
                  minLength={3}
                  maxLength={24}
                  pattern="[a-zA-Z0-9_]+"
                  autoComplete="off"
                  spellCheck={false}
                  autoFocus
                  placeholder="NEURALBYTE"
                  className="w-full border border-border bg-background px-3 py-2 font-mono text-sm uppercase outline-none focus:border-primary"
                />
              </span>
            </label>
            {fieldErrors.handle ? <ErrorState message={fieldErrors.handle} /> : null}
            <p className="text-xs leading-relaxed text-muted-foreground">
              This is how other players will see you. It appears on leaderboards, match results and
              your public profile. Choose it carefully — it is your competitive identity, not your
              real name.
            </p>

            <button
              type="submit"
              className="label-mono w-full border border-border-strong bg-primary py-2.5 text-[0.7rem] font-bold uppercase text-primary-foreground transition-opacity hover:opacity-90"
            >
              Continue
            </button>
          </form>
        ) : null}

        {/* ------------------------- REGISTER · STEP 2 ------------------------ */}
        {mode === 'register' && step === 2 ? (
          <form onSubmit={submitRegister} className="space-y-4">
            <p className="border border-border bg-background/60 px-3 py-2 font-mono text-xs">
              Identity: <span className="font-bold text-primary">@{handle}</span>{' '}
              <button
                type="button"
                onClick={() => setStep(1)}
                className="ml-2 label-mono text-[0.55rem] uppercase underline text-muted-foreground hover:text-primary"
              >
                edit
              </button>
            </p>

            <label className="block space-y-1.5">
              <span className="label-mono text-[0.62rem] uppercase text-muted-foreground">Email</span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                className="w-full border border-border bg-background px-3 py-2 font-mono text-sm outline-none focus:border-primary"
              />
              <span className="block text-[0.66rem] text-muted-foreground/70">
                Private account data — never shown publicly.
              </span>
            </label>

            <label className="block space-y-1.5">
              <span className="label-mono text-[0.62rem] uppercase text-muted-foreground">Password</span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                autoComplete="new-password"
                className="w-full border border-border bg-background px-3 py-2 font-mono text-sm outline-none focus:border-primary"
              />
            </label>

            <label className="block space-y-1.5">
              <span className="label-mono text-[0.62rem] uppercase text-muted-foreground">
                Confirm password
              </span>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                autoComplete="new-password"
                className="w-full border border-border bg-background px-3 py-2 font-mono text-sm outline-none focus:border-primary"
              />
            </label>

            {fieldErrors.email || fieldErrors.password || fieldErrors.confirmPassword ? (
              <ErrorState
                message={
                  fieldErrors.email ?? fieldErrors.password ?? fieldErrors.confirmPassword ?? ''
                }
              />
            ) : null}
            {error ? <ErrorState message={error} /> : null}

            <button
              type="submit"
              disabled={busy}
              className="label-mono w-full border border-border-strong bg-primary py-2.5 text-[0.7rem] font-bold uppercase text-primary-foreground transition-opacity disabled:opacity-50"
            >
              {busy ? 'Creating…' : 'Create account'}
            </button>
          </form>
        ) : null}
      </div>

      {/* MODE TOGGLE */}
      <div className="mt-6 text-center">
        {mode === 'login' ? (
          <>
            <p className="label-mono text-[0.62rem] uppercase text-muted-foreground">
              Don&apos;t have an account?
            </p>
            <button
              onClick={() => {
                setMode('register')
                setStep(1)
                setError(null)
              }}
              className="label-mono mt-2 border border-border-strong px-5 py-2 text-[0.65rem] uppercase transition-colors hover:border-primary hover:bg-primary hover:text-primary-foreground"
            >
              Create account
            </button>
          </>
        ) : (
          <>
            <p className="label-mono text-[0.62rem] uppercase text-muted-foreground">
              Already competing?
            </p>
            <button
              onClick={() => {
                setMode('login')
                setError(null)
              }}
              className="label-mono mt-2 border border-border-strong px-5 py-2 text-[0.65rem] uppercase transition-colors hover:border-primary hover:text-primary"
            >
              Log in
            </button>
          </>
        )}
      </div>
    </main>
  )
}
