// lib/markdown.mjs — reading markdown files with flat `key: value` frontmatter.
// Docs-agnostic: knows nothing about "features". Hand-rolled (no gray-matter /
// fast-glob) because featuremgr only needs flat frontmatter and stays
// dependency-free; swap in real packages if frontmatter ever grows richer.

import { readFileSync } from 'node:fs'

// Read + parse a markdown file. Returns `{ data, body }`, or null if the file
// can't be read — so callers branch on presence instead of each wrapping their
// own try/catch around readFileSync.
export function readMarkdown(path) {
  try {
    return parseFrontmatter(readFileSync(path, 'utf8'))
  } catch {
    return null
  }
}

// Split a markdown file's text into `{ data, body }`. `data` is the flat
// `key: value` frontmatter fields (NOT general YAML — just what featuremgr
// reads/rewrites); `body` is everything after the closing `---`. A file with
// no frontmatter fence yields `{ data: {}, body: <whole file> }`.
export function parseFrontmatter(text) {
  const lines = text.split(/\r?\n/)

  // `lines[0]?.trim()` uses optional chaining (`?.`): if `lines[0]` were
  // ever missing, this evaluates to `undefined` instead of throwing.
  if (lines[0]?.trim() !== '---') return { data: {}, body: text }

  // Collect every line between the opening `---` and the closing `---`.
  let i = 1
  const frontmatterLines = []
  while (i < lines.length && lines[i].trim() !== '---') {
    frontmatterLines.push(lines[i])
    i++
  }
  if (i >= lines.length) return { data: {}, body: text } // never found a closing fence

  const body = lines.slice(i + 1).join('\n')

  const data = {}
  for (const line of frontmatterLines) {
    // Match "key: value" — letters/digits/-/_ for the key, anything for the value.
    const match = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/)
    if (!match) continue
    const [, key, rawValue] = match // destructuring: skip the full match, keep the two groups
    data[key] = rawValue.trim().replace(/^["']|["']$/g, '') // strip surrounding quotes, if any
  }

  return { data, body }
}
