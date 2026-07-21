// lib/markdown.mjs
//
// Generic, docs-agnostic helpers for reading markdown files with YAML-style
// frontmatter. Nothing in this file knows about "proposals" or "plans" —
// it would work for any folder of *.md files. Think of it as the seam
// between "code that could be an npm package" and "code that is specific
// to how featuremgr organizes docs" (which stays in featuremgr.mjs).
//
// Why hand-rolled instead of real packages (e.g. `gray-matter` for
// frontmatter, `fast-glob` for file discovery)? featuremgr is a small,
// dependency-free script. The two functions below only need to handle the
// narrow slice of YAML this repo actually uses — flat `key: value` lines,
// no lists or nesting — so a full YAML parser wasn't worth adding
// `node_modules` for. If frontmatter ever needs to hold something richer
// than flat fields, swap this file out for those packages rather than
// extending the regex below.

import { readdirSync } from 'node:fs'
import { join, extname } from 'node:path'

/**
 * Recursively collect every `.md` file under `dir`.
 *
 * Returns an empty array if `dir` doesn't exist, instead of throwing, so
 * callers don't need to check "does docs/proposals even exist?" first.
 */
export function walkMarkdownFiles(dir) {
  // readdirSync throws if `dir` is missing — that's expected (e.g. a repo
  // with no plans/ yet), so we just treat it as "no files here".
  let entries
  try {
    entries = readdirSync(dir, { recursive: true, withFileTypes: true })
  } catch {
    return []
  }

  return entries
    .filter(entry => entry.isFile() && extname(entry.name) === '.md')
    .map(entry => join(entry.parentPath, entry.name))
}

/**
 * Split a markdown file's text into its frontmatter fields and body.
 *
 * A file with frontmatter looks like this:
 *
 *   ---
 *   title: "Some Feature"
 *   status: active
 *   ---
 *   # The actual markdown content starts here
 *
 * This only understands flat `key: value` lines — it is NOT a general YAML
 * parser, just enough to read (and later rewrite) the couple of fields
 * featuremgr cares about.
 *
 * Returns `{ data, body }`:
 *   - `data` — a plain object of the parsed frontmatter fields
 *   - `body` — everything after the closing `---` fence
 * If the file has no frontmatter fence, `data` is `{}` and `body` is the
 * whole file unchanged.
 */
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
