'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { api, ApiError, type SessionUser } from '@/lib/api'
import { useSession } from '@/lib/session'
import { ClutchLogo } from '@/components/brand/clutch-logo'
import { ErrorState, Loading } from '@/components/clutch/states'

export default function VerifyPage() {
  const { user, loading: sessionLoading, refresh } = useSession()
  const router = useRouter()

  const [otp, setOtp] = useState(['', '', '', '', '', ''])
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [resent, setResent] = useState(false)
  const [verified, setVerified] = useState(false)
  const inputRefs = useRef<(HTMLInputElement | null)[]>([])

  useEffect(() => {
    if (!sessionLoading && !user) router.replace('/login')
  }, [sessionLoading, user, router])

  useEffect(() => {
    if (!sessionLoading && user?.emailVerifiedAt) router.replace('/home')
  }, [sessionLoading, user, router])

  if (sessionLoading || !user) return <Loading label="Checking session" />
  if (user.emailVerifiedAt) return <Loading label="Already verified" />

  function handleOtpChange(index: number, value: string) {
    if (!/^\d*$/.test(value)) return
    const next = [...otp]
    next[index] = value.slice(-1)
    setOtp(next)
    setError(null)

    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus()
    }
  }

  function handleKeyDown(index: number, e: React.KeyboardEvent) {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus()
    }
    if (e.key === 'Enter') {
      e.preventDefault()
      submitOtp()
    }
  }

  function handlePaste(e: React.ClipboardEvent) {
    e.preventDefault()
    const text = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
    if (!text) return
    const next = [...otp]
    for (let i = 0; i < 6; i++) {
      next[i] = text[i] ?? ''
    }
    setOtp(next)
    const focusIdx = Math.min(text.length, 5)
    inputRefs.current[focusIdx]?.focus()
  }

  async function submitOtp() {
    const code = otp.join('')
    if (code.length !== 6) {
      setError('Enter all 6 digits')
      return
    }
    setBusy(true)
    setError(null)
    try {
      await api.post<{ verified: boolean }>('/auth/verify/confirm', { otp: code })
      setVerified(true)
      await refresh()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Verification failed')
    } finally {
      setBusy(false)
    }
  }

  async function resendCode() {
    setResent(false)
    setError(null)
    try {
      await api.post('/auth/verify/request')
      setResent(true)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not resend code')
    }
  }

  if (verified) {
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-10">
        <div className="mb-8 text-center">
          <span className="inline-flex items-center gap-2 text-primary">
            <ClutchLogo size={20} label="" />
            <span className="text-display text-xl">Clutch</span>
          </span>
          <h1 className="mt-4 font-mono text-2xl font-bold">You&apos;re verified.</h1>
          <p className="label-mono mt-2 text-[0.6rem] uppercase tracking-widest text-muted-foreground">
            Your account is now fully active
          </p>
        </div>
        <div className="border border-border bg-card/40 p-6 text-center">
          <button
            onClick={() => router.push('/home')}
            className="label-mono w-full border border-border-strong bg-primary py-2.5 text-[0.7rem] font-bold uppercase text-primary-foreground transition-opacity hover:opacity-90"
          >
            Continue into Clutch
          </button>
        </div>
      </main>
    )
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-10">
      <div className="mb-8 text-center">
        <span className="inline-flex items-center gap-2 text-primary">
          <ClutchLogo size={20} label="" />
          <span className="text-display text-xl">Clutch</span>
        </span>
        <h1 className="mt-4 font-mono text-2xl font-bold">Verify your email</h1>
        <p className="label-mono mt-2 text-[0.6rem] uppercase tracking-widest text-muted-foreground">
          We sent a 6-digit code to {user.email}
        </p>
      </div>

      <div className="border border-border bg-card/40 p-6">
        <form
          onSubmit={(e) => {
            e.preventDefault()
            submitOtp()
          }}
          className="space-y-4"
        >
          <label className="block space-y-1.5">
            <span className="label-mono text-[0.62rem] uppercase text-muted-foreground">
              Verification code
            </span>
            <div className="flex justify-center gap-2">
              {otp.map((digit, i) => (
                <input
                  key={i}
                  ref={(el) => {
                    inputRefs.current[i] = el
                  }}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleOtpChange(i, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(i, e)}
                  onPaste={i === 0 ? handlePaste : undefined}
                  autoFocus={i === 0}
                  className="h-12 w-10 border border-border bg-background text-center font-mono text-lg outline-none focus:border-primary"
                />
              ))}
            </div>
          </label>

          {error ? <ErrorState message={error} /> : null}

          {resent ? (
            <p className="label-mono text-center text-[0.6rem] uppercase text-primary">
              Code resent — check your inbox
            </p>
          ) : null}

          <button
            type="submit"
            disabled={busy}
            className="label-mono w-full border border-border-strong bg-primary py-2.5 text-[0.7rem] font-bold uppercase text-primary-foreground transition-opacity disabled:opacity-50"
          >
            {busy ? 'Verifying…' : 'Verify'}
          </button>

          <p className="label-mono text-center text-[0.58rem] normal-case tracking-normal text-muted-foreground/70">
            Didn&apos;t receive it?{' '}
            <button
              type="button"
              onClick={resendCode}
              className="underline hover:text-primary"
            >
              Resend code
            </button>
          </p>
        </form>
      </div>
    </main>
  )
}
