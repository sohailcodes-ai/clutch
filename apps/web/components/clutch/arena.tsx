import { ARENA_STEPS } from '@/lib/clutch-data'
import { Reveal } from './reveal'
import { SectionHeader } from './section-header'

export function Arena() {
  return (
    <section
      id="arena"
      className="mx-auto max-w-[1480px] scroll-mt-24 px-5 py-24 sm:px-8 sm:py-32"
    >
      <SectionHeader
        index="01"
        eyebrow="Arena protocol"
        title="A duel has structure before it has drama."
      >
        Clutch turns matchmaking, solving, judging, and rating movement into one
        visible competitive loop.
      </SectionHeader>

      <ol className="mt-14 grid border border-border-strong bg-border lg:grid-cols-4">
        {ARENA_STEPS.map((step, index) => (
          <li key={step.index} className="bg-background">
            <Reveal
              delay={index * 0.07}
              direction={index % 2 === 0 ? 'left' : 'right'}
              className="group flex min-h-80 flex-col justify-between p-5 transition-colors duration-300 hover:bg-card sm:p-6"
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="data-mono text-5xl text-foreground/12">
                    {step.index}
                  </span>
                  <span className="label-mono border border-border px-2 py-1 text-muted-foreground transition-colors group-hover:border-primary group-hover:text-primary">
                    {step.metric}
                  </span>
                </div>
                <h3 className="mt-10 max-w-xs text-3xl font-semibold tracking-tight text-foreground">
                  {step.title}
                </h3>
              </div>
              <p className="mt-10 text-sm leading-6 text-muted-foreground">
                {step.body}
              </p>
            </Reveal>
          </li>
        ))}
      </ol>
    </section>
  )
}
