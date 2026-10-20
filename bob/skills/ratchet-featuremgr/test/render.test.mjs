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
    archMerged: null,
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
  assert.match(content, /\| \[Alpha\]\(features\/a\/feature\.md\) \| proposal, plan \| 1\/3 \| — \| 2026-06-01 \|/)
  assert.match(content, /\| \[Beta\]\(features\/b\/feature\.md\) \| proposal \| — \| — \| 2026-06-01 \|/)
  assert.match(content, /Arch Merged/)
  assert.deepEqual(summary, ['  draft: 1', '  active: 1'])
})

test('renderIndex: empty feature set renders only the header', () => {
  const { content, summary } = renderIndex([])
  assert.match(content, /^# Features Index/)
  assert.equal(summary.length, 0)
  assert.doesNotMatch(content, /## /)
})

test('renderIndex: arch-merged date shown when archMerged is set', () => {
  const features = [feat({ archMerged: '2026-07-22' })]
  const { content } = renderIndex(features)
  assert.match(content, /\| 2026-07-22 \|/)
})

test('renderIndex: dash shown when archMerged is null', () => {
  const features = [feat()]
  const { content } = renderIndex(features)
  // The Arch Merged column should contain — (not a date)
  assert.match(content, /\| — \| 2026-06-01 \|/)
})
