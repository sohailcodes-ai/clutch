import { GLOBAL_RANKS } from '@/lib/clutch-data'
import { Counter } from './counter'
import { Reveal } from './reveal'
import { SectionHeader } from './section-header'

export function Ranked() {
  const leader = GLOBAL_RANKS[0]

  return (
    <section
      id="ladder"
      className="mx-auto max-w-[1480px] scroll-mt-24 px-5 py-24 sm:px-8 sm:py-32"
    >
      <SectionHeader
        index="02"
        eyebrow="Rating pressure"
        title="The ladder is a live instrument, not a trophy shelf."
      >
        Rating moves when a duel resolves. Form, stack, and recent movement are
        visible so rank feels earned, contested, and temporary.
      </SectionHeader>

      <div className="mt-14 grid gap-px border border-border-strong bg-border lg:grid-cols-[0.9fr_1.45fr]">
        <Reveal direction="left" className="bg-card p-6 sm:p-8">
          <p className="label-mono text-muted-foreground">Current target</p>
          <div className="mt-10 flex items-end justify-between gap-6">
            <div>
              <p className="text-display text-[clamp(4rem,12vw,9rem)] text-primary">
                #{leader.rank}
              </p>
              <h3 className="-mt-1 text-4xl font-semibold tracking-tight text-foreground">
                {leader.handle}
              </h3>
            </div>
            <div className="text-right">
              <p className="data-mono text-5xl text-foreground">
                <Counter value={leader.elo} />
              </p>
              <p className="label-mono mt-3 text-primary">
                +{leader.delta} today
              </p>
            </div>
          </div>
          <div className="mt-12 h-2 bg-secondary">
            <div
              className="h-2 bg-primary"
              style={{ width: `${leader.momentum * 100}%` }}
            />
          </div>
          <p className="label-mono mt-4 text-muted-foreground">
            Momentum / {Math.round(leader.momentum * 100)}
          </p>
        </Reveal>

        <div className="bg-background">
          <div className="hidden grid-cols-[4rem_1fr_6rem_7rem_7rem] border-b border-border px-5 py-3 label-mono text-muted-foreground md:grid">
            <span>Rank</span>
            <span>Player</span>
            <span>Stack</span>
            <span>Form</span>
            <span className="text-right">ELO</span>
          </div>
          <ul>
            {GLOBAL_RANKS.map((row, index) => (
              <li key={row.handle}>
                <Reveal
                  delay={index * 0.045}
                  className="group grid gap-4 border-b border-border px-5 py-5 transition-colors hover:bg-card md:grid-cols-[4rem_1fr_6rem_7rem_7rem] md:items-center"
                >
                  <span className="label-mono text-primary">
                    #{String(row.rank).padStart(2, '0')}
                  </span>
                  <span>
                    <span className="block text-2xl font-semibold tracking-tight text-foreground">
                      {row.handle}
                    </span>
                    <span
                      className={`data-mono text-xs ${
                        row.delta > 0 ? 'text-primary' : 'text-[var(--defeat)]'
                      }`}
                    >
                      {row.delta > 0 ? '+' : ''}
                      {row.delta} movement
                    </span>
                  </span>
                  <span className="label-mono text-muted-foreground">
                    {row.stack}
                  </span>
                  <span className="flex gap-1" aria-label={`form ${row.form}`}>
                    {row.form.split('').map((result, resultIndex) => (
                      <span
                        key={`${row.handle}-${resultIndex}`}
                        className={`grid size-6 place-items-center border data-mono text-[0.62rem] ${
                          result === 'W'
                            ? 'border-[var(--victory)] text-[var(--victory)]'
                            : 'border-[var(--defeat)] text-[var(--defeat)]'
                        }`}
                      >
                        {result}
                      </span>
                    ))}
                  </span>
                  <span className="data-mono text-right text-2xl text-foreground">
                    <Counter value={row.elo} delay={index * 0.04} />
                  </span>
                </Reveal>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  )
}
