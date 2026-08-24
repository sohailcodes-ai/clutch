'use client'

import { useCallback, useEffect, useState } from 'react'
import { api, ApiError, type TitleCatalogEntry } from '@/lib/api'
import { useSession } from '@/lib/session'
import AppNav from '@/components/clutch/app-nav'
import TitleBadge from '@/components/clutch/title-badge'
import { ErrorState, Loading, SectionTitle } from '@/components/clutch/states'

const RARITY_ORDER = ['legendary', 'epic', 'rare', 'uncommon', 'common']

export default function TitlesPage() {
  const { user } = useSession()
  const [titles, setTitles] = useState<TitleCatalogEntry[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [equipping, setEquipping] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const res = await api.get<{ titles: TitleCatalogEntry[] }>('/titles/catalog')
      setTitles(
        [...res.titles].sort(
          (a, b) =>
            RARITY_ORDER.indexOf(a.rarity) - RARITY_ORDER.indexOf(b.rarity) ||
            a.code.localeCompare(b.code),
        ),
      )
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load titles')
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function equip(titleCode: string | null) {
    setEquipping(titleCode ?? '__none')
    try {
      await api.post('/titles/equip', { titleCode })
      await load()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not equip title')
    } finally {
      setEquipping(null)
    }
  }

  return (
    <>
      <AppNav />
      <main className="mx-auto max-w-[1000px] space-y-6 px-4 py-8">
        <SectionTitle>Titles & achievements</SectionTitle>
        <p className="-mt-3 text-xs text-muted-foreground">
          Unlock conditions are deterministic and verified on the server after every ranked
          match. Secret achievements reveal themselves only when earned.
        </p>

        {error ? <ErrorState message={error} /> : null}
        {!titles ? (
          <Loading label="Loading catalog" />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {titles.map((t) => {
              const equippedByMe =
                user?.profile?.equippedTitleId && t.unlocked && t.awardedAt !== null
              return (
                <div
                  key={t.code}
                  className={`flex flex-col gap-2 border bg-card/30 p-4 ${
                    t.unlocked ? 'border-border' : 'border-border/50 opacity-80'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-mono text-sm font-bold">
                        {t.isSecret && !t.unlocked ? '???' : t.name}
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground/80">
                        {t.isSecret && !t.unlocked ? '"Secret Achievement"' : t.description}
                      </p>
                    </div>
                    <TitleBadge name={t.rarity} rarity={t.rarity} unlocked={t.unlocked} />
                  </div>

                  {t.progress ? (
                    <div>
                      <div className="h-1 w-full border border-border">
                        <div
                          className="h-full bg-primary"
                          style={{
                            width: `${Math.min(100, Math.round((t.progress.current / Math.max(t.progress.target, 1)) * 100))}%`,
                          }}
                        />
                      </div>
                      <p className="label-mono mt-1 text-[0.58rem] text-muted-foreground">
                        {t.progress.current} / {t.progress.target}
                      </p>
                    </div>
                  ) : null}

                  {t.unlocked ? (
                    <button
                      onClick={() => void equip(t.code)}
                      disabled={equipping !== null || Boolean(equippedByMe)}
                      className="label-mono mt-1 self-start border border-border px-3 py-1 text-[0.6rem] uppercase transition-colors hover:border-primary hover:text-primary disabled:opacity-40"
                    >
                      {equipping === t.code ? 'Equipping…' : 'Equip'}
                    </button>
                  ) : null}
                </div>
              )
            })}
          </div>
        )}
      </main>
    </>
  )
}
