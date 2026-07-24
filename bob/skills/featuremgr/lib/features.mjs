// lib/features.mjs — the feature model.
//
// A "feature" is a directory under docs/features/ holding a required feature.md
// anchor plus optional proposal.md / plan.md. feature.md stores exactly one
// piece of state (`status`); everything else — artifacts present, plan
// completion, last-touched — is derived here and never written back. This
// module reads but never writes, and knows nothing about the CLI or rendering.

import { readdirSync, statSync } from 'node:fs'
import { resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import { readMarkdown } from './markdown.mjs'
import { featuresDir, featureDir, featureFile, planFile, proposalFile } from './paths.mjs'

// The closed vocabulary of feature statuses. `draft`/`active`/`in-review` are
// "open" statuses Triage works on; `done`/`abandoned` retire a feature from the
// working list. This is the only stored state a feature carries.
export const INTENTS = ['draft', 'active', 'in-review', 'done', 'abandoned']

const DAY_MS = 24 * 60 * 60 * 1000

// --- filesystem helpers ------------------------------------------------------

function fileExists(path) {
  try {
    return statSync(path).isFile()
  } catch {
    return false
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
// done when its heading contains a `✅` emoji (`⏳` = in progress, no marker =
// not started). Phases elsewhere in the document are ignored. Returns
// `{ checked, total }`, or `null` when there is no machine-readable signal (no
// `## Phases` section, or one with no phase headings) — deliberately not
// `{ checked: 0, total: 0 }` so "no signal" is distinguishable from "0 done".
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
    if (line.includes('✅')) checked++
  }
  return total === 0 ? null : { checked, total }
}

// Run: git log -1 --format="%aI" -- <dir>
// Returns ISO timestamp of newest commit touching any file under `dir`,
// or 0 if git is unavailable or the directory has never been committed.
export function deriveLastTouched(dir, repoRoot = resolve(dir, '../../..')) {
  try {
    const result = spawnSync('git', ['log', '-1', '--format=%aI', '--', dir], { cwd: repoRoot, encoding: 'utf8' })
    const iso = result.stdout.trim()
    if (!iso) return 0 // never committed → unknown
    return new Date(iso).getTime()
  } catch {
    return 0 // git not available → unknown
  }
}

// --- loading -----------------------------------------------------------------

function loadFeature(docsDir, slug, repoRoot) {
  const feature = readMarkdown(featureFile(docsDir, slug))
  const { data, body } = feature ?? { data: {}, body: '' }

  const hasPlan = fileExists(planFile(docsDir, slug))
  const plan = hasPlan ? readMarkdown(planFile(docsDir, slug)) : null

  return {
    slug,
    hasFeatureFile: feature !== null,
    title: data.title || null,
    status: data.status || null,
    archMerged: data['arch-merged'] ?? null,
    purpose: firstLine(body),
    hasProposal: fileExists(proposalFile(docsDir, slug)),
    hasPlan,
    planCompletion: plan ? derivePlanCompletion(plan.body) : null,
    lastTouched: deriveLastTouched(featureDir(docsDir, slug), repoRoot),
  }
}

// Walk docs/features/*/ (one directory per feature), parse each feature.md, and
// attach derived facts. Pure read — no file is written. Sorted by slug for
// stable output.
export function loadFeatures(docsDir, repoRoot = resolve(docsDir, '..')) {
  let entries
  try {
    entries = readdirSync(featuresDir(docsDir), { withFileTypes: true })
  } catch {
    return []
  }
  return entries
    .filter(entry => entry.isDirectory())
    .map(entry => loadFeature(docsDir, entry.name, repoRoot))
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

// Human-readable artifact names present on a feature, in display order.
// Shared by the index renderer and the triage view so both list artifacts
// the same way.
export function artifactNames(feature) {
  const names = []
  if (feature.hasProposal) names.push('proposal')
  if (feature.hasPlan) names.push('plan')
  return names
}

function isOpen(feature) {
  return feature.status === 'draft' || feature.status === 'active' || feature.status === 'in-review'
}

function isComplete(feature) {
  const c = feature.planCompletion
  return Boolean(c && c.total > 0 && c.checked === c.total)
}

function bandLabel(index) {
  return `${index * 7}\u2013${(index + 1) * 7} days`
}

// The triage view: open-status features only (draft/active/in-review), ordered
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
