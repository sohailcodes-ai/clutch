'use client'

import { motion } from 'motion/react'
import { useEffect, useState } from 'react'
import { LIVE_MATCH, MATCH_PHASES } from '@/lib/clutch-data'
import { TiltPanel } from './tilt-panel'

function formatClock(total: number) {
  const minutes = Math.floor(total / 60)
  const seconds = total % 60
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

export function LiveMatch() {
  const [remaining, setRemaining] = useState(LIVE_MATCH.clockStartSeconds)

  useEffect(() => {
    const id = window.setInterval(() => {
      setRemaining((prev) =>
        prev <= 1 ? LIVE_MATCH.clockStartSeconds : prev - 1,
      )
    }, 1000)
    return () => window.clearInterval(id)
  }, [])

  const elapsed = 1 - remaining / LIVE_MATCH.totalSeconds
  const projectedSwing = Math.round(18 + elapsed * 22)

  return (
    <TiltPanel className="w-full" max={2.5}>
      <div className="match-surface scanline border border-border-strong">
        <div className="grid gap-px bg-border">
          <div className="grid gap-px bg-border md:grid-cols-[1fr_13rem]">
            <div className="bg-card/95 p-4 sm:p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="label-mono text-muted-foreground">
                    Match {LIVE_MATCH.id}
                  </p>
                  <h3 className="mt-3 max-w-sm text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
                    {LIVE_MATCH.problem}
                  </h3>
                </div>
                <div className="border border-border px-3 py-2 text-right">
                  <p className="label-mono text-muted-foreground">Stack</p>
                  <p className="data-mono mt-1 text-sm text-primary">
                    {LIVE_MATCH.stack}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-background p-4 sm:p-5">
              <p className="label-mono text-muted-foreground">Clock</p>
              <p className="data-mono mt-3 text-5xl leading-none text-foreground">
                {formatClock(remaining)}
              </p>
              <div className="mt-4 h-1 bg-secondary">
                <motion.div
                  className="h-1 bg-primary"
                  animate={{ width: `${Math.min(elapsed * 100, 100)}%` }}
                  transition={{ duration: 0.9, ease: 'linear' }}
                />
              </div>
            </div>
          </div>

          <div className="grid gap-px bg-border sm:grid-cols-4">
            {MATCH_PHASES.map((phase) => (
              <div key={phase.label} className="bg-background p-4">
                <div className="flex items-center justify-between gap-3">
                  <span
                    className={`size-2 ${
                      phase.state === 'active'
                        ? 'bg-primary'
                        : phase.state === 'complete'
                          ? 'bg-[var(--victory)]'
                          : 'bg-muted-foreground/30'
                    }`}
                    aria-hidden="true"
                  />
                  <span className="data-mono text-xs text-muted-foreground">
                    {phase.offset}
                  </span>
                </div>
                <p className="label-mono mt-4 text-foreground">
                  {phase.label}
                </p>
              </div>
            ))}
          </div>

          <div className="grid gap-px bg-border">
            {LIVE_MATCH.players.map((player, index) => (
              <PlayerLane
                key={player.handle}
                index={index}
                player={player}
                projectedSwing={projectedSwing}
              />
            ))}
          </div>
        </div>
      </div>
    </TiltPanel>
  )
}

type Player = (typeof LIVE_MATCH.players)[number]

function PlayerLane({
  player,
  index,
  projectedSwing,
}: {
  player: Player
  index: number
  projectedSwing: number
}) {
  return (
    <div className="grid gap-px bg-border md:grid-cols-[10rem_1fr_10rem]">
      <div className="bg-background p-4 sm:p-5">
        <p className="label-mono text-muted-foreground">
          {player.region} / lane {index + 1}
        </p>
        <p className="mt-3 text-3xl font-semibold tracking-tight text-foreground">
          {player.handle}
        </p>
      </div>

      <div className="bg-card/90 p-4 sm:p-5">
        <div className="flex items-center justify-between gap-4">
          <p className="label-mono text-muted-foreground">Judge stream</p>
          <p className="data-mono text-xs text-muted-foreground">
            {Math.round(player.progress * 100)}%
          </p>
        </div>
        <div className="mt-4 h-2 bg-secondary">
          <motion.div
            className="h-2 bg-primary"
            initial={{ width: 0 }}
            animate={{ width: `${player.progress * 100}%` }}
            transition={{ duration: 1.1, delay: index * 0.18, ease: [0.16, 1, 0.3, 1] }}
          />
        </div>
        <div className="mt-4 grid grid-cols-4 gap-2">
          {player.verdicts.map((verdict, verdictIndex) => (
            <span
              key={`${player.handle}-${verdictIndex}`}
              className="h-8 border bg-background"
              style={
                verdict === 'pass'
                  ? {
                      borderColor: 'var(--victory)',
                      backgroundColor:
                        'color-mix(in oklch, var(--victory) 14%, transparent)',
                    }
                  : verdict === 'fail'
                    ? {
                        borderColor: 'var(--defeat)',
                        backgroundColor:
                          'color-mix(in oklch, var(--defeat) 14%, transparent)',
                      }
                    : undefined
              }
              aria-label={verdict}
            />
          ))}
        </div>
      </div>

      <div className="bg-background p-4 text-right sm:p-5">
        <p className="label-mono text-muted-foreground">ELO</p>
        <p className="data-mono mt-3 text-3xl text-foreground">{player.elo}</p>
        <p
          className={`data-mono mt-2 text-xs ${
            index === 0 ? 'text-primary' : 'text-muted-foreground'
          }`}
        >
          {index === 0 ? '+' : '-'}
          {projectedSwing} projected
        </p>
      </div>
    </div>
  )
}
