'use client'

import { motion, useMotionValue, useSpring, useTransform } from 'motion/react'
import type { PointerEvent, ReactNode } from 'react'

type TiltPanelProps = {
  children: ReactNode
  className?: string
  /** max rotation in degrees */
  max?: number
}

/** Panel that reacts slightly to pointer position. Mouse only. */
export function TiltPanel({ children, className = '', max = 4 }: TiltPanelProps) {
  const px = useMotionValue(0)
  const py = useMotionValue(0)
  const sx = useSpring(px, { stiffness: 150, damping: 20 })
  const sy = useSpring(py, { stiffness: 150, damping: 20 })
  const rotateY = useTransform(sx, [-0.5, 0.5], [-max, max])
  const rotateX = useTransform(sy, [-0.5, 0.5], [max, -max])

  function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
    if (event.pointerType !== 'mouse') return
    const rect = event.currentTarget.getBoundingClientRect()
    px.set((event.clientX - rect.left) / rect.width - 0.5)
    py.set((event.clientY - rect.top) / rect.height - 0.5)
  }

  function reset() {
    px.set(0)
    py.set(0)
  }

  return (
    <motion.div
      onPointerMove={handlePointerMove}
      onPointerLeave={reset}
      style={{ rotateX, rotateY, transformPerspective: 1200 }}
      className={className}
    >
      {children}
    </motion.div>
  )
}
