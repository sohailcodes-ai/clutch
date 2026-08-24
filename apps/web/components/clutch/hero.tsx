'use client'

import { motion } from 'motion/react'
import { Counter } from './counter'
import { LiveMatch } from './live-match'
import { MagneticLink } from './magnetic-link'
import { HERO_STATS } from '@/lib/clutch-data'
import { ClutchLogo } from '@/components/brand/clutch-logo'

const HEADLINE = ['Code', 'under', 'pressure'] as const

export function Hero() {
  return (
    <section id="top" className="relative overflow-hidden pt-24 sm:pt-28">
      <div className="mx-auto grid min-h-[calc(100svh-6rem)] max-w-[1480px] grid-rows-[auto_1fr_auto] px-5 sm:px-8">
        <div className="grid gap-px border border-border-strong bg-border lg:grid-cols-[1.05fr_0.95fr]">
          <div className="bg-background p-5 sm:p-8 lg:p-10">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-5">
              <p className="label-mono flex items-center gap-2 text-primary">
                <ClutchLogo size={15} label="" />
                Competitive dev arena
              </p>
              <p className="label-mono text-muted-foreground">Season 04</p>
            </div>

            <h1 className="mt-10 text-display text-[clamp(4.2rem,12vw,12.5rem)] text-foreground">
              <span className="sr-only">Clutch - Code under pressure.</span>
              {HEADLINE.map((word, index) => (
                <span key={word} className="block overflow-hidden">
                  <motion.span
                    className={index === 2 ? 'block text-primary' : 'block'}
                    initial={{ y: '110%' }}
                    animate={{ y: '0%' }}
                    transition={{
                      duration: 0.85,
                      delay: 0.08 + index * 0.08,
                      ease: [0.16, 1, 0.3, 1],
                    }}
                    aria-hidden="true"
                  >
                    {word}
                  </motion.span>
                </span>
              ))}
            </h1>

            <div className="mt-10 grid gap-8 border-t border-border pt-7 lg:grid-cols-[1fr_auto] lg:items-end">
              <p className="max-w-xl text-lg leading-8 text-muted-foreground sm:text-xl">
                Pick a stack, match a real opponent, solve the same problem on
                the same clock, and let the rating move in public.
              </p>
              <div className="flex flex-wrap gap-3">
                <MagneticLink href="#arena">Enter queue</MagneticLink>
                <MagneticLink href="#ladder" variant="secondary">
                  Read ladder
                </MagneticLink>
              </div>
            </div>
          </div>

          <div className="bg-background p-3 sm:p-5 lg:p-8">
            <LiveMatch />
          </div>
        </div>

        <dl className="grid border-x border-border-strong bg-background sm:grid-cols-3">
          {HERO_STATS.map((stat, index) => (
            <div
              key={stat.label}
              className="border-b border-r border-border p-5 last:border-r-0 sm:p-6"
            >
              <dt className="label-mono text-muted-foreground">
                {stat.label}
              </dt>
              <dd className="data-mono mt-4 text-4xl text-foreground sm:text-5xl">
                <Counter value={stat.value} delay={0.6 + index * 0.08} />
              </dd>
              <p className="label-mono mt-3 text-muted-foreground/70">
                {stat.detail}
              </p>
            </div>
          ))}
        </dl>
      </div>
    </section>
  )
}
