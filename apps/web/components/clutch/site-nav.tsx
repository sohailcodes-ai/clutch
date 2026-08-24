'use client'

import { motion, useMotionValueEvent, useScroll } from 'motion/react'
import { useState } from 'react'
import { NAV_LINKS } from '@/lib/clutch-data'
import { ClutchLogo } from '@/components/brand/clutch-logo'

export function SiteNav() {
  const { scrollY } = useScroll()
  const [condensed, setCondensed] = useState(false)

  useMotionValueEvent(scrollY, 'change', (latest) => {
    setCondensed(latest > 28)
  })

  return (
    <header className="fixed inset-x-0 top-0 z-50 px-3 pt-3 sm:px-5">
      <motion.nav
        aria-label="Main"
        animate={{
          backgroundColor: condensed
            ? 'oklch(0.112 0.006 85 / 0.88)'
            : 'oklch(0.112 0.006 85 / 0.68)',
          borderColor: condensed
            ? 'oklch(1 0 0 / 0.18)'
            : 'oklch(1 0 0 / 0.1)',
        }}
        transition={{ duration: 0.28 }}
        className="mx-auto grid h-14 max-w-[1480px] grid-cols-[auto_1fr_auto] items-center border px-3 backdrop-blur-sm sm:px-4"
      >
        <a href="#top" className="group flex items-center gap-3">
          <span className="grid size-7 place-items-center border border-primary/60 text-primary transition-colors group-hover:bg-primary/10">
            <ClutchLogo size={16} label="Clutch home" />
          </span>
          <span className="label-mono hidden text-foreground sm:inline">
            Clutch
          </span>
        </a>

        <div className="mx-auto hidden items-center gap-1 md:flex">
          {NAV_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="label-mono px-3 py-2 text-muted-foreground transition-colors hover:text-foreground"
            >
              {link.label}
            </a>
          ))}
        </div>

        <div className="ml-auto flex items-center gap-3">
          <div className="hidden items-center gap-2 border-l border-border pl-4 lg:flex">
            <span className="size-1.5 bg-primary" aria-hidden="true" />
            <a href="/explore" className="label-mono text-muted-foreground hover:text-primary">
              Explore
            </a>
          </div>
          <a
            href="/home"
            className="label-mono border border-border-strong px-3 py-2 text-foreground transition-colors hover:border-primary hover:bg-primary hover:text-primary-foreground"
          >
            Play
          </a>
        </div>
      </motion.nav>
    </header>
  )
}
