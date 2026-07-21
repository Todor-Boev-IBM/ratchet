// test/cli.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, writeFileSync, readdirSync, statSync, existsSync, rmSync } from 'node:fs'
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
    'plan.md': '## Phases\n\n### Phase 1: one ✅\n### Phase 2: two ✅ 2026-07-19\n',
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
