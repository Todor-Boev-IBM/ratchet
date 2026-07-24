// test/commands.test.mjs
//
// Unit tests for the command layer. Because each command is now a pure function
// returning { code, stdout?, stderr? } (printing/exiting happens only at the
// entry point), these call the commands directly — no subprocess spawn, unlike
// cli.test.mjs. This is what the compute/print split in featuremgr.mjs buys.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { reindex, check, triage, cmdInit, cmdMark, dispatch } from '../featuremgr.mjs'

function buildFixture() {
  const docs = mkdtempSync(join(tmpdir(), 'featuremgr-cmd-'))
  const write = (slug, files) => {
    const dir = join(docs, 'features', slug)
    mkdirSync(dir, { recursive: true })
    for (const [name, body] of Object.entries(files)) writeFileSync(join(dir, name), body)
  }
  write('alpha', {
    'feature.md': '---\ntitle: Alpha\nstatus: active\n---\nAlpha purpose.\n',
    'plan.md': '## Phases\n\n### Phase 1: one ✅\n### Phase 2: two ✅\n',
  })
  write('beta', { 'feature.md': '---\ntitle: Beta\nstatus: draft\n---\nBeta purpose.\n', 'proposal.md': '# Beta\n' })
  return docs
}

test('reindex: returns code 0, writes index.md, reports counts', () => {
  const docs = buildFixture()
  const result = reindex(docs)
  assert.equal(result.code, 0)
  assert.ok(existsSync(join(docs, 'index.md')))
  assert.match(result.stdout[0], /reindex: 2 feature\(s\)/)
  rmSync(docs, { recursive: true, force: true })
})

test('check: clean fixture returns code 0', () => {
  const docs = buildFixture()
  const result = check(docs)
  assert.equal(result.code, 0)
  assert.match(result.stdout[0], /no problems/)
  rmSync(docs, { recursive: true, force: true })
})

test('check: missing artifacts returns code 1 with problems', () => {
  const docs = mkdtempSync(join(tmpdir(), 'featuremgr-cmd-'))
  mkdirSync(join(docs, 'features', 'lonely'), { recursive: true })
  writeFileSync(join(docs, 'features', 'lonely', 'feature.md'), '---\ntitle: Lonely\nstatus: draft\n---\n')
  const result = check(docs)
  assert.equal(result.code, 1)
  assert.ok(result.stdout.some(l => l.includes('no proposal.md or plan.md')))
  rmSync(docs, { recursive: true, force: true })
})

test('triage: returns code 0 and lists open features', () => {
  const docs = buildFixture()
  const result = triage(docs)
  assert.equal(result.code, 0)
  assert.match(result.stdout[0], /triage: 2 open feature\(s\)/)
  rmSync(docs, { recursive: true, force: true })
})

test('cmdInit: missing --title returns code 2', () => {
  const result = cmdInit(['gamma'], { docs: 'docs' })
  assert.equal(result.code, 2)
  assert.match(result.stderr[0], /--title is required/)
})

test('cmdInit: creates feature.md and returns code 0', () => {
  const docs = mkdtempSync(join(tmpdir(), 'featuremgr-cmd-'))
  const result = cmdInit(['gamma'], { docs, title: 'Gamma' })
  assert.equal(result.code, 0)
  const text = readFileSync(join(docs, 'features', 'gamma', 'feature.md'), 'utf8')
  assert.match(text, /status: draft/)
  rmSync(docs, { recursive: true, force: true })
})

test('cmdMark: valid transition patches status and returns code 0', () => {
  const docs = buildFixture()
  const result = cmdMark(['beta', 'abandoned'], { docs })
  assert.equal(result.code, 0)
  const text = readFileSync(join(docs, 'features', 'beta', 'feature.md'), 'utf8')
  assert.match(text, /status: abandoned/)
  rmSync(docs, { recursive: true, force: true })
})

test('cmdMark: invalid transition returns code 1 and leaves file unchanged', () => {
  const docs = buildFixture()
  const before = readFileSync(join(docs, 'features', 'beta', 'feature.md'), 'utf8')
  const result = cmdMark(['beta', 'done'], { docs })
  assert.equal(result.code, 1)
  assert.match(result.stderr[0], /invalid transition draft -> done/)
  assert.equal(readFileSync(join(docs, 'features', 'beta', 'feature.md'), 'utf8'), before)
  rmSync(docs, { recursive: true, force: true })
})

test('cmdMark: precondition failure (draft -> active without plan) returns code 1', () => {
  const docs = buildFixture()
  // beta is draft with only a proposal, no plan.md → checkPlanReady fails.
  const result = cmdMark(['beta', 'active'], { docs })
  assert.equal(result.code, 1)
  assert.match(result.stderr[0], /precondition failed/)
  rmSync(docs, { recursive: true, force: true })
})

test('dispatch: unknown command returns code 2 with usage', () => {
  const result = dispatch('bogus', [], { docs: 'docs' })
  assert.equal(result.code, 2)
  assert.match(result.stderr[0], /usage: featuremgr <init\|mark\|reindex\|check\|triage>/)
})
