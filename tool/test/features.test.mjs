// test/features.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync, utimesSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  INTENTS,
  derivePlanCompletion,
  deriveLastTouched,
  loadFeatures,
  validateFeatures,
  triageView,
  ambientCounts,
} from '../lib/features.mjs'

const DAY_MS = 24 * 60 * 60 * 1000

// --- fixture helpers ---------------------------------------------------------

function tmpDocs() {
  return mkdtempSync(join(tmpdir(), 'docmgr-'))
}

function writeFeature(docsDir, slug, { feature, proposal, plan } = {}) {
  const dir = join(docsDir, 'features', slug)
  mkdirSync(dir, { recursive: true })
  if (feature !== null)
    writeFileSync(join(dir, 'feature.md'), feature ?? '---\ntitle: "T"\nintent: parked\n---\npurpose\n')
  if (proposal) writeFileSync(join(dir, 'proposal.md'), proposal)
  if (plan) writeFileSync(join(dir, 'plan.md'), plan)
  return dir
}

// A minimal feature object for the pure functions that operate on the shape.
function feat(overrides = {}) {
  return {
    slug: 's',
    hasFeatureFile: true,
    title: 'T',
    intent: 'parked',
    purpose: 'p',
    hasProposal: false,
    hasPlan: false,
    planCompletion: null,
    lastTouched: Date.now(),
    ...overrides,
  }
}

// --- derivePlanCompletion ----------------------------------------------------

test('derivePlanCompletion: no Phases section -> null', () => {
  assert.equal(derivePlanCompletion('# Plan\n\nsome text\n'), null)
})

test('derivePlanCompletion: Phases section with no phase headings -> null', () => {
  assert.equal(derivePlanCompletion('## Phases\n\njust prose, no phases\n'), null)
})

test('derivePlanCompletion: mixed done, in-progress, and not-started', () => {
  const body = '## Phases\n\n### Phase 1: A ✅ 2026-07-19\n\n### Phase 2: B ⏳\n\n### Phase 3: C\n'
  assert.deepEqual(derivePlanCompletion(body), { checked: 1, total: 3 })
})

test('derivePlanCompletion: all done', () => {
  const body = '## Phases\n\n### Phase 1: A ✅\n\n### Phase 2: B ✅ 2026-07-19\n'
  assert.deepEqual(derivePlanCompletion(body), { checked: 2, total: 2 })
})

test('derivePlanCompletion: ignores phases outside the Phases section', () => {
  const body =
    '## Intro\n\n### Phase 0: stray ✅\n\n## Phases\n\n### Phase 1: real ✅\n### Phase 2: real\n\n## Notes\n\n### Phase 9: stray ✅\n'
  assert.deepEqual(derivePlanCompletion(body), { checked: 1, total: 2 })
})

test('derivePlanCompletion: non-phase sub-headings inside Phases are not counted', () => {
  const body = '## Phases\n\n### Phase 1: A ✅\n\n### Notes\n\nsome note\n\n### Phase 2: B\n'
  assert.deepEqual(derivePlanCompletion(body), { checked: 1, total: 2 })
})

// --- deriveLastTouched -------------------------------------------------------

test('deriveLastTouched: newest mtime among files, recursively', () => {
  const docs = tmpDocs()
  const dir = writeFeature(docs, 'a', { plan: '## Phases\n\n### Phase 1: x\n' })
  const old = new Date('2020-01-01T00:00:00Z')
  const recent = new Date('2026-06-01T00:00:00Z')
  utimesSync(join(dir, 'feature.md'), old, old)
  utimesSync(join(dir, 'plan.md'), recent, recent)
  assert.equal(deriveLastTouched(dir), recent.getTime())
  rmSync(docs, { recursive: true, force: true })
})

// --- loadFeatures ------------------------------------------------------------

test('loadFeatures: parses intent, title, artifacts, completion', () => {
  const docs = tmpDocs()
  writeFeature(docs, 'alpha', {
    feature: '---\ntitle: "Alpha"\nintent: active\n---\nDo alpha.\n',
    proposal: '# Alpha proposal\n',
    plan: '## Phases\n\n### Phase 1: one ✅\n### Phase 2: two\n',
  })
  const [f] = loadFeatures(docs)
  assert.equal(f.slug, 'alpha')
  assert.equal(f.title, 'Alpha')
  assert.equal(f.intent, 'active')
  assert.equal(f.purpose, 'Do alpha.')
  assert.equal(f.hasProposal, true)
  assert.equal(f.hasPlan, true)
  assert.deepEqual(f.planCompletion, { checked: 1, total: 2 })
  rmSync(docs, { recursive: true, force: true })
})

test('loadFeatures: missing features dir -> []', () => {
  const docs = tmpDocs()
  assert.deepEqual(loadFeatures(docs), [])
  rmSync(docs, { recursive: true, force: true })
})

// --- validateFeatures --------------------------------------------------------

test('validateFeatures: clean feature yields no problems', () => {
  assert.deepEqual(validateFeatures([feat({ hasProposal: true })]), [])
})

test('validateFeatures: missing feature.md', () => {
  const problems = validateFeatures([feat({ hasFeatureFile: false, title: null, intent: null })])
  assert.deepEqual(problems, ['missing feature.md: features/s/'])
})

test('validateFeatures: no title and no intent', () => {
  const problems = validateFeatures([feat({ title: null, intent: null, hasProposal: true })])
  assert.ok(problems.includes('no title: features/s/feature.md'))
  assert.ok(problems.includes('no intent: features/s/feature.md'))
})

test('validateFeatures: invalid intent', () => {
  const problems = validateFeatures([feat({ intent: 'bogus', hasProposal: true })])
  assert.ok(problems.some(p => p.startsWith("invalid intent 'bogus'")))
})

test('validateFeatures: no artifacts', () => {
  const problems = validateFeatures([feat()])
  assert.ok(problems.includes('no proposal.md or plan.md: features/s/'))
})

test('validateFeatures: plan without Phases section warns', () => {
  const problems = validateFeatures([feat({ hasPlan: true, planCompletion: null })])
  assert.ok(problems.some(p => p.startsWith('warn: plan.md has no')))
})

// --- triageView --------------------------------------------------------------

test('triageView: open intents only, oldest-first, weekly bands', () => {
  const now = Date.now()
  const features = [
    feat({ slug: 'fresh', intent: 'active', lastTouched: now - 1 * DAY_MS }),
    feat({ slug: 'old', intent: 'parked', lastTouched: now - 20 * DAY_MS }),
    feat({ slug: 'mid', intent: 'active', lastTouched: now - 9 * DAY_MS }),
    feat({ slug: 'done', intent: 'done', lastTouched: now - 50 * DAY_MS }),
    feat({ slug: 'gone', intent: 'abandoned', lastTouched: now - 50 * DAY_MS }),
  ]
  const bands = triageView(features, now)
  // done + abandoned excluded
  const slugs = bands.flatMap(b => b.entries.map(e => e.feature.slug))
  assert.deepEqual(slugs, ['old', 'mid', 'fresh']) // oldest-first overall
  // banding: old -> band 2, mid -> band 1, fresh -> band 0
  assert.deepEqual(
    bands.map(b => b.bandIndex),
    [2, 1, 0],
  )
})

test('triageView: actionable when band age >= 1 or plan complete', () => {
  const now = Date.now()
  const features = [
    feat({
      slug: 'freshIncomplete',
      intent: 'active',
      lastTouched: now - 1 * DAY_MS,
      hasPlan: true,
      planCompletion: { checked: 1, total: 3 },
    }),
    feat({
      slug: 'freshComplete',
      intent: 'active',
      lastTouched: now - 1 * DAY_MS,
      hasPlan: true,
      planCompletion: { checked: 3, total: 3 },
    }),
    feat({ slug: 'stale', intent: 'parked', lastTouched: now - 10 * DAY_MS }),
  ]
  const byslug = Object.fromEntries(
    triageView(features, now).flatMap(b => b.entries.map(e => [e.feature.slug, e.actionable])),
  )
  assert.equal(byslug.freshIncomplete, false)
  assert.equal(byslug.freshComplete, true)
  assert.equal(byslug.stale, true)
})

// --- ambientCounts -----------------------------------------------------------

test('ambientCounts: finishable and stale over open features only', () => {
  const now = Date.now()
  const features = [
    feat({ intent: 'active', lastTouched: now - 1 * DAY_MS, planCompletion: { checked: 2, total: 2 } }), // finishable
    feat({ intent: 'parked', lastTouched: now - 8 * DAY_MS }), // stale
    feat({ intent: 'done', lastTouched: now - 30 * DAY_MS, planCompletion: { checked: 2, total: 2 } }), // ignored (done)
  ]
  assert.deepEqual(ambientCounts(features, now), { finishable: 1, stale: 1 })
})

test('INTENTS is the closed vocabulary', () => {
  assert.deepEqual(INTENTS, ['parked', 'active', 'done', 'abandoned'])
})
