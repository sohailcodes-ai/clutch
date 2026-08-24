'use client'

import { useCallback, useEffect, useState } from 'react'
import { api, ApiError } from '@/lib/api'
import AdminNav from '@/components/clutch/admin/admin-nav'
import { ErrorState, Loading, Panel, SectionTitle } from '@/components/clutch/states'

type AdminQuestionDto = {
  id: string
  slug: string
  title: string
  status: string
  difficultyId: string
  topic: string
  versions: { id: string; version: number; publishedAt: string | null }[]
}

export default function AdminQuestionsPage() {
  const [questions, setQuestions] = useState<AdminQuestionDto[] | null>(null)
  const [status, setStatus] = useState<'all' | 'draft' | 'published' | 'retired'>('all')
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  const load = useCallback(async (s: string) => {
    try {
      const res = await api.get<{ questions: AdminQuestionDto[] }>(
        `/admin/questions?status=${s}`,
      )
      setQuestions(res.questions)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load questions')
    }
  }, [])

  useEffect(() => {
    void load(status)
  }, [load, status])

  async function act(questionId: string, verb: 'publish' | 'unpublish' | 'archive') {
    setBusyId(questionId)
    setError(null)
    try {
      await api.post(`/admin/questions/${questionId}/${verb}`)
      await load(status)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Action failed')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <>
      <AdminNav />
      <main className="mx-auto max-w-[1100px] space-y-6 px-4 py-8">
        <SectionTitle>Question administration</SectionTitle>
        <p className="-mt-3 text-xs text-muted-foreground">
          Publishing a new version never mutates a version already used by an active match. Hidden
          tests are write-only and are never returned by any endpoint.
        </p>

        <div className="flex gap-1 border border-border p-1">
          {(['all', 'draft', 'published', 'retired'] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStatus(s)}
              className={`label-mono flex-1 py-1.5 text-[0.65rem] uppercase ${
                status === s ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {s}
            </button>
          ))}
        </div>

        {error ? <ErrorState message={error} /> : null}

        {!questions ? (
          <Loading />
        ) : (
          <div className="space-y-2">
            {questions.map((q) => (
              <Panel key={q.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div className="min-w-0">
                  <p className="truncate font-mono text-sm">{q.title}</p>
                  <p className="label-mono mt-0.5 text-[0.6rem] uppercase text-muted-foreground">
                    {q.slug} · {q.difficultyId} · {q.topic} · v{q.versions.map((v) => v.version).join(',')} ·{' '}
                    <span
                      className={
                        q.status === 'published'
                          ? 'text-emerald-400'
                          : q.status === 'retired'
                            ? 'text-red-400'
                            : 'text-primary'
                      }
                    >
                      {q.status}
                    </span>
                  </p>
                </div>
                <div className="flex gap-2">
                  {(['publish', 'unpublish', 'archive'] as const).map((verb) => (
                    <button
                      key={verb}
                      onClick={() => void act(q.id, verb)}
                      disabled={busyId === q.id}
                      className="label-mono border border-border px-3 py-1.5 text-[0.6rem] uppercase transition-colors hover:border-primary hover:text-primary disabled:opacity-40"
                    >
                      {verb}
                    </button>
                  ))}
                </div>
              </Panel>
            ))}
          </div>
        )}
      </main>
    </>
  )
}
