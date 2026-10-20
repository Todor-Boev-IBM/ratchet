// test/write.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { patchFrontmatter, createFeatureFile } from '../lib/write.mjs'

function tmpDir() {
  return mkdtempSync(join(tmpdir(), 'featuremgr-write-'))
}

// --- patchFrontmatter --------------------------------------------------------

test('patchFrontmatter: updates a single field, preserves others and body', () => {
  const dir = tmpDir()
  const path = join(dir, 'feature.md')
  writeFileSync(path, '---\ntitle: Hello\nstatus: draft\n---\nsome body\n')

  patchFrontmatter(path, { status: 'active' })

  const out = readFileSync(path, 'utf8')
  assert.match(out, /^---\ntitle: Hello\nstatus: active\n---\n/)
  assert.match(out, /some body/)
  rmSync(dir, { recursive: true, force: true })
})

test('patchFrontmatter: adds a new key not previously present', () => {
  const dir = tmpDir()
  const path = join(dir, 'feature.md')
  writeFileSync(path, '---\ntitle: T\nstatus: active\n---\nbody\n')

  patchFrontmatter(path, { 'arch-merged': '2026-07-22' })

  const out = readFileSync(path, 'utf8')
  assert.match(out, /arch-merged: 2026-07-22/)
  assert.match(out, /title: T/)
  rmSync(dir, { recursive: true, force: true })
})

test('patchFrontmatter: preserves body that has no trailing newline', () => {
  const dir = tmpDir()
  const path = join(dir, 'feature.md')
  writeFileSync(path, '---\ntitle: T\nstatus: draft\n---\nbody without trailing newline')

  patchFrontmatter(path, { status: 'active' })

  const out = readFileSync(path, 'utf8')
  assert.match(out, /status: active/)
  assert.match(out, /body without trailing newline/)
  rmSync(dir, { recursive: true, force: true })
})

test('patchFrontmatter: creates parent directories if missing', () => {
  const dir = tmpDir()
  const path = join(dir, 'nested', 'deeply', 'feature.md')
  writeFileSync(join(dir, 'existing.md'), '---\ntitle: X\nstatus: draft\n---\n', { recursive: true })

  // patchFrontmatter on a non-existent file with missing dirs: should create it
  patchFrontmatter(path, { title: 'New', status: 'draft' })

  const out = readFileSync(path, 'utf8')
  assert.match(out, /title: New/)
  assert.match(out, /status: draft/)
  rmSync(dir, { recursive: true, force: true })
})

// --- createFeatureFile -------------------------------------------------------

test('createFeatureFile: creates feature.md with title, status draft, purpose', () => {
  const dir = tmpDir()
  const path = join(dir, 'feature.md')

  createFeatureFile(path, { title: 'My Feature', purpose: 'Does something useful.' })

  const out = readFileSync(path, 'utf8')
  assert.match(out, /title: My Feature/)
  assert.match(out, /status: draft/)
  assert.match(out, /Does something useful\./)
  rmSync(dir, { recursive: true, force: true })
})

test('createFeatureFile: creates feature.md without purpose (blank body)', () => {
  const dir = tmpDir()
  const path = join(dir, 'feature.md')

  createFeatureFile(path, { title: 'T' })

  const out = readFileSync(path, 'utf8')
  assert.match(out, /title: T/)
  assert.match(out, /status: draft/)
  rmSync(dir, { recursive: true, force: true })
})

test('createFeatureFile: creates parent directories', () => {
  const dir = tmpDir()
  const path = join(dir, 'features', 'my-feature', 'feature.md')

  createFeatureFile(path, { title: 'T' })

  const out = readFileSync(path, 'utf8')
  assert.match(out, /title: T/)
  rmSync(dir, { recursive: true, force: true })
})

test('createFeatureFile: throws EEXIST if file already exists', () => {
  const dir = tmpDir()
  const path = join(dir, 'feature.md')
  writeFileSync(path, '---\ntitle: Existing\nstatus: draft\n---\n')

  assert.throws(() => createFeatureFile(path, { title: 'New' }), { code: 'EEXIST' })
  rmSync(dir, { recursive: true, force: true })
})
