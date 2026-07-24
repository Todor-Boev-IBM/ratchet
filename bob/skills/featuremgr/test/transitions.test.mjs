// test/transitions.test.mjs
//
// Unit tests for the status state machine (lib/transitions.mjs), calling
// evaluateTransition directly — no CLI, no subprocess.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { evaluateTransition, currentStatus } from '../lib/transitions.mjs'

function fixture(files) {
  const docs = mkdtempSync(join(tmpdir(), 'featuremgr-trans-'))
  const dir = join(docs, 'features', 'feat')
  mkdirSync(dir, { recursive: true })
  for (const [name, body] of Object.entries(files)) writeFileSync(join(dir, name), body)
  return docs
}

const feature = status => `---\ntitle: Feat\nstatus: ${status}\n---\n`
const phases = (...marks) => '## Phases\n\n' + marks.map((m, i) => `### Phase ${i + 1}${m ? ' ' + m : ''}\n`).join('')

test('currentStatus: null when feature.md missing', () => {
  const docs = mkdtempSync(join(tmpdir(), 'featuremgr-trans-'))
  assert.equal(currentStatus(docs, 'feat'), null)
  rmSync(docs, { recursive: true, force: true })
})

test('reject: no feature.md / no status', () => {
  const docs = mkdtempSync(join(tmpdir(), 'featuremgr-trans-'))
  mkdirSync(join(docs, 'features', 'feat'), { recursive: true })
  const d = evaluateTransition(docs, 'feat', 'active')
  assert.equal(d.action, 'reject')
  assert.match(d.error, /not found or has no status/)
  rmSync(docs, { recursive: true, force: true })
})

test('noop: same status', () => {
  const docs = fixture({ 'feature.md': feature('draft') })
  assert.deepEqual(evaluateTransition(docs, 'feat', 'draft'), { action: 'noop', status: 'draft' })
  rmSync(docs, { recursive: true, force: true })
})

test('reject: terminal status is immutable', () => {
  const docs = fixture({ 'feature.md': feature('done') })
  const d = evaluateTransition(docs, 'feat', 'active')
  assert.equal(d.action, 'reject')
  assert.match(d.error, /terminal status 'done'/)
  rmSync(docs, { recursive: true, force: true })
})

test('reject: invalid transition', () => {
  const docs = fixture({ 'feature.md': feature('active'), 'plan.md': phases('✅') })
  const d = evaluateTransition(docs, 'feat', 'done')
  assert.equal(d.action, 'reject')
  assert.match(d.error, /invalid transition active -> done/)
  rmSync(docs, { recursive: true, force: true })
})

test('reject: draft -> active without plan.md', () => {
  const docs = fixture({ 'feature.md': feature('draft') })
  const d = evaluateTransition(docs, 'feat', 'active')
  assert.equal(d.action, 'reject')
  assert.match(d.error, /precondition failed — plan\.md not found/)
  rmSync(docs, { recursive: true, force: true })
})

test('apply: draft -> active with ## Phases', () => {
  const docs = fixture({ 'feature.md': feature('draft'), 'plan.md': phases('') })
  assert.deepEqual(evaluateTransition(docs, 'feat', 'active'), { action: 'apply', from: 'draft', to: 'active' })
  rmSync(docs, { recursive: true, force: true })
})

test('reject: active -> in-review with unchecked phases', () => {
  const docs = fixture({ 'feature.md': feature('active'), 'plan.md': phases('✅', '') })
  const d = evaluateTransition(docs, 'feat', 'in-review')
  assert.equal(d.action, 'reject')
  assert.match(d.error, /plan not complete: 1\/2/)
  rmSync(docs, { recursive: true, force: true })
})

test('apply: active -> in-review when all phases ✅', () => {
  const docs = fixture({ 'feature.md': feature('active'), 'plan.md': phases('✅', '✅') })
  assert.deepEqual(evaluateTransition(docs, 'feat', 'in-review'), { action: 'apply', from: 'active', to: 'in-review' })
  rmSync(docs, { recursive: true, force: true })
})

test('apply: draft -> abandoned needs no precondition', () => {
  const docs = fixture({ 'feature.md': feature('draft') })
  assert.deepEqual(evaluateTransition(docs, 'feat', 'abandoned'), { action: 'apply', from: 'draft', to: 'abandoned' })
  rmSync(docs, { recursive: true, force: true })
})

test('apply: in-review -> done needs no precondition', () => {
  const docs = fixture({ 'feature.md': feature('in-review') })
  assert.deepEqual(evaluateTransition(docs, 'feat', 'done'), { action: 'apply', from: 'in-review', to: 'done' })
  rmSync(docs, { recursive: true, force: true })
})

test('apply: in-review -> abandoned needs no precondition', () => {
  const docs = fixture({ 'feature.md': feature('in-review') })
  assert.deepEqual(evaluateTransition(docs, 'feat', 'abandoned'), {
    action: 'apply',
    from: 'in-review',
    to: 'abandoned',
  })
  rmSync(docs, { recursive: true, force: true })
})
