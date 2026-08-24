import { MagneticLink } from './magnetic-link'
import { Reveal } from './reveal'

export function ClosingCta() {
  return (
    <section className="mx-auto max-w-[1480px] px-5 py-24 sm:px-8 sm:py-32">
      <div className="grid gap-px border border-border-strong bg-border lg:grid-cols-[1fr_auto]">
        <div className="bg-background p-6 sm:p-8 lg:p-10">
          <Reveal direction="left">
            <p className="label-mono text-primary">Queue gate</p>
          </Reveal>
          <Reveal delay={0.06}>
            <h2 className="text-display mt-6 max-w-5xl text-[clamp(3rem,9vw,8.5rem)] text-balance text-foreground">
              The room opens when two builders commit.
            </h2>
          </Reveal>
          <Reveal delay={0.12}>
            <p className="mt-8 max-w-xl text-base leading-7 text-muted-foreground sm:text-lg">
              Clutch is a preview surface for a head-to-head coding product:
              stack-specific ladders, live judging, public rating movement, and
              seasons that make every result expire into history.
            </p>
          </Reveal>
        </div>
        <div className="flex min-h-72 flex-col justify-between bg-card p-6 sm:p-8 lg:w-96">
          <Reveal direction="right">
            <div>
              <p className="label-mono text-muted-foreground">Next action</p>
              <p className="data-mono mt-4 text-4xl text-foreground">
                00:19
              </p>
              <p className="label-mono mt-3 text-primary">
                median match time
              </p>
            </div>
          </Reveal>
          <Reveal delay={0.12}>
            <div className="flex flex-col gap-3">
              <MagneticLink href="#arena">Enter queue</MagneticLink>
              <MagneticLink href="#ladder" variant="secondary">
                Inspect ladder
              </MagneticLink>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  )
}
