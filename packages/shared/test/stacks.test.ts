import { describe, expect, it } from 'vitest'
import { STACK_CATALOG, STACK_IDS } from '@clutch/shared'

describe('STACK_CATALOG', () => {
  it('only contains Season 01 supported stacks', () => {
    const supportedIds = ['python', 'javascript', 'typescript', 'java', 'cpp', 'go', 'rust']
    expect(STACK_IDS.sort()).toEqual(supportedIds.sort())
  })

  it('does NOT contain unsupported stacks', () => {
    const unsupported = ['c', 'csharp', 'php', 'kotlin', 'swift', 'sql']
    for (const id of unsupported) {
      expect(STACK_IDS).not.toContain(id)
    }
  })

  it('each stack has required fields', () => {
    for (const stack of STACK_CATALOG) {
      expect(stack.id).toBeDefined()
      expect(stack.name).toBeDefined()
      expect(stack.symbol).toBeDefined()
      expect(stack.judgeRuntime).toBeDefined()
    }
  })
})
