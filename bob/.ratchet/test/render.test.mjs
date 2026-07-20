// test/render.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { renderIndex } from '../lib/render.mjs'

function feat(overrides = {}) {
  return {
    slug: 's',
    title: 'T',
    status: 'active',
    hasProposal: false,
    hasPlan: false,
    planCompletion: null,
    lastTouched: Date.parse('2026-06-01T00:00:00Z'),
    ...overrides,
  }
}

test('renderIndex: groups by status in INTENTS order with derived facts', () => {
  const features = [
    feat({ slug: 'b', title: 'Beta', status: 'draft', hasProposal: true }),
    feat({
      slug: 'a',
      title: 'Alpha',
      status: 'active',
      hasProposal: true,
      hasPlan: true,
      planCompletion: { checked: 1, total: 3 },
    }),
  ]
  const { content, summary } = renderIndex(features)

  // draft section renders before active (INTENTS order: draft, active, ...)
  // INTENTS = draft, active, done, abandoned -> draft heading precedes active
  assert.ok(content.indexOf('## draft (1)') < content.indexOf('## active (1)'))
  assert.match(content, /\| \[Alpha\]\(features\/a\/feature\.md\) \| proposal, plan \| 1\/3 \| 2026-06-01 \|/)
  assert.match(content, /\| \[Beta\]\(features\/b\/feature\.md\) \| proposal \| — \| 2026-06-01 \|/)
  assert.deepEqual(summary, ['  draft: 1', '  active: 1'])
})

test('renderIndex: empty feature set renders only the header', () => {
  const { content, summary } = renderIndex([])
  assert.match(content, /^# Docs Index/)
  assert.equal(summary.length, 0)
  assert.doesNotMatch(content, /## /)
})
