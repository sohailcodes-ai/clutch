import { cn } from '@/lib/utils'

const RARITY_STYLES: Record<string, string> = {
  common: 'border-border text-muted-foreground',
  uncommon: 'border-emerald-500/50 text-emerald-300',
  rare: 'border-sky-400/60 text-sky-300',
  epic: 'border-violet-400/60 text-violet-300',
  legendary: 'border-primary text-primary',
}

/** Rarity-aware title chip. Locked secrets render as "Secret Achievement". */
export function TitleBadge({
  name,
  rarity,
  unlocked = true,
  className,
}: {
  name: string
  rarity: string
  unlocked?: boolean
  className?: string
}) {
  return (
    <span
      className={cn(
        'label-mono inline-flex items-center gap-1.5 border px-2 py-0.5 text-[0.65rem] uppercase tracking-wider',
        RARITY_STYLES[rarity] ?? RARITY_STYLES.common,
        !unlocked && 'opacity-45',
        className,
      )}
    >
      {name}
    </span>
  )
}

export default TitleBadge
