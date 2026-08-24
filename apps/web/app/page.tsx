import { Arena } from '@/components/clutch/arena'
import { ClosingCta } from '@/components/clutch/closing-cta'
import { Hero } from '@/components/clutch/hero'
import { Ranked } from '@/components/clutch/ranked'
import { Seasons } from '@/components/clutch/seasons'
import { SiteFooter } from '@/components/clutch/site-footer'
import { SiteNav } from '@/components/clutch/site-nav'
import { StackRatings } from '@/components/clutch/stack-ratings'
import { WordmarkBand } from '@/components/clutch/wordmark-band'

export default function Page() {
  return (
    <div className="clutch-shell min-h-screen">
      <SiteNav />
      <main>
        <Hero />
        <WordmarkBand />
        <Arena />
        <Ranked />
        <StackRatings />
        <Seasons />
        <ClosingCta />
      </main>
      <SiteFooter />
    </div>
  )
}
