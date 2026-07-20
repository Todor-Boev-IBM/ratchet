// lib/features.mjs
//
// The feature model: what a "feature" is (a directory under docs/features/
// holding a required feature.md anchor plus optional proposal.md / plan.md),
// and the facts derived from it. A feature stores exactly one piece of state —
// the `status` field on feature.md; everything else (which artifacts exist,
// how far a plan has progressed, when the feature was last touched) is derived
// here and never written back.
//
// This module reads but never writes. It reuses lib/markdown.mjs for the
// frontmatter parse and knows nothing about the CLI or index rendering
// (lib/render.mjs turns features into docs/index.md; docmgr.mjs prints).
//
// Replaces the old proposal/plan model (pairing, per-doc status, frontmatter
// repair) entirely — none of that survives here.

import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { parseFrontmatter } from './markdown.mjs'

// The closed vocabulary of feature statuses. `draft`/`active` are "open"
// statuses Triage works on; `done`/`abandoned` retire a feature from the
// working list. This is the only stored state a feature carries.
export const INTENTS = ['draft', 'active', 'done', 'abandoned']

const DAY_MS = 24 * 60 * 60 * 1000

// --- filesystem helpers ------------------------------------------------------

function fileExists(path) {
  try {
    return statSync(path).isFile()
  } catch {
    return false
  }
}

// Every file directly under `dir`, recursively. Returns [] if `dir` is missing
// so callers don't have to guard.
function listFiles(dir) {
  try {
    return readdirSync(dir, { recursive: true, withFileTypes: true })
      .filter(entry => entry.isFile())
      .map(entry => join(entry.parentPath, entry.name))
  } catch {
    return []
  }
}

// First non-empty line of a feature.md body — its one-line purpose.
function firstLine(body) {
  for (const line of body.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (trimmed) return trimmed
  }
  return null
}

// --- derivations (read, never store) -----------------------------------------

// Plan completion from the `## Phases` section inside a plan.md body. Each
// `### Phase ...` sub-heading in that section is one phase; a phase counts as
// done when its heading contains the text token `[done]` (`[wip]` = in
// progress, no token = not started, neither of which is "done"). Any trailing
// emoji after the token (e.g. `[done] ✅`) is decorative and ignored. Phases
// elsewhere in the document are ignored. Returns `{ checked, total }`, or
// `null` when there is no machine-readable signal (no `## Phases` section, or
// one with no phase headings) — deliberately not `{ checked: 0, total: 0 }`,
// so "no signal" is distinguishable from "0 done".
const DONE_MARKER = '[done]'

export function derivePlanCompletion(planBody) {
  const lines = planBody.split(/\r?\n/)
  let inSection = false
  let checked = 0
  let total = 0
  for (const line of lines) {
    // A level-2 heading is a section boundary. `### ...` and deeper do not
    // match (`^##\s` requires whitespace right after exactly two hashes), so
    // the phase sub-headings inside the Phases section are seen by the phase
    // check below, not treated as boundaries.
    const section = line.match(/^##\s+(.*)$/)
    if (section) {
      if (inSection) break // the next `##` after Phases ends the section
      inSection = /^phases\b/i.test(section[1].trim())
      continue
    }
    if (!inSection) continue
    // A `### Phase ...` sub-heading is one phase; other sub-headings (e.g.
    // `### Notes`) inside the section are not counted.
    if (!/^###\s+Phase\b/i.test(line)) continue
    total++
    if (line.includes(DONE_MARKER)) checked++
  }
  return total === 0 ? null : { checked, total }
}

// Last-touched = the newest file mtime anywhere under `featureDir`, so any edit
// to any of a feature's files refreshes it. Known weakness: mtime is reset by
// fresh clones/checkouts (see the plan's Open Questions); accepted for v1.
export function deriveLastTouched(featureDir) {
  let newest = 0
  for (const file of listFiles(featureDir)) {
    try {
      const { mtimeMs } = statSync(file)
      if (mtimeMs > newest) newest = mtimeMs
    } catch {
      // ignore files that vanish between listing and stat
    }
  }
  return newest
}

// --- loading -----------------------------------------------------------------

function loadFeature(dir, slug) {
  const featureFile = join(dir, 'feature.md')
  let hasFeatureFile = true
  let data = {}
  let body = ''
  try {
    ;({ data, body } = parseFrontmatter(readFileSync(featureFile, 'utf8')))
  } catch {
    hasFeatureFile = false
  }

  const hasProposal = fileExists(join(dir, 'proposal.md'))
  const hasPlan = fileExists(join(dir, 'plan.md'))

  let planCompletion = null
  if (hasPlan) {
    const { body: planBody } = parseFrontmatter(readFileSync(join(dir, 'plan.md'), 'utf8'))
    planCompletion = derivePlanCompletion(planBody)
  }

  return {
    slug,
    hasFeatureFile,
    title: data.title || null,
    status: data.status || null,
    purpose: firstLine(body),
    hasProposal,
    hasPlan,
    planCompletion,
    lastTouched: deriveLastTouched(dir),
  }
}

// Walk docs/features/*/ (one directory per feature), parse each feature.md, and
// attach derived facts. Pure read — no file is written. Sorted by slug for
// stable output.
export function loadFeatures(docsDir) {
  const featuresDir = join(docsDir, 'features')
  let entries
  try {
    entries = readdirSync(featuresDir, { withFileTypes: true })
  } catch {
    return []
  }
  return entries
    .filter(entry => entry.isDirectory())
    .map(entry => loadFeature(join(featuresDir, entry.name), entry.name))
    .sort((a, b) => a.slug.localeCompare(b.slug))
}

// --- validation (report-only, no I/O) ----------------------------------------

// Structural audit of a loaded feature set. Returns an array of problem
// strings; pure, so the CLI decides how to report them. A skill (with the
// human present) fixes what this flags — the tool never mutates feature files.
export function validateFeatures(features) {
  const problems = []
  for (const f of features) {
    if (!f.hasFeatureFile) {
      problems.push(`missing feature.md: features/${f.slug}/`)
      continue
    }
    if (!f.title) problems.push(`no title: features/${f.slug}/feature.md`)
    if (!f.status) {
      problems.push(`no status: features/${f.slug}/feature.md`)
    } else if (!INTENTS.includes(f.status)) {
      problems.push(`invalid status '${f.status}': features/${f.slug}/feature.md (allowed: ${INTENTS.join(', ')})`)
    }
    if (!f.hasProposal && !f.hasPlan) {
      problems.push(`no proposal.md or plan.md: features/${f.slug}/`)
    }
    if (f.hasPlan && f.planCompletion === null) {
      problems.push(`warn: plan.md has no "## Phases" section with phase headings: features/${f.slug}/`)
    }
  }
  return problems
}

// --- triage ------------------------------------------------------------------

function isOpen(feature) {
  return feature.status === 'draft' || feature.status === 'active'
}

function isComplete(feature) {
  const c = feature.planCompletion
  return Boolean(c && c.total > 0 && c.checked === c.total)
}

function bandLabel(index) {
  return `${index * 7}\u2013${(index + 1) * 7} days`
}

// The triage view: open-status features only (draft/active), ordered
// oldest-touched first, grouped into one-week age bands. Because the input is
// sorted oldest-first and bands are emitted in encounter order, the returned
// buckets run stalest-first, and within each bucket entries are oldest-first.
//
// Each entry is marked `actionable` when its plan phases are all done OR it
// is at least one full week old (band index >= 1). `now` is injectable for
// deterministic tests.
export function triageView(features, now = Date.now()) {
  const open = features.filter(isOpen).sort((a, b) => a.lastTouched - b.lastTouched)
  const bands = new Map() // insertion order == oldest-first band encounter
  for (const f of open) {
    const ageDays = (now - f.lastTouched) / DAY_MS
    const bandIndex = Math.floor(ageDays / 7)
    const entry = { feature: f, ageDays, bandIndex, actionable: isComplete(f) || bandIndex >= 1 }
    if (!bands.has(bandIndex)) bands.set(bandIndex, [])
    bands.get(bandIndex).push(entry)
  }
  return [...bands.entries()].map(([bandIndex, entries]) => ({ bandIndex, label: bandLabel(bandIndex), entries }))
}

// The ambient nudge counts printed after `reindex`: how many open features are
// finishable (plan phases all done) and how many are stale (at least one
// full week untouched).
export function ambientCounts(features, now = Date.now()) {
  let finishable = 0
  let stale = 0
  for (const f of features) {
    if (!isOpen(f)) continue
    if (isComplete(f)) finishable++
    if ((now - f.lastTouched) / DAY_MS >= 7) stale++
  }
  return { finishable, stale }
}
