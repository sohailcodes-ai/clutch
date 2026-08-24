'use client'

import { motion } from 'motion/react'
import { STACK_ELO_CEILING, STACKS } from '@/lib/clutch-data'
import { Counter } from './counter'
import { Reveal } from './reveal'
import { SectionHeader } from './section-header'

const STACK_HUE_CLASS = {
  gold: 'stack-gold',
  cyan: 'stack-cyan',
  red: 'stack-red',
  green: 'stack-green',
} as const

export function StackRatings() {
  return (
    <section
      id="stacks"
      className="mx-auto max-w-[1480px] scroll-mt-24 px-5 py-24 sm:px-8 sm:py-32"
    >
      <SectionHeader
        index="03"
        eyebrow="Stack identity"
        title="You are not one rating wearing different syntax."
      >
        Clutch gives each stack its own ladder, ceiling, and competitive texture.
        A Python climb should not blur into a Rust climb.
      </SectionHeader>

      <div className="mt-14 grid gap-px border border-border-strong bg-border md:grid-cols-2 xl:grid-cols-4">
        {STACKS.map((stack, index) => (
          <Reveal key={stack.name} delay={index * 0.06} className="bg-background">
            <article
              className={`${STACK_HUE_CLASS[stack.hue]} group flex min-h-[30rem] flex-col justify-between p-5 transition-colors hover:bg-card sm:p-6`}
            >
              <div>
                <div className="flex items-start justify-between gap-4">
                  <div className="grid size-20 place-items-center border border-[var(--stack)] bg-[var(--stack)]/10">
                    <span className="data-mono text-2xl text-[var(--stack)]">
                      {stack.symbol}
                    </span>
                  </div>
                  <span className="label-mono border border-border px-2 py-1 text-muted-foreground">
                    {stack.tier}
                  </span>
                </div>

                <h3 className="mt-10 text-4xl font-semibold tracking-tight text-foreground">
                  {stack.name}
                </h3>
                <p className="mt-4 text-sm leading-6 text-muted-foreground">
                  {stack.identity}
                </p>
              </div>

              <div>
                <div className="mb-4 flex items-end justify-between gap-4">
                  <div>
                    <p className="label-mono text-muted-foreground">Rating</p>
                    <p className="data-mono mt-2 text-4xl text-foreground">
                      <Counter value={stack.elo} delay={index * 0.05} />
                    </p>
                  </div>
                  <p className="label-mono text-muted-foreground">
                    {stack.matches} duels
                  </p>
                </div>
                <div className="h-2 bg-secondary">
                  <motion.div
                    className="h-2 bg-[var(--stack)]"
                    initial={{ width: 0 }}
                    whileInView={{
                      width: `${Math.min(
                        (stack.elo / STACK_ELO_CEILING) * 100,
                        100,
                      )}%`,
                    }}
                    viewport={{ once: true, margin: '-10% 0px' }}
                    transition={{
                      duration: 1,
                      delay: 0.12 + index * 0.06,
                      ease: [0.16, 1, 0.3, 1],
                    }}
                  />
                </div>
              </div>
            </article>
          </Reveal>
        ))}
      </div>
    </section>
  )
}
