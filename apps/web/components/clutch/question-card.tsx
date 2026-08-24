export type QuestionCardData = {
  slug: string
  title: string
  topic: string
  difficultyId: string
  promptMd: string
  publicTestCount: number
  hiddenTestCount: number
  timeLimitSec: number
}

/**
 * Practice question card. Renders only PUBLIC question metadata — hidden test
 * counts are aggregate numbers, never content.
 */
export function QuestionCard({ question }: { question: QuestionCardData }) {
  return (
    <article className="flex flex-col gap-1 border border-border bg-card/30 px-4 py-3">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="font-mono text-sm font-bold">{question.title}</h3>
        <span className="label-mono shrink-0 text-[0.6rem] uppercase text-primary">
          {question.difficultyId}
        </span>
      </div>
      <p className="label-mono text-[0.6rem] uppercase text-muted-foreground">
        {question.topic} · {question.timeLimitSec}s limit
      </p>
      <p className="mt-1 line-clamp-3 whitespace-pre-wrap text-xs text-muted-foreground/80">
        {question.promptMd.replace(/^#+\s*/gm, '')}
      </p>
      <p className="label-mono mt-2 text-[0.58rem] text-muted-foreground/60">
        {question.publicTestCount} example tests · {question.hiddenTestCount} hidden tests
      </p>
    </article>
  )
}

export default QuestionCard
