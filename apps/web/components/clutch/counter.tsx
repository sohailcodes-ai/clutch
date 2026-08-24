'use client'

import { animate, useInView } from 'motion/react'
import { useEffect, useRef, useState } from 'react'

type CounterProps = {
  value: number
  duration?: number
  delay?: number
  className?: string
}

/** Counts a number into place the first time it enters the viewport. */
export function Counter({
  value,
  duration = 1.1,
  delay = 0,
  className,
}: CounterProps) {
  const ref = useRef<HTMLSpanElement>(null)
  const inView = useInView(ref, { once: true, margin: '-10% 0px' })
  const [display, setDisplay] = useState(0)

  useEffect(() => {
    if (!inView) return

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduced) {
      setDisplay(value)
      return
    }

    const controls = animate(0, value, {
      duration,
      delay,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (latest) => setDisplay(Math.round(latest)),
    })

    return () => controls.stop()
  }, [inView, value, duration, delay])

  return (
    <span ref={ref} className={className}>
      {display.toLocaleString('en-US')}
    </span>
  )
}
