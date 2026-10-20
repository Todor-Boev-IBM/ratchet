// lib/write.mjs
//
// Write-side operations on feature.md files. The read side lives in
// lib/markdown.mjs (parseFrontmatter) and lib/features.mjs (loadFeature).
//
// This module is the only place in featuremgr that writes to disk outside of
// lib/render.mjs (which writes docs/index.md). It is used exclusively by the
// `init` and `mark` CLI commands.

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { parseFrontmatter } from './markdown.mjs'

// Serialise a flat key→value object back to a `---\nkey: value\n---` block.
// Values containing spaces or special characters are left unquoted — the
// existing frontmatter convention in this repo does not quote plain strings,
// and parseFrontmatter already strips surrounding quotes on read.
function serialiseFrontmatter(data) {
  const lines = ['---']
  for (const [k, v] of Object.entries(data)) {
    lines.push(`${k}: ${v}`)
  }
  lines.push('---')
  return lines.join('\n')
}

// Rewrite `path`'s frontmatter by merging `updates` into the existing fields.
// Existing fields not mentioned in `updates` are preserved; fields in `updates`
// are set to their new value. The body (everything after the closing ---) is
// unchanged. If the file does not yet have a frontmatter block, one is prepended.
export function patchFrontmatter(path, updates) {
  let text
  try {
    text = readFileSync(path, 'utf8')
  } catch {
    text = ''
  }
  const { data, body } = parseFrontmatter(text)
  const merged = { ...data, ...updates }
  const newText = serialiseFrontmatter(merged) + '\n' + body
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, newText)
}

// Write a brand-new feature.md at `path`. Fails with a clear error if the file
// already exists — `init` must not clobber an existing feature.
export function createFeatureFile(path, { title, purpose = '' }) {
  let exists = false
  try {
    readFileSync(path)
    exists = true
  } catch {}
  if (exists) {
    const err = new Error(`feature.md already exists: ${path}`)
    err.code = 'EEXIST'
    throw err
  }

  const content = `---
title: ${title}
status: draft
---
${purpose ? purpose + '\n' : '\n'}`

  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, content)
}
