// test/cli.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, readdirSync, statSync, existsSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const featuremgr = join(here, '..', 'featuremgr.mjs')

function run(args, opts = {}) {
  return execFileSync('node', [featuremgr, ...args], { encoding: 'utf8', ...opts })
}

function buildFixture() {
  const docs = mkdtempSync(join(tmpdir(), 'featuremgr-cli-'))
  const write = (slug, files) => {
    const dir = join(docs, 'features', slug)
    mkdirSync(dir, { recursive: true })
    for (const [name, body] of Object.entries(files)) writeFileSync(join(dir, name), body)
  }
  write('alpha', {
    'feature.md': '---\ntitle: "Alpha"\nstatus: active\n---\nAlpha purpose.\n',
    'plan.md': '## Phases\n\n### Phase 1: one ✅ 2026-07-18\n### Phase 2: two ✅ 2026-07-19\n',
  })
  write('beta', { 'feature.md': '---\ntitle: "Beta"\nstatus: draft\n---\nBeta purpose.\n', 'proposal.md': '# Beta\n' })
  return docs
}

// Snapshot mtimes of every file under docs/features/.
function featureFileMtimes(docs) {
  const featuresDir = join(docs, 'features')
  const out = {}
  for (const entry of readdirSync(featuresDir, { recursive: true, withFileTypes: true })) {
    if (!entry.isFile()) continue
    const p = join(entry.parentPath, entry.name)
    out[p] = statSync(p).mtimeMs
  }
  return out
}

test('reindex: writes index.md and touches no feature file', () => {
  const docs = buildFixture()
  const before = featureFileMtimes(docs)

  const out = run(['reindex', '--docs', docs])
  assert.match(out, /reindex: 2 feature\(s\)/)

  // index.md exists and was the only new file
  assert.ok(existsSync(join(docs, 'index.md')))

  const after = featureFileMtimes(docs)
  assert.deepEqual(Object.keys(after).sort(), Object.keys(before).sort())
  for (const [path, mtime] of Object.entries(before)) {
    assert.equal(after[path], mtime, `feature file changed: ${path}`)
  }
  rmSync(docs, { recursive: true, force: true })
})

test('reindex: prints the ambient nudge line', () => {
  const docs = buildFixture()
  const out = run(['reindex', '--docs', docs])
  // alpha plan is complete -> finishable; both freshly written -> not stale
  assert.match(out, /\d+ finishable, \d+ stale/)
  rmSync(docs, { recursive: true, force: true })
})

test('check: passes on a well-formed fixture', () => {
  const docs = buildFixture()
  const out = run(['check', '--docs', docs])
  assert.match(out, /no problems/)
  rmSync(docs, { recursive: true, force: true })
})

test('check: exits non-zero and flags a broken feature', () => {
  const docs = buildFixture()
  // A feature dir with no feature.md and no artifacts.
  mkdirSync(join(docs, 'features', 'broken'), { recursive: true })
  writeFileSync(join(docs, 'features', 'broken', 'notes.txt'), 'x')

  let failed = false
  try {
    run(['check', '--docs', docs])
  } catch (err) {
    failed = true
    assert.match(err.stdout, /missing feature\.md: features\/broken\//)
  }
  assert.ok(failed, 'check should exit non-zero')
  rmSync(docs, { recursive: true, force: true })
})

test('triage: lists open features oldest-first', () => {
  const docs = buildFixture()
  const out = run(['triage', '--docs', docs])
  assert.match(out, /triage: 2 open feature\(s\)/)
  assert.match(out, /alpha \(active\)/)
  assert.match(out, /beta \(draft\)/)
  rmSync(docs, { recursive: true, force: true })
})

test('triage: [arch-pending] shown for open features without arch-merged', () => {
  const docs = buildFixture()
  // buildFixture creates alpha (active, no arch-merged) and beta (draft, no arch-merged)
  const out = run(['triage', '--docs', docs])
  const lines = out.split('\n').filter(l => l.includes('alpha') || l.includes('beta'))
  assert.ok(lines.every(l => l.includes('[arch-pending]')), `expected [arch-pending] in: ${lines.join(' | ')}`)
  rmSync(docs, { recursive: true, force: true })
})

test('triage: [arch-pending] absent when arch-merged is set', () => {
  const docs = mkdtempSync(join(tmpdir(), 'featuremgr-cli-arch-'))
  const write = (slug, files) => {
    const dir = join(docs, 'features', slug)
    mkdirSync(dir, { recursive: true })
    for (const [name, body] of Object.entries(files)) writeFileSync(join(dir, name), body)
  }
  write('merged', {
    'feature.md': '---\ntitle: "Merged"\nstatus: active\narch-merged: 2026-07-22\n---\npurpose\n',
    'proposal.md': '# p\n',
  })
  const out = run(['triage', '--docs', docs])
  const line = out.split('\n').find(l => l.includes('merged'))
  assert.ok(line, 'expected merged feature in output')
  assert.doesNotMatch(line, /\[arch-pending\]/)
  rmSync(docs, { recursive: true, force: true })
})

// ---- init -------------------------------------------------------------------

test('init: creates feature.md at status draft', () => {
  const docs = mkdtempSync(join(tmpdir(), 'featuremgr-init-'))
  const out = run(['init', 'my-feature', '--title', 'My Feature', '--docs', docs])
  assert.match(out, /init: created features\/my-feature\/feature\.md/)

  const featurePath = join(docs, 'features', 'my-feature', 'feature.md')
  assert.ok(existsSync(featurePath))
  const content = readFileSync(featurePath, 'utf8')
  assert.match(content, /title: My Feature/)
  assert.match(content, /status: draft/)
  rmSync(docs, { recursive: true, force: true })
})

test('init: accepts optional --purpose', () => {
  const docs = mkdtempSync(join(tmpdir(), 'featuremgr-init-'))
  run(['init', 'slug', '--title', 'T', '--purpose', 'Does X.', '--docs', docs])
  const content = readFileSync(join(docs, 'features', 'slug', 'feature.md'), 'utf8')
  assert.match(content, /Does X\./)
  rmSync(docs, { recursive: true, force: true })
})

test('init: fails with exit 1 if slug already exists', () => {
  const docs = mkdtempSync(join(tmpdir(), 'featuremgr-init-'))
  run(['init', 'dup', '--title', 'First', '--docs', docs])
  let failed = false
  try {
    run(['init', 'dup', '--title', 'Second', '--docs', docs])
  } catch (err) {
    failed = true
    assert.equal(err.status, 1)
    assert.match(err.stderr, /already exists/)
  }
  assert.ok(failed)
  rmSync(docs, { recursive: true, force: true })
})

test('init: fails with exit 2 when --title is missing', () => {
  const docs = mkdtempSync(join(tmpdir(), 'featuremgr-init-'))
  let failed = false
  try {
    run(['init', 'slug', '--docs', docs])
  } catch (err) {
    failed = true
    assert.equal(err.status, 2)
  }
  assert.ok(failed)
  rmSync(docs, { recursive: true, force: true })
})

// ---- mark -------------------------------------------------------------------

function buildMarkFixture() {
  const docs = mkdtempSync(join(tmpdir(), 'featuremgr-mark-'))
  const write = (slug, files) => {
    const dir = join(docs, 'features', slug)
    mkdirSync(dir, { recursive: true })
    for (const [name, body] of Object.entries(files)) writeFileSync(join(dir, name), body)
  }
  write('draft-only', {
    'feature.md': '---\ntitle: D\nstatus: draft\n---\npurpose\n',
    'proposal.md': '# p\n',
  })
  write('has-plan', {
    'feature.md': '---\ntitle: P\nstatus: draft\n---\npurpose\n',
    'plan.md': '## Phases\n\n### Phase 1: one\n### Phase 2: two\n',
  })
  write('all-done', {
    'feature.md': '---\ntitle: A\nstatus: active\n---\npurpose\n',
    'plan.md': '## Phases\n\n### Phase 1: one ✅ 2026-07-18\n### Phase 2: two ✅ 2026-07-19\n',
  })
  write('partial-done', {
    'feature.md': '---\ntitle: R\nstatus: active\n---\npurpose\n',
    'plan.md': '## Phases\n\n### Phase 1: one ✅ 2026-07-18\n### Phase 2: two\n',
  })
  write('terminal-done', {
    'feature.md': '---\ntitle: X\nstatus: done\n---\npurpose\n',
    'plan.md': '## Phases\n\n### Phase 1: one ✅\n',
  })
  return docs
}

test('mark: draft -> abandoned (no precondition)', () => {
  const docs = buildMarkFixture()
  const out = run(['mark', 'draft-only', 'abandoned', '--docs', docs])
  assert.match(out, /draft-only draft -> abandoned/)
  const content = readFileSync(join(docs, 'features', 'draft-only', 'feature.md'), 'utf8')
  assert.match(content, /status: abandoned/)
  rmSync(docs, { recursive: true, force: true })
})

test('mark: draft -> active requires plan.md with ## Phases', () => {
  const docs = buildMarkFixture()
  // draft-only has no plan.md — should fail
  let failed = false
  try {
    run(['mark', 'draft-only', 'active', '--docs', docs])
  } catch (err) {
    failed = true
    assert.equal(err.status, 1)
    assert.match(err.stderr, /plan\.md not found/)
  }
  assert.ok(failed)
  rmSync(docs, { recursive: true, force: true })
})

test('mark: draft -> active succeeds when plan.md has ## Phases', () => {
  const docs = buildMarkFixture()
  const out = run(['mark', 'has-plan', 'active', '--docs', docs])
  assert.match(out, /has-plan draft -> active/)
  const content = readFileSync(join(docs, 'features', 'has-plan', 'feature.md'), 'utf8')
  assert.match(content, /status: active/)
  rmSync(docs, { recursive: true, force: true })
})

test('mark: active -> done requires all phases ✅', () => {
  const docs = buildMarkFixture()
  let failed = false
  try {
    run(['mark', 'partial-done', 'done', '--docs', docs])
  } catch (err) {
    failed = true
    assert.equal(err.status, 1)
    assert.match(err.stderr, /plan not complete/)
  }
  assert.ok(failed)
  rmSync(docs, { recursive: true, force: true })
})

test('mark: active -> done succeeds when all phases ✅', () => {
  const docs = buildMarkFixture()
  const out = run(['mark', 'all-done', 'done', '--docs', docs])
  assert.match(out, /all-done active -> done/)
  const content = readFileSync(join(docs, 'features', 'all-done', 'feature.md'), 'utf8')
  assert.match(content, /status: done/)
  rmSync(docs, { recursive: true, force: true })
})

test('mark: terminal status done cannot be re-marked', () => {
  const docs = buildMarkFixture()
  let failed = false
  try {
    run(['mark', 'terminal-done', 'active', '--docs', docs])
  } catch (err) {
    failed = true
    assert.equal(err.status, 1)
    assert.match(err.stderr, /terminal status/)
  }
  assert.ok(failed)
  rmSync(docs, { recursive: true, force: true })
})

test('mark: no-op when target status is the same as current', () => {
  const docs = buildMarkFixture()
  const out = run(['mark', 'has-plan', 'draft', '--docs', docs])
  assert.match(out, /nothing to do/)
  rmSync(docs, { recursive: true, force: true })
})

test('mark: fails with exit 1 when feature.md does not exist', () => {
  const docs = buildMarkFixture()
  let failed = false
  try {
    run(['mark', 'nonexistent', 'active', '--docs', docs])
  } catch (err) {
    failed = true
    assert.equal(err.status, 1)
  }
  assert.ok(failed)
  rmSync(docs, { recursive: true, force: true })
})

test('mark: fails with exit 2 for unknown status', () => {
  const docs = buildMarkFixture()
  let failed = false
  try {
    run(['mark', 'has-plan', 'flying', '--docs', docs])
  } catch (err) {
    failed = true
    assert.equal(err.status, 2)
  }
  assert.ok(failed)
  rmSync(docs, { recursive: true, force: true })
})
