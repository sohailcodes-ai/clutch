import { NAV_LINKS } from '@/lib/clutch-data'
import { ClutchLogo } from '@/components/brand/clutch-logo'

export function SiteFooter() {
  return (
    <footer className="border-t border-border bg-background">
      <div className="mx-auto grid max-w-[1480px] gap-8 px-5 py-10 sm:px-8 lg:grid-cols-[1fr_auto_1fr] lg:items-center">
        <p className="flex items-center gap-2.5">
          <span className="text-primary">
            <ClutchLogo size={18} label="" />
          </span>
          <span className="label-mono text-foreground">Clutch</span>
        </p>
        <nav aria-label="Footer">
          <ul className="flex flex-wrap gap-x-6 gap-y-3">
            {NAV_LINKS.map((link) => (
              <li key={link.href}>
                <a
                  href={link.href}
                  className="label-mono text-muted-foreground transition-colors hover:text-foreground"
                >
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
        <p className="label-mono text-muted-foreground lg:text-right">
          Competitive coding duels
        </p>
      </div>
    </footer>
  )
}
