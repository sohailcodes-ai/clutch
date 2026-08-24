'use client'

import { motion } from 'motion/react'
import type { ReactNode } from 'react'

type RevealProps = {
  children: ReactNode
  delay?: number
  className?: string
  direction?: 'up' | 'left' | 'right' | 'none'
}

const DISTANCE = 18

export function Reveal({
  children,
  delay = 0,
  className,
  direction = 'up',
}: RevealProps) {
  const offset =
    direction === 'left'
      ? { x: -DISTANCE, y: 0 }
      : direction === 'right'
        ? { x: DISTANCE, y: 0 }
        : direction === 'none'
          ? { x: 0, y: 0 }
          : { x: 0, y: DISTANCE }

  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, ...offset }}
      whileInView={{ opacity: 1, x: 0, y: 0 }}
      viewport={{ once: true, margin: '-12% 0px -8% 0px' }}
      transition={{ duration: 0.58, delay, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </motion.div>
  )
}

export function RuleReveal({ className }: { className?: string }) {
  return (
    <motion.div
      className={className}
      style={{ transformOrigin: 'left center' }}
      initial={{ scaleX: 0 }}
      whileInView={{ scaleX: 1 }}
      viewport={{ once: true }}
      transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className="h-px w-full bg-border-strong" />
    </motion.div>
  )
}
