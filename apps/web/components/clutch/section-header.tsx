import type { ReactNode } from 'react'
import { Reveal } from './reveal'

type SectionHeaderProps = {
  index: string
  eyebrow: string
  title: string
  children?: ReactNode
}

export function SectionHeader({
  index,
  eyebrow,
  title,
  children,
}: SectionHeaderProps) {
  return (
    <div className="grid gap-8 border-t border-border-strong pt-6 lg:grid-cols-12 lg:gap-12">
      <Reveal direction="left" className="lg:col-span-4">
        <p className="label-mono text-muted-foreground">
          <span className="text-primary">{index}</span> / {eyebrow}
        </p>
      </Reveal>
      <Reveal direction="right" className="lg:col-span-5">
        <h2 className="text-display text-[clamp(2rem,5vw,4.8rem)] text-balance text-foreground">
          {title}
        </h2>
      </Reveal>
      {children ? (
        <Reveal delay={0.08} className="lg:col-span-3">
          <div className="text-sm leading-6 text-muted-foreground sm:text-base">
            {children}
          </div>
        </Reveal>
      ) : null}
    </div>
  )
}
