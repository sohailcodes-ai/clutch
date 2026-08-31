'use client'

import { Panel } from './states'

/** Skeleton that mirrors the active match layout. Shown during initial load. */
export function MatchSkeleton() {
  return (
    <div className="mx-auto max-w-[1400px] space-y-4 px-4 py-6 animate-pulse">
      {/* Competitive header skeleton */}
      <Panel className="flex flex-wrap items-center justify-between gap-4 py-4">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="size-9 border border-border bg-muted/30" />
            <div className="space-y-1.5">
              <div className="h-3 w-20 bg-muted/30" />
              <div className="h-2 w-14 bg-muted/20" />
            </div>
          </div>
          <div className="text-display text-lg text-muted-foreground/30">VS</div>
          <div className="flex items-center gap-3">
            <div className="size-9 border border-border bg-muted/30" />
            <div className="space-y-1.5">
              <div className="h-3 w-20 bg-muted/30" />
              <div className="h-2 w-14 bg-muted/20" />
            </div>
          </div>
        </div>
        <div className="flex items-center gap-6">
          <div className="space-y-1.5 text-right">
            <div className="h-2 w-32 bg-muted/20" />
            <div className="h-3 w-16 bg-muted/30" />
          </div>
          <div className="h-10 w-20 bg-muted/20" />
        </div>
      </Panel>

      <div className="grid gap-4 lg:grid-cols-[minmax(320px,0.9fr)_1.1fr]">
        {/* Problem panel skeleton */}
        <Panel className="max-h-[72vh] overflow-hidden">
          <div className="mb-4 flex items-center justify-between border-b border-border pb-3">
            <div className="h-4 w-48 bg-muted/30" />
            <div className="h-3 w-24 bg-muted/20" />
          </div>
          <div className="space-y-2">
            <div className="h-3 w-full bg-muted/20" />
            <div className="h-3 w-5/6 bg-muted/20" />
            <div className="h-3 w-4/6 bg-muted/20" />
            <div className="h-3 w-full bg-muted/20" />
            <div className="h-3 w-3/4 bg-muted/20" />
          </div>
          <div className="mt-6 space-y-3">
            <div className="border border-border/60 bg-background/60 p-3">
              <div className="h-2 w-12 bg-muted/20" />
              <div className="mt-2 h-3 w-32 bg-muted/20" />
              <div className="mt-3 h-2 w-12 bg-muted/20" />
              <div className="mt-2 h-3 w-28 bg-muted/20" />
            </div>
          </div>
        </Panel>

        {/* Editor + submissions skeleton */}
        <div className="space-y-4">
          <div className="h-[48vh] w-full border border-border bg-muted/10 lg:h-[54vh]" />

          <div className="flex items-center gap-3">
            <div className="h-9 w-24 border border-border bg-muted/20" />
            <div className="h-9 w-28 border border-border-strong bg-primary/30" />
          </div>

          <Panel>
            <div className="mb-3 h-3 w-24 bg-muted/30" />
            <div className="space-y-1.5">
              <div className="h-7 w-full bg-muted/10" />
              <div className="h-7 w-full bg-muted/10" />
              <div className="h-7 w-full bg-muted/10" />
            </div>
          </Panel>
        </div>
      </div>
    </div>
  )
}

export default MatchSkeleton
