'use client'

import { motion } from 'motion/react'
import { SEASON } from '@/lib/clutch-data'
import { Counter } from './counter'
import { Reveal } from './reveal'
import { SectionHeader } from './section-header'

export function Seasons() {
  return (
    <section
      id="season"
      className="border-y border-border-strong bg-card/35 scroll-mt-24"
    >
      <div className="mx-auto max-w-[1480px] px-5 py-24 sm:px-8 sm:py-32">
        <SectionHeader
          index="04"
          eyebrow="Season ledger"
          title="Progress matters because it expires."
        >
          Seasons archive peak rank, soften the reset, and keep old ratings from
          becoming permanent status.
        </SectionHeader>

        <div className="mt-14 grid gap-px border border-border-strong bg-border lg:grid-cols-[1.35fr_0.65fr]">
          <Reveal direction="left" className="bg-background p-6 sm:p-8">
            <div className="flex flex-wrap items-start justify-between gap-8">
              <div>
                <p className="label-mono text-primary">{SEASON.name}</p>
                <h3 className="text-display mt-5 text-[clamp(3rem,9vw,8rem)] text-foreground">
                  {SEASON.title}
                </h3>
              </div>
              <div className="border border-border p-5 text-right">
                <p className="data-mono text-6xl text-foreground">
                  <Counter value={SEASON.daysRemaining} />
                </p>
                <p className="label-mono mt-3 text-muted-foreground">
                  days left
                </p>
              </div>
            </div>

            <div className="mt-12">
              <div className="flex justify-between label-mono text-muted-foreground">
                <span>Opened</span>
                <span>{Math.round(SEASON.progress * 100)}% elapsed</span>
                <span>Reset</span>
              </div>
              <div className="mt-4 h-3 bg-secondary">
                <motion.div
                  className="h-3 bg-primary"
                  initial={{ width: 0 }}
                  whileInView={{ width: `${SEASON.progress * 100}%` }}
                  viewport={{ once: true, margin: '-10% 0px' }}
                  transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
                />
              </div>
            </div>
          </Reveal>

          <dl className="grid gap-px bg-border sm:grid-cols-2 lg:grid-cols-1">
            {SEASON.rules.map((rule, index) => (
              <Reveal
                key={rule.label}
                delay={index * 0.055}
                className="bg-background p-6"
              >
                <dt className="label-mono text-muted-foreground">
                  {rule.label}
                </dt>
                <dd className="data-mono mt-4 text-2xl text-foreground">
                  {rule.value}
                </dd>
              </Reveal>
            ))}
          </dl>
        </div>
      </div>
    </section>
  )
}
