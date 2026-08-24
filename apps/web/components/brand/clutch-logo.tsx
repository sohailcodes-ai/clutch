import Image from 'next/image'
import { cn } from '@/lib/utils'

/**
 * ClutchLogo — the ONE brand component.
 *
 * The source-of-truth asset lives untouched at `/brand/clutch-logo.svg`
 * (copied verbatim from the supplied official SVG).
 *
 * Variants:
 * - 'mark'   : the logo glyph as an inline vector, tinted with currentColor
 *              so it adapts automatically to light/dark surfaces.
 * - 'tile'   : the ORIGINAL asset rendered inside its native white tile —
 *              use on dark surfaces where the badge look is wanted.
 * - 'lockup' : mark + CLUTCH wordmark for headers/footers.
 */

const MARK_PATHS = [
  'M508.495 285.223C523.37 284.535 545.606 286.794 560.124 290.059C622.042 303.984 666.975 337.122 701.066 389.721C668.717 405.64 636.761 424.449 604.226 440.301C598.647 443.019 593.475 445.996 587.731 448.464C570.108 431.12 551.954 418.86 526.663 415.688C502.289 412.571 477.675 419.26 458.231 434.286C436.978 450.786 424.807 473.432 421.547 500.052C419.581 511.39 420.782 523.202 422.769 534.429C402.583 545.56 380.693 556.075 360.154 566.681C342.139 575.983 323.708 586.013 305.587 594.929C296.517 572.709 291.492 546.433 290.491 522.523C288.06 461.903 309.716 402.784 350.73 358.079C391.458 313.672 448.279 287.432 508.495 285.223Z',
  'M698.721 413.978L699.264 414.213C697.09 416.3 687.415 422.619 684.301 424.804L646.347 451.27C602.359 482.33 557.959 512.802 513.158 542.677C493.259 556.04 469.095 570.503 450 584.425C477.579 611.122 523.601 616.846 557.234 598.576C581.469 585.676 599.392 563.445 606.859 537.025C612.744 538.15 618.732 539.656 624.502 541.281C660.578 551.443 697.596 559.142 733.529 569.703C718.675 625.658 681.806 672.417 633.976 704.206C626.185 709.114 618.123 713.579 609.828 717.579C556.147 742.648 494.771 745.646 438.902 725.928C382.962 705.558 337.149 664.21 311.17 610.643C319.536 605.667 333.133 599.207 342.009 594.659L409.317 560.195C505.094 510.1 601.571 461.356 698.721 413.978Z',
] as const

export function ClutchMark({
  size = 24,
  className,
  label = 'Clutch',
}: {
  size?: number
  className?: string
  label?: string
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="285 282 451 446"
      role="img"
      aria-label={label}
      className={cn('shrink-0', className)}
    >
      {MARK_PATHS.map((d) => (
        <path key={d.slice(0, 24)} d={d} fill="currentColor" />
      ))}
    </svg>
  )
}

export function ClutchTile({
  size = 32,
  className,
  label = 'Clutch',
}: {
  size?: number
  className?: string
  label?: string
}) {
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center justify-center overflow-hidden bg-white',
        className,
      )}
      style={{ width: size, height: size }}
    >
      <Image
        src="/brand/clutch-logo.svg"
        alt={label}
        width={size}
        height={size}
        className="size-full object-contain"
      />
    </span>
  )
}

export function ClutchLogo({
  variant = 'mark',
  size = 24,
  className,
  label,
}: {
  variant?: 'mark' | 'tile' | 'lockup'
  size?: number
  className?: string
  label?: string
}) {
  if (variant === 'tile') {
    return <ClutchTile size={size} className={className} label={label} />
  }

  if (variant === 'lockup') {
    return (
      <span className={cn('inline-flex items-center gap-2.5', className)}>
        <ClutchMark size={size} label={label ?? 'Clutch'} />
        <span
          className="text-display leading-none"
          style={{ fontSize: Math.round(size * 0.82) }}
        >
          Clutch
        </span>
      </span>
    )
  }

  return <ClutchMark size={size} className={className} label={label} />
}

export default ClutchLogo
