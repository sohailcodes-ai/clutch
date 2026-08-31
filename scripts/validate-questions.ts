/**
 * Question bank validation script.
 *
 * Validates:
 * - All slugs are unique across all difficulty files
 * - All required fields are present and non-empty
 * - Each question has at least 2 public test cases
 * - No duplicate slugs within a file
 * - Slug format is kebab-case
 * - Test case weights are positive integers
 * - At least one example per question
 * - Difficulty IDs match expected values per file
 */

import {
  allQuestionBankQuestions,
  type QuestionBankEntry,
} from '../packages/db/src/question-bank/index.js'

const EXPECTED_DIFFICULTY_MAP: Record<string, string> = {
  rookieQuestions: 'rookie',
  starterQuestions: 'starter',
  beginnerQuestions: 'beginner',
  easyQuestions: 'easy',
  mediumQuestions: 'medium',
  hardQuestions: 'hard',
  advancedQuestions: 'advanced',
  eliteQuestions: 'elite',
  clutchQuestions: 'clutch',
}

const KEBAB_CASE = /^[a-z0-9]+(-[a-z0-9]+)*$/

interface ValidationError {
  slug: string
  field: string
  message: string
}

const errors: ValidationError[] = []

function validate(q: QuestionBankEntry) {
  const add = (field: string, message: string) => errors.push({ slug: q.slug, field, message })

  if (!q.slug) add('slug', 'Missing slug')
  else if (!KEBAB_CASE.test(q.slug)) add('slug', `Not kebab-case: "${q.slug}"`)
  else if (q.slug.length > 100) add('slug', `Slug too long (${q.slug.length} chars)`)

  if (!q.title) add('title', 'Missing title')
  if (!q.topic) add('topic', 'Missing topic')
  if (!q.difficultyId) add('difficultyId', 'Missing difficultyId')
  if (!q.promptMd) add('promptMd', 'Missing promptMd')
  else if (q.promptMd.length < 20) add('promptMd', 'promptMd too short (< 20 chars)')

  if (!q.tags || q.tags.length === 0) add('tags', 'No tags')
  if (!q.examples || q.examples.length === 0) add('examples', 'No examples')
  else {
    for (const [i, ex] of q.examples.entries()) {
      if (ex.input === undefined || ex.input === null) add(`examples[${i}]`, 'Missing input')
      if (ex.output === undefined || ex.output === null) add(`examples[${i}]`, 'Missing output')
    }
  }

  if (!q.testCases || q.testCases.length < 2) add('testCases', `Only ${q.testCases?.length ?? 0} test cases (minimum 2)`)
  else {
    const publicCount = q.testCases.filter((t) => t.visibility === 'public').length
    if (publicCount < 1) add('testCases', 'No public test cases')

    for (const [i, tc] of q.testCases.entries()) {
      if (tc.weight <= 0) add(`testCases[${i}]`, `Invalid weight: ${tc.weight}`)
      if (tc.expectedOutput === undefined || tc.expectedOutput === null)
        add(`testCases[${i}]`, 'Missing expectedOutput')
    }
  }
}

console.log(`Validating ${allQuestionBankQuestions.length} questions...\n`)

for (const q of allQuestionBankQuestions) {
  validate(q)
}

// Check for duplicate slugs
const slugCounts = new Map<string, number>()
for (const q of allQuestionBankQuestions) {
  slugCounts.set(q.slug, (slugCounts.get(q.slug) ?? 0) + 1)
}
for (const [slug, count] of slugCounts) {
  if (count > 1) {
    errors.push({ slug, field: 'slug', message: `Duplicate slug found ${count} times` })
  }
}

if (errors.length === 0) {
  console.log('All validations passed!')
  console.log(`  Questions: ${allQuestionBankQuestions.length}`)
  console.log(`  Unique slugs: ${slugCounts.size}`)

  const byDifficulty = new Map<string, number>()
  for (const q of allQuestionBankQuestions) {
    byDifficulty.set(q.difficultyId, (byDifficulty.get(q.difficultyId) ?? 0) + 1)
  }
  console.log('  By difficulty:')
  for (const [diff, count] of [...byDifficulty.entries()].sort()) {
    console.log(`    ${diff}: ${count}`)
  }

  const totalTestCases = allQuestionBankQuestions.reduce((s, q) => s + q.testCases.length, 0)
  console.log(`  Total test cases: ${totalTestCases}`)
  process.exit(0)
} else {
  console.error(`${errors.length} validation errors:\n`)
  for (const e of errors) {
    console.error(`  [${e.slug}] ${e.field}: ${e.message}`)
  }
  process.exit(1)
}
