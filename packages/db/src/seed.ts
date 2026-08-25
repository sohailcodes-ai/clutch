import { eq } from 'drizzle-orm'
import { createDb, closeDb, schema } from './client.js'
import {
  DEFAULT_RATING,
  PLACEMENT_MATCHES,
  SEASON_DECAY_AFTER_DAYS,
  SEASON_SOFT_RESET_FACTOR,
  DIFFICULTY_LADDER,
  STACK_CATALOG,
} from '@clutch/shared'

async function main() {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL is required')

  const db = createDb(url)

  // All architecturally supported stacks are provisioned as DATA. Question
  // support per stack is granted separately (question_stack_support), so a
  // stack without evaluable content can never enter a match.
  for (const row of STACK_CATALOG) {
    await db.insert(schema.stacks).values({ ...row }).onConflictDoUpdate({
      target: schema.stacks.id,
      set: { name: row.name, symbol: row.symbol, judgeRuntime: row.judgeRuntime },
    })
  }

  const tierRows = [
    { id: 'bronze', minRating: 0, maxRating: 999, sortOrder: 1 },
    { id: 'silver', minRating: 1000, maxRating: 1399, sortOrder: 2 },
    { id: 'gold', minRating: 1400, maxRating: 1799, sortOrder: 3 },
    { id: 'platinum', minRating: 1800, maxRating: 2199, sortOrder: 4 },
    { id: 'diamond', minRating: 2200, maxRating: 2599, sortOrder: 5 },
    { id: 'master', minRating: 2600, maxRating: null, sortOrder: 6 },
  ]

  for (const row of tierRows) {
    await db.insert(schema.rankTiers).values(row).onConflictDoNothing()
  }

  const difficultyRows = DIFFICULTY_LADDER.map((d, i) => ({
    id: d.id,
    minRating: d.minRating,
    maxRating: d.maxRating,
    sortOrder: i + 1,
  }))

  for (const row of difficultyRows) {
    await db.insert(schema.difficultyBands).values(row).onConflictDoUpdate({
      target: schema.difficultyBands.id,
      set: { minRating: row.minRating, maxRating: row.maxRating, sortOrder: row.sortOrder },
    })
  }

  // ------------------------------------------------------------------
  // Topic catalog — relational taxonomy (topics/question_topics).
  // Cross-stack topics carry stackId = null.
  // ------------------------------------------------------------------
  const TOPIC_CATALOG: {
    slug: string
    label: string
    stacks: readonly string[] | null // null = cross-stack
  }[] = [
    { slug: 'algorithms', label: 'Algorithms', stacks: null },
    { slug: 'data-structures', label: 'Data Structures', stacks: null },
    { slug: 'variables', label: 'Variables', stacks: ['python', 'javascript', 'typescript', 'cpp', 'java', 'csharp', 'go', 'rust', 'php', 'kotlin', 'swift', 'c'] },
    { slug: 'conditions', label: 'Conditions', stacks: ['python', 'javascript', 'typescript', 'cpp', 'java', 'csharp', 'go', 'rust', 'php', 'kotlin', 'swift', 'c'] },
    { slug: 'loops', label: 'Loops', stacks: ['python', 'javascript', 'typescript', 'cpp', 'java', 'csharp', 'go', 'rust', 'php', 'kotlin', 'swift', 'c'] },
    { slug: 'functions', label: 'Functions', stacks: ['python', 'javascript', 'typescript', 'cpp', 'java', 'csharp', 'go', 'rust', 'php', 'kotlin', 'swift', 'sql'] },
    { slug: 'strings', label: 'Strings', stacks: ['python', 'javascript', 'typescript', 'cpp', 'java', 'csharp', 'go', 'rust', 'php', 'kotlin', 'swift', 'c'] },
    { slug: 'input-output', label: 'Input & Output', stacks: ['python', 'javascript', 'typescript', 'cpp', 'java', 'csharp', 'go', 'php'] },
    { slug: 'lists', label: 'Lists', stacks: ['python'] },
    { slug: 'dictionaries', label: 'Dictionaries', stacks: ['python'] },
    { slug: 'arrays', label: 'Arrays', stacks: ['javascript', 'typescript', 'cpp', 'java', 'csharp', 'go', 'swift', 'c'] },
    { slug: 'objects', label: 'Objects', stacks: ['javascript', 'typescript'] },
    { slug: 'async', label: 'Async', stacks: ['javascript', 'typescript'] },
    { slug: 'pointers', label: 'Pointers', stacks: ['cpp', 'c'] },
    { slug: 'memory', label: 'Memory Management', stacks: ['cpp', 'c', 'rust'] },
    { slug: 'stl', label: 'STL', stacks: ['cpp'] },
    { slug: 'queries', label: 'Queries', stacks: ['sql'] },
  ]

  const allStackRows = await db.select().from(schema.stacks)
  for (const t of TOPIC_CATALOG) {
    if (t.stacks === null) {
      await db
        .insert(schema.topics)
        .values({ slug: t.slug, label: t.label, stackId: null })
        .onConflictDoNothing()
    } else {
      for (const stackId of t.stacks) {
        if (!allStackRows.some((s) => s.id === stackId)) continue
        await db
          .insert(schema.topics)
          .values({ slug: t.slug, label: t.label, stackId })
          .onConflictDoNothing()
      }
    }
  }

  // ------------------------------------------------------------------
  // Clutch-original starter curriculum (data-driven; no third-party content)
  // ------------------------------------------------------------------
  const starterQuestions = [
    {
      slug: 'sum-two-numbers',
      title: 'Sum Two Numbers',
      topic: 'variables',
      tags: ['basics', 'arithmetic'],
      difficultyId: 'rookie',
      promptMd:
        '# Sum Two Numbers\n\nRead two integers from input (one per line) and print their sum.',
      examples: [{ input: '3\n4', output: '7', explanation: '3 + 4 = 7' }],
      testCases: [
        { visibility: 'public' as const, input: '3\n4', expectedOutput: '7', weight: 1 },
        { visibility: 'public' as const, input: '-5\n5', expectedOutput: '0', weight: 1 },
        { visibility: 'hidden' as const, input: '100\n250', expectedOutput: '350', weight: 2 },
        { visibility: 'hidden' as const, input: '0\n0', expectedOutput: '0', weight: 1 },
      ],
    },
    {
      slug: 'greet-by-name',
      title: 'Greet By Name',
      topic: 'input-output',
      tags: ['basics', 'strings'],
      difficultyId: 'rookie',
      promptMd:
        '# Greet By Name\n\nRead a name from input and print `Hello, <name>!` exactly.',
      examples: [{ input: 'Ada', output: 'Hello, Ada!', explanation: undefined }],
      testCases: [
        { visibility: 'public' as const, input: 'Ada', expectedOutput: 'Hello, Ada!', weight: 1 },
        { visibility: 'hidden' as const, input: 'Grace', expectedOutput: 'Hello, Grace!', weight: 1 },
        { visibility: 'hidden' as const, input: 'Linus', expectedOutput: 'Hello, Linus!', weight: 2 },
      ],
    },
    {
      slug: 'even-or-odd',
      title: 'Even or Odd',
      topic: 'conditions',
      tags: ['basics', 'modulo'],
      difficultyId: 'rookie',
      promptMd: '# Even or Odd\n\nRead an integer. Print `even` if it is even, otherwise `odd`.',
      examples: [{ input: '10', output: 'even', explanation: undefined }],
      testCases: [
        { visibility: 'public' as const, input: '10', expectedOutput: 'even', weight: 1 },
        { visibility: 'public' as const, input: '7', expectedOutput: 'odd', weight: 1 },
        { visibility: 'hidden' as const, input: '-4', expectedOutput: 'even', weight: 2 },
        { visibility: 'hidden' as const, input: '999999999', expectedOutput: 'odd', weight: 1 },
      ],
    },
    {
      slug: 'countdown-sum',
      title: 'Countdown Sum',
      topic: 'loops',
      tags: ['basics', 'loops'],
      difficultyId: 'starter',
      promptMd:
        '# Countdown Sum\n\nRead an integer n (0 <= n <= 1000). Print the sum of all integers from 1 to n. If n is 0, print 0.',
      examples: [{ input: '5', output: '15', explanation: '1+2+3+4+5 = 15' }],
      testCases: [
        { visibility: 'public' as const, input: '5', expectedOutput: '15', weight: 1 },
        { visibility: 'hidden' as const, input: '0', expectedOutput: '0', weight: 1 },
        { visibility: 'hidden' as const, input: '100', expectedOutput: '5050', weight: 2 },
        { visibility: 'hidden' as const, input: '1', expectedOutput: '1', weight: 1 },
      ],
    },
    {
      slug: 'reverse-a-string',
      title: 'Reverse A String',
      topic: 'strings',
      tags: ['strings'],
      difficultyId: 'beginner',
      promptMd: '# Reverse A String\n\nRead one line of text and print it reversed.',
      examples: [{ input: 'clutch', output: 'hctulc', explanation: undefined }],
      testCases: [
        { visibility: 'public' as const, input: 'clutch', expectedOutput: 'hctulc', weight: 1 },
        { visibility: 'hidden' as const, input: 'a', expectedOutput: 'a', weight: 1 },
        { visibility: 'hidden' as const, input: 'racecar', expectedOutput: 'racecar', weight: 2 },
      ],
    },
    {
      slug: 'list-max-and-min',
      title: 'List Max And Min',
      topic: 'lists',
      tags: ['arrays'],
      difficultyId: 'beginner',
      promptMd:
        '# List Max And Min\n\nThe first line contains n. The second line contains n integers separated by spaces. Print the maximum, then the minimum, each on its own line.',
      examples: [{ input: '4\n3 9 -1 5', output: '9\n-1', explanation: undefined }],
      testCases: [
        { visibility: 'public' as const, input: '4\n3 9 -1 5', expectedOutput: '9\n-1', weight: 1 },
        { visibility: 'hidden' as const, input: '1\n42', expectedOutput: '42\n42', weight: 1 },
        {
          visibility: 'hidden' as const,
          input: '6\n10 20 30 40 50 60',
          expectedOutput: '60\n10',
          weight: 2,
        },
      ],
    },
    {
      slug: 'word-frequency-count',
      title: 'Word Frequency Count',
      topic: 'dictionaries',
      tags: ['maps', 'strings'],
      difficultyId: 'easy',
      promptMd:
        "# Word Frequency Count\n\nRead one line of space-separated words. For each distinct word (in first-appearance order), print `<word> <count>` on its own line.",
      examples: [{ input: 'go go clutch now', output: 'go 2\nclutch 1\nnow 1', explanation: undefined }],
      testCases: [
        {
          visibility: 'public' as const,
          input: 'go go clutch now',
          expectedOutput: 'go 2\nclutch 1\nnow 1',
          weight: 1,
        },
        {
          visibility: 'hidden' as const,
          input: 'a b a b c',
          expectedOutput: 'a 2\nb 2\nc 1',
          weight: 2,
        },
        {
          visibility: 'hidden' as const,
          input: 'solo',
          expectedOutput: 'solo 1',
          weight: 1,
        },
      ],
    },
    {
      slug: 'fizzbuzz-clutch',
      title: 'FizzBuzz, Clutch Edition',
      topic: 'functions',
      tags: ['classic', 'loops', 'conditions'],
      difficultyId: 'easy',
      promptMd:
        '# FizzBuzz, Clutch Edition\n\nRead integer n. Print numbers 1..n, replacing multiples of 3 with `Fizz`, multiples of 5 with `Buzz`, and both with `FizzBuzz`. One per line.',
      examples: [{ input: '5', output: '1\n2\nFizz\n4\nBuzz', explanation: undefined }],
      testCases: [
        { visibility: 'public' as const, input: '5', expectedOutput: '1\n2\nFizz\n4\nBuzz', weight: 1 },
        {
          visibility: 'hidden' as const,
          input: '15',
          expectedOutput:
            '1\n2\nFizz\n4\nBuzz\nFizz\n7\n8\nFizz\nBuzz\n11\nFizz\n13\n14\nFizzBuzz',
          weight: 3,
        },
      ],
    },
    {
      slug: 'binary-search-basic',
      title: 'Binary Search Basics',
      topic: 'algorithms',
      tags: ['searching', 'arrays'],
      difficultyId: 'medium',
      promptMd:
        '# Binary Search Basics\n\nFirst line: target t. Second line: sorted list of distinct integers. Print the 0-based index of t, or -1 if absent.',
      examples: [{ input: '7\n1 3 5 7 9', output: '3', explanation: undefined }],
      testCases: [
        { visibility: 'public' as const, input: '7\n1 3 5 7 9', expectedOutput: '3', weight: 1 },
        { visibility: 'hidden' as const, input: '4\n1 3 5 7 9', expectedOutput: '-1', weight: 2 },
        { visibility: 'hidden' as const, input: '1\n1 3 5', expectedOutput: '0', weight: 1 },
        { visibility: 'hidden' as const, input: '5\n1 3 5', expectedOutput: '2', weight: 1 },
      ],
    },
    {
      slug: 'count-vowels',
      title: 'Count The Vowels',
      topic: 'strings',
      tags: ['basics', 'strings'],
      difficultyId: 'rookie',
      promptMd:
        '# Count The Vowels\n\nRead one line of text and print how many vowels (a, e, i, o, u) it contains. Case does not matter.',
      examples: [{ input: 'Clutch Arena', output: '4', explanation: 'u, A, a, e' }],
      testCases: [
        { visibility: 'public' as const, input: 'Clutch Arena', expectedOutput: '4', weight: 1 },
        { visibility: 'hidden' as const, input: 'rhythm', expectedOutput: '0', weight: 2 },
        { visibility: 'hidden' as const, input: 'AEIOUaeiou', expectedOutput: '10', weight: 1 },
        { visibility: 'hidden' as const, input: '', expectedOutput: '0', weight: 1 },
      ],
    },
    {
      slug: 'grade-classifier',
      title: 'Grade Classifier',
      topic: 'conditions',
      tags: ['basics', 'conditions'],
      difficultyId: 'starter',
      promptMd:
        '# Grade Classifier\n\nRead an integer score 0..100 and print the letter grade:\n- 90 or above: `A`\n- 80..89: `B`\n- 70..79: `C`\n- 60..69: `D`\n- below 60: `F`',
      examples: [{ input: '83', output: 'B', explanation: undefined }],
      testCases: [
        { visibility: 'public' as const, input: '83', expectedOutput: 'B', weight: 1 },
        { visibility: 'hidden' as const, input: '90', expectedOutput: 'A', weight: 1 },
        { visibility: 'hidden' as const, input: '59', expectedOutput: 'F', weight: 1 },
        { visibility: 'hidden' as const, input: '60', expectedOutput: 'D', weight: 2 },
        { visibility: 'hidden' as const, input: '0', expectedOutput: 'F', weight: 1 },
      ],
    },
    {
      slug: 'multiplication-row',
      title: 'Multiplication Row',
      topic: 'loops',
      tags: ['basics', 'loops'],
      difficultyId: 'beginner',
      promptMd:
        '# Multiplication Row\n\nRead integers n and k (one per line). Print n×1, n×2, ... n×k, each followed by a newline. Use plain integer output separated by single spaces.',
      examples: [{ input: '3\n4', output: '3 6 9 12', explanation: undefined }],
      testCases: [
        { visibility: 'public' as const, input: '3\n4', expectedOutput: '3 6 9 12', weight: 1 },
        { visibility: 'hidden' as const, input: '7\n1', expectedOutput: '7', weight: 1 },
        { visibility: 'hidden' as const, input: '-2\n3', expectedOutput: '-2 -4 -6', weight: 2 },
      ],
    },
    {
      slug: 'second-largest',
      title: 'Second Largest',
      topic: 'lists',
      tags: ['arrays', 'algorithms'],
      difficultyId: 'easy',
      promptMd:
        '# Second Largest\n\nThe first line contains n (at least 2). The second line contains n distinct integers. Print the second largest value.',
      examples: [{ input: '5\n4 9 1 22 8', output: '9', explanation: undefined }],
      testCases: [
        { visibility: 'public' as const, input: '5\n4 9 1 22 8', expectedOutput: '9', weight: 1 },
        { visibility: 'hidden' as const, input: '2\n10 20', expectedOutput: '10', weight: 2 },
        { visibility: 'hidden' as const, input: '3\n-5 -2 -9', expectedOutput: '-5', weight: 2 },
      ],
    },
    {
      slug: 'palindrome-check',
      title: 'Palindrome Check',
      topic: 'strings',
      tags: ['two-pointer', 'strings'],
      difficultyId: 'medium',
      promptMd:
        '# Palindrome Check\n\nRead one word and print `yes` if it reads the same forwards and backwards, otherwise `no`.',
      examples: [{ input: 'level', output: 'yes', explanation: undefined }],
      testCases: [
        { visibility: 'public' as const, input: 'level', expectedOutput: 'yes', weight: 1 },
        { visibility: 'hidden' as const, input: 'clutch', expectedOutput: 'no', weight: 1 },
        { visibility: 'hidden' as const, input: 'x', expectedOutput: 'yes', weight: 1 },
        { visibility: 'hidden' as const, input: 'abba', expectedOutput: 'yes', weight: 2 },
      ],
    },
    {
      slug: 'balanced-parens',
      title: 'Balanced Parentheses',
      topic: 'data-structures',
      tags: ['stack', 'classic'],
      difficultyId: 'hard',
      promptMd:
        '# Balanced Parentheses\n\nRead one line consisting only of `(`, `)`, `[`, `]`, `{`, `}`. Print `balanced` if every bracket opens and closes correctly and in the right order, else print `unbalanced`. An empty line counts as balanced.',
      examples: [{ input: '{[()]}', output: 'balanced', explanation: undefined }],
      testCases: [
        { visibility: 'public' as const, input: '{[()]}', expectedOutput: 'balanced', weight: 1 },
        { visibility: 'hidden' as const, input: '([)]', expectedOutput: 'unbalanced', weight: 2 },
        { visibility: 'hidden' as const, input: '(((', expectedOutput: 'unbalanced', weight: 1 },
        { visibility: 'hidden' as const, input: '', expectedOutput: 'balanced', weight: 2 },
        { visibility: 'hidden' as const, input: '(){[]}()', expectedOutput: 'balanced', weight: 2 },
      ],
    },
  ]

  for (const q of starterQuestions) {
    const [question] = await db
      .insert(schema.questions)
      .values({
        slug: q.slug,
        title: q.title,
        descriptionMd: null,
        difficultyId: q.difficultyId,
        topic: q.topic,
        tags: q.tags,
        source: 'clutch-original',
        status: 'published',
      })
      .onConflictDoNothing()
      .returning()

    const existing = question ?? (await db.query.questions.findFirst({ where: eq(schema.questions.slug, q.slug) }))
    if (!existing) continue

    const [version] = await db
      .insert(schema.questionVersions)
      .values({
        questionId: existing.id,
        version: 1,
        promptMd: q.promptMd,
        examples: q.examples.filter((e) => e.explanation !== undefined),
        starterCode: {},
        publishedAt: new Date(),
      })
      .onConflictDoNothing()
      .returning()

    if (!version) continue

    const supportedStacks = ['typescript', 'python', 'javascript']
    for (const stackId of supportedStacks) {
      await db
        .insert(schema.questionStackSupport)
        .values({ questionId: existing.id, stackId })
        .onConflictDoNothing()
    }

    // Link the question into the relational topic catalog (cross-stack rows
    // first, then per-stack rows).
    const topicRows = await db.select().from(schema.topics)
    for (const t of TOPIC_CATALOG.filter((c) => c.slug === q.topic)) {
      const candidates = topicRows.filter(
        (row) => row.slug === t.slug && (t.stacks === null ? row.stackId === null : true),
      )
      for (const candidate of candidates) {
        await db
          .insert(schema.questionTopics)
          .values({ questionId: existing.id, topicId: candidate.id })
          .onConflictDoNothing()
      }
    }

    for (const [i, test] of q.testCases.entries()) {
      await db.insert(schema.testCases).values({
        questionVersionId: version.id,
        ordinal: i + 1,
        ...test,
      }).onConflictDoNothing()
    }
  }

  // ------------------------------------------------------------------
  // Competitive title catalog — unlock conditions are deterministic and
  // evaluated server-side (see domain/titles). Rarity is display metadata;
  // secrets hide their condition until unlocked.
  // ------------------------------------------------------------------
  const titleRows = [
    // === PROGRESSION ===
    { code: 'on_the_board', name: 'On The Board', description: 'Complete your first ranked match.', kind: 'badge', rarity: 'common' as const, isSecret: false, sortOrder: 1, criteria: { type: 'matches', value: 1 } },
    { code: 'veteran', name: 'Veteran', description: 'Complete 100 ranked matches.', kind: 'title', rarity: 'epic' as const, isSecret: false, sortOrder: 13, criteria: { type: 'matches', value: 100 } },
    { code: 'high_volume', name: 'Executioner', description: 'Win 100 ranked matches.', kind: 'title', rarity: 'legendary' as const, isSecret: false, sortOrder: 30, criteria: { type: 'high_volume_wins', value: 100 } },

    // === PERFORMANCE ===
    { code: 'first_blood', name: 'First Blood', description: 'Win a judged match without letting your opponent pass a single test.', kind: 'badge', rarity: 'uncommon' as const, isSecret: false, sortOrder: 2, criteria: { type: 'first_blood' } },
    { code: 'problem_solver', name: 'Problem Slayer', description: 'Solve 50 unique questions.', kind: 'title', rarity: 'epic' as const, isSecret: false, sortOrder: 3, criteria: { type: 'unique_solved', value: 50 } },
    { code: 'clean_sweep', name: 'Clean Sweep', description: 'Win 10 matches where every test passes on your final submission.', kind: 'title', rarity: 'rare' as const, isSecret: false, sortOrder: 20, criteria: { type: 'clean_sweeps', value: 10 } },
    { code: 'perfect_form', name: 'Perfect Form', description: 'Win 20 matches with a perfect first-try submission.', kind: 'title', rarity: 'epic' as const, isSecret: false, sortOrder: 21, criteria: { type: 'perfect_execution', value: 20 } },

    // === STREAKS ===
    { code: 'hot_streak', name: 'Hot Streak', description: 'Win 5 ranked matches in a row.', kind: 'title', rarity: 'rare' as const, isSecret: false, sortOrder: 4, criteria: { type: 'win_streak', value: 5 } },
    { code: 'unbroken', name: 'Unbroken', description: 'Win 10 ranked matches in a row.', kind: 'title', rarity: 'epic' as const, isSecret: false, sortOrder: 5, criteria: { type: 'win_streak', value: 10 } },
    { code: 'untouchable', name: 'Untouchable', description: 'Maintain an exceptional win streak.', kind: 'title', rarity: 'legendary' as const, isSecret: true, sortOrder: 6, criteria: { type: 'win_streak', value: 20 } },

    // === CLUTCH / PRESSURE ===
    { code: 'clutch_comeback', name: 'Clutch', description: 'Win a match after being significantly behind.', kind: 'title', rarity: 'rare' as const, isSecret: true, sortOrder: 7, criteria: { type: 'comeback' } },
    { code: 'cold_blooded', name: 'Cold Blooded', description: 'Win 3 consecutive comeback victories.', kind: 'title', rarity: 'epic' as const, isSecret: true, sortOrder: 22, criteria: { type: 'comeback_streak', value: 3 } },

    // === SPEED ===
    { code: 'speed_demon', name: 'Speed Demon', description: 'Land a fully-accepted solve in under 60 seconds.', kind: 'badge', rarity: 'rare' as const, isSecret: true, sortOrder: 8, criteria: { type: 'fast_win', value: 60000 } },
    { code: 'code_phantom', name: 'Code Phantom', description: '???', kind: 'title', rarity: 'legendary' as const, isSecret: true, sortOrder: 9, criteria: { type: 'first_blood_fast', value: 60000 } },

    // === ADAPTATION ===
    { code: 'polyglot', name: 'Polyglot', description: 'Win ranked matches in 3 different stacks.', kind: 'title', rarity: 'rare' as const, isSecret: false, sortOrder: 10, criteria: { type: 'stacks_won', value: 3 } },
    { code: 'architect', name: 'Architect', description: 'Demonstrate strong performance across 5 different stacks.', kind: 'title', rarity: 'epic' as const, isSecret: false, sortOrder: 11, criteria: { type: 'stacks_won', value: 5 } },
    { code: 'adaptive', name: 'Adaptive', description: 'Solve questions across 3 difficulty levels.', kind: 'title', rarity: 'rare' as const, isSecret: false, sortOrder: 12, criteria: { type: 'difficulty_climb', value: 3 } },

    // === UNDERDOG ===
    { code: 'underdog', name: 'Underdog', description: 'Defeat 5 opponents rated 200+ points above you.', kind: 'title', rarity: 'rare' as const, isSecret: false, sortOrder: 23, criteria: { type: 'underdog_wins', value: 5 } },
    { code: 'predator', name: 'Predator', description: 'Defeat 15 opponents rated 200+ points above you.', kind: 'title', rarity: 'legendary' as const, isSecret: true, sortOrder: 24, criteria: { type: 'underdog_wins', value: 15 } },

    // === RATING ===
    { code: 'rising', name: 'Rising', description: 'Win 10 matches.', kind: 'badge', rarity: 'common' as const, isSecret: false, sortOrder: 14, criteria: { type: 'wins', value: 10 } },
    { code: 'top_100', name: 'Top 100', description: 'Reach the global top 100.', kind: 'title', rarity: 'rare' as const, isSecret: false, sortOrder: 15, criteria: { type: 'top_rank', value: 100 } },
    { code: 'top_20', name: 'Top 20', description: 'Reach the global top 20.', kind: 'title', rarity: 'epic' as const, isSecret: false, sortOrder: 16, criteria: { type: 'top_rank', value: 20 } },
    { code: 'diamond_tier', name: 'Diamond Tier', description: 'Reach a peak rating of 2200 in any stack.', kind: 'title', rarity: 'epic' as const, isSecret: false, sortOrder: 17, criteria: { type: 'rating', value: 2200 } },
    { code: 'clutch_master', name: 'CLUTCH', description: 'Reach a peak rating of 2400 in any stack — the highest competitive achievement.', kind: 'title', rarity: 'legendary' as const, isSecret: false, sortOrder: 18, criteria: { type: 'rating', value: 2400 } },

    // === NO-SUBMIT ===
    { code: 'no_submit_wins', name: 'Ghost', description: 'Win 5 matches where your opponent never submitted.', kind: 'title', rarity: 'uncommon' as const, isSecret: false, sortOrder: 25, criteria: { type: 'no_submit_wins', value: 5 } },

    // === HIDDEN ===
    { code: 'singularity', name: 'Singularity', description: 'Some things are better discovered.', kind: 'title', rarity: 'legendary' as const, isSecret: true, sortOrder: 26, criteria: { type: 'unique_solved', value: 100 } },
  ]

  for (const row of titleRows) {
    await db.insert(schema.titles).values(row).onConflictDoUpdate({
      target: schema.titles.code,
      set: {
        name: row.name,
        description: row.description,
        kind: row.kind,
        rarity: row.rarity,
        isSecret: row.isSecret,
        sortOrder: row.sortOrder,
        criteria: row.criteria,
      },
    })
  }

  const now = new Date()
  const seasonEnd = new Date(now)
  seasonEnd.setDate(seasonEnd.getDate() + 90)

  const [season] = await db
    .insert(schema.seasons)
    .values({
      number: 4,
      name: 'Season 04',
      title: 'Pressure Ledger',
      startsAt: now,
      endsAt: seasonEnd,
      status: 'active',
      softResetFactor: String(SEASON_SOFT_RESET_FACTOR),
      decayAfterDays: SEASON_DECAY_AFTER_DAYS,
      placementMatches: PLACEMENT_MATCHES,
    })
    .onConflictDoNothing()
    .returning()

  const activeSeason =
    season ??
    (await db.query.seasons.findFirst({ where: eq(schema.seasons.status, 'active') }))

  if (!activeSeason) throw new Error('Failed to seed active season')

  const questionSeed = {
    slug: 'streaming-median-under-churn',
    title: 'Streaming Median Under Churn',
    difficultyId: 'medium',
    timeLimitSec: 900,
    memoryLimitMb: 256,
    status: 'published' as const,
  }

  const [question] = await db
    .insert(schema.questions)
    .values(questionSeed)
    .onConflictDoNothing()
    .returning()

  const existingQuestion =
    question ??
    (await db.query.questions.findFirst({
      where: eq(schema.questions.slug, questionSeed.slug),
    }))

  if (existingQuestion) {
    const [version] = await db
      .insert(schema.questionVersions)
      .values({
        questionId: existingQuestion.id,
        version: 1,
        promptMd:
          '# Streaming Median Under Churn\n\nImplement a function that maintains the median of a stream of integers as values are added and removed.',
        starterCode: {
          typescript:
            'export function solve(input: string): string {\n  // TODO\n  return ""\n}\n',
          python: 'def solve(input: str) -> str:\n    # TODO\n    return ""\n',
        },
        publishedAt: now,
      })
      .onConflictDoNothing()
      .returning()

    const qv =
      version ??
      (await db.query.questionVersions.findFirst({
        where: eq(schema.questionVersions.questionId, existingQuestion.id),
      }))

    if (qv) {
      for (const stackId of ['typescript', 'python', 'rust', 'cpp', 'go', 'java']) {
        await db
          .insert(schema.questionStackSupport)
          .values({ questionId: existingQuestion.id, stackId })
          .onConflictDoNothing()
      }

      const tests = [
        { visibility: 'public' as const, input: '1\n2\n3', expectedOutput: '2', weight: 1 },
        { visibility: 'public' as const, input: '5\n1\n9', expectedOutput: '5', weight: 1 },
        { visibility: 'hidden' as const, input: '10\n20\n30\n-10', expectedOutput: '15', weight: 2 },
      ]

      for (const [i, test] of tests.entries()) {
        await db
          .insert(schema.testCases)
          .values({
            questionVersionId: qv.id,
            ordinal: i + 1,
            ...test,
          })
          .onConflictDoNothing()
      }
    }
  }

  // ------------------------------------------------------------------
  // Sample discovery content: one live-window event and one open-registration
  // tournament. Times are stored; phases are always derived from server time.
  // ------------------------------------------------------------------
  const hour = 60 * 60 * 1000
  const day = 24 * hour
  await db
    .insert(schema.events)
    .values({
      slug: 'weekend-code-rush',
      name: 'Weekend Code Rush',
      descriptionMd: 'Python-only sprint. Win as many judged duels as you can before the window closes.',
      rulesMd: 'Standard ranked rules. Only Python matches count toward standings.',
      startsAt: new Date(now.getTime() - hour),
      endsAt: new Date(now.getTime() + 2 * day),
      maxParticipants: null,
      rewardTitleIds: [],
      status: 'published',
    })
    .onConflictDoNothing()

  await db
    .insert(schema.eventStacks)
    .values({ eventId: (await db.query.events.findFirst({ where: eq(schema.events.slug, 'weekend-code-rush') }))!.id, stackId: 'python' })
    .onConflictDoNothing()
  await db
    .insert(schema.eventDifficultyLevels)
    .values({ eventId: (await db.query.events.findFirst({ where: eq(schema.events.slug, 'weekend-code-rush') }))!.id, difficultyId: 'rookie' })
    .onConflictDoNothing()

  await db
    .insert(schema.tournaments)
    .values({
      slug: 'clutch-open-01',
      name: 'Clutch Open #01',
      descriptionMd: 'The first official Clutch Open. Single elimination, TypeScript bracket.',
      format: 'single_elimination',
      seasonId: activeSeason.id,
      stackId: 'typescript',
      maxParticipants: 128,
      registrationOpensAt: now,
      registrationClosesAt: new Date(now.getTime() + 3 * day),
      startsAt: new Date(now.getTime() + 4 * day),
      status: 'registration_open',
    })
    .onConflictDoNothing()

  console.log('Seed completed', { seasonId: activeSeason.id, defaultRating: DEFAULT_RATING })
  await closeDb()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
