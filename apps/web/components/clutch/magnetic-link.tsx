'use client'

import { ArrowRight } from 'lucide-react'
import { motion, useMotionValue, useSpring, useTransform } from 'motion/react'
import type { PointerEvent, ReactNode } from 'react'

type Variant = 'primary' | 'secondary' | 'quiet'

const VARIANT_CLASS: Record<Variant, string> = {
  primary:
    'border-primary bg-primary text-primary-foreground hover:bg-primary/90',
  secondary:
    'border-border-strong bg-background/40 text-foreground hover:border-primary hover:text-primary',
  quiet:
    'border-transparent px-0 text-muted-foreground hover:text-foreground',
}

type MagneticLinkProps = {
  children: ReactNode
  href: string
  variant?: Variant
  className?: string
  strength?: number
}

export function MagneticLink({
  children,
  href,
  variant = 'primary',
  className = '',
  strength = 5,
}: MagneticLinkProps) {
  const x = useMotionValue(0)
  const springX = useSpring(x, { stiffness: 260, damping: 20, mass: 0.35 })
  const iconX = useTransform(springX, (value) => value * 0.7 + 2)

  function handlePointerMove(event: PointerEvent<HTMLAnchorElement>) {
    if (event.pointerType !== 'mouse') return
    const rect = event.currentTarget.getBoundingClientRect()
    const relX = (event.clientX - rect.left) / rect.width - 0.5
    x.set(relX * strength * 2)
  }

  function reset() {
    x.set(0)
  }

  return (
    <motion.a
      href={href}
      onPointerMove={handlePointerMove}
      onPointerLeave={reset}
      onBlur={reset}
      whileTap={{ scale: 0.98 }}
      className={`label-mono inline-flex h-12 items-center justify-center gap-3 border px-5 transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none ${VARIANT_CLASS[variant]} ${className}`}
    >
      <motion.span style={{ x: springX }}>{children}</motion.span>
      {variant !== 'quiet' ? (
        <motion.span style={{ x: iconX }} aria-hidden="true">
          <ArrowRight className="size-3.5" strokeWidth={2.4} />
        </motion.span>
      ) : null}
    </motion.a>
  )
}
