export { rookieQuestions } from './rookie.js'
export { starterQuestions } from './starter.js'
export { beginnerQuestions } from './beginner.js'
export { easyQuestions } from './easy.js'
export { mediumQuestions } from './medium.js'
export { hardQuestions } from './hard.js'
export { advancedQuestions } from './advanced.js'
export { eliteQuestions } from './elite.js'
export { clutchQuestions } from './clutch.js'

import { rookieQuestions } from './rookie.js'
import { starterQuestions } from './starter.js'
import { beginnerQuestions } from './beginner.js'
import { easyQuestions } from './easy.js'
import { mediumQuestions } from './medium.js'
import { hardQuestions } from './hard.js'
import { advancedQuestions } from './advanced.js'
import { eliteQuestions } from './elite.js'
import { clutchQuestions } from './clutch.js'

export type QuestionBankEntry = {
  slug: string
  title: string
  topic: string
  tags: string[]
  difficultyId: string
  promptMd: string
  examples: { input: string; output: string; explanation?: string }[]
  testCases: {
    visibility: string
    input: string
    expectedOutput: string
    weight: number
  }[]
}

export const allQuestionBankQuestions = [
  ...rookieQuestions,
  ...starterQuestions,
  ...beginnerQuestions,
  ...easyQuestions,
  ...mediumQuestions,
  ...hardQuestions,
  ...advancedQuestions,
  ...eliteQuestions,
  ...clutchQuestions,
] as QuestionBankEntry[]
