'use client'

import { motion, useScroll, useTransform } from 'motion/react'
import { useRef } from 'react'

const TICKER = [
  'queue locked',
  'same prompt',
  'hidden tests',
  'rating pending',
  'verdict incoming',
] as const

export function WordmarkBand() {
  const ref = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start end', 'end start'],
  })
  const x = useTransform(scrollYProgress, [0, 1], ['-8%', '4%'])

  return (
    <div ref={ref} className="overflow-hidden border-y border-border-strong">
      <motion.div
        style={{ x }}
        className="flex w-max items-center gap-8 py-5 text-nowrap"
        aria-hidden="true"
      >
        {Array.from({ length: 3 }).map((_, groupIndex) =>
          TICKER.map((item) => (
            <span
              key={`${groupIndex}-${item}`}
              className="label-mono text-muted-foreground"
            >
              {item}
              <span className="ml-8 text-primary">/</span>
            </span>
          )),
        )}
      </motion.div>
    </div>
  )
}
