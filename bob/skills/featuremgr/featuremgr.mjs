#!/usr/bin/env node
// featuremgr — lifecycle manager and index builder for a docs/features tree.
// A feature is a directory docs/features/<slug>/ holding a required feature.md
// anchor plus optional proposal.md / plan.md.
//
//   • init     — create a new feature directory + feature.md at status:draft.
//   • mark     — transition a feature's status with precondition guards.
//   • reindex  — regenerates docs/index.md from the features. Never writes a
//                feature file — the index is the only output.
//   • check    — read-only structural audit (feature.md present, title + status
//                valid, at least one artifact, plan phases present).
//   • triage   — read-only view of open features (draft/active/in-review),
//                oldest-touched first in weekly age bands, for the Triage skill
//                to consume.
//
// Model
//   docs/
//     features/<slug>/feature.md    -> required anchor (owned exclusively by featuremgr)
//     features/<slug>/proposal.md   -> optional (owned by create-proposal skill)
//     features/<slug>/plan.md       -> optional (owned by create-plan / execute-plan)
//   feature.md frontmatter (flat key: value pairs only, see lib/markdown.mjs):
//     title: <string>    required, authored at init.
//     status: <draft|active|in-review|done|abandoned>   the ONLY stored state.
//                        Written by init (draft) and mark (transitions). Everything
//                        else (which artifacts exist, plan completion, last
//                        touched) is derived, never written back.
//   plan.md progress marker: a `## Phases` section whose `### Phase ...` sub-
//     headings each carry a `✅` (done) / `⏳` (in progress) / no emoji (not
//     started) marker. Completion = `✅` phases over total `### Phase` headings.
//
// Status state machine and transition guards:
//   draft     -> active     plan.md must exist with a ## Phases section
//   draft     -> abandoned  (no document precondition)
//   active    -> in-review  all ### Phase headings in plan.md carry ✅
//   active    -> abandoned  (no document precondition)
//   in-review -> done       (no document precondition; human ratifies via triage)
//   in-review -> abandoned  (no document precondition)
//   done, abandoned -> any  REJECTED — terminal statuses are immutable
//
// File layout
//   lib/markdown.mjs  — generic helpers (find *.md files, parse frontmatter).
//   lib/features.mjs  — the feature model: loading features, deriving plan
//                       completion + last-touched, validation, triage view.
//                       Reads but never writes.
//   lib/render.mjs    — turns a loaded feature set into docs/index.md markdown.
//   lib/write.mjs     — write-side operations on feature.md (init, mark).
//   featuremgr.mjs (here) — CLI only: argv parsing, command dispatch, and the thin
//                       commands that wire the model + render + I/O together.
//
// Usage
//   featuremgr init   <slug> --title <title> [--purpose <text>] [--docs <dir>]
//   featuremgr mark   <slug> <status> [--docs <dir>]
//   featuremgr reindex [--docs <dir>] [--out <file>]
//   featuremgr check   [--docs <dir>]
//   featuremgr triage  [--docs <dir>]

import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { parseArgs as parseNodeArgs } from 'node:util'
import {
  loadFeatures,
  validateFeatures,
  triageView,
  ambientCounts,
  derivePlanCompletion,
  INTENTS,
} from './lib/features.mjs'
import { renderIndex } from './lib/render.mjs'
import { createFeatureFile, patchFrontmatter } from './lib/write.mjs'
import { parseFrontmatter } from './lib/markdown.mjs'
import { readFileSync } from 'node:fs'

// ---- args -------------------------------------------------------------------

function parseArgs(argv) {
  const [cmd, ...rest] = argv
  const { values, positionals } = parseNodeArgs({
    args: rest,
    options: {
      docs: { type: 'string', default: 'docs' },
      out: { type: 'string' },
      title: { type: 'string' },
      purpose: { type: 'string' },
    },
    allowPositionals: true,
  })
  return {
    cmd,
    positionals,
    opts: { docs: values.docs, out: values.out ?? null, title: values.title, purpose: values.purpose },
  }
}

// ---- helpers ----------------------------------------------------------------

function featureDir(docsDir, slug) {
  return join(docsDir, 'features', slug)
}

function featureFile(docsDir, slug) {
  return join(featureDir(docsDir, slug), 'feature.md')
}

function planFile(docsDir, slug) {
  return join(featureDir(docsDir, slug), 'plan.md')
}

// Read the current status of a feature.md. Returns null if the file is missing
// or has no status field.
function readStatus(featurePath) {
  try {
    const { data } = parseFrontmatter(readFileSync(featurePath, 'utf8'))
    return data.status || null
  } catch {
    return null
  }
}

// Verify that plan.md exists and has a ## Phases section with at least one
// ### Phase heading. Returns an error string or null.
function checkPlanReady(docsDir, slug) {
  const planPath = planFile(docsDir, slug)
  let planBody
  try {
    planBody = parseFrontmatter(readFileSync(planPath, 'utf8')).body
  } catch {
    return `plan.md not found: features/${slug}/plan.md`
  }
  const completion = derivePlanCompletion(planBody)
  if (completion === null) {
    return `plan.md has no ## Phases section with phase headings: features/${slug}/plan.md`
  }
  return null
}

// Verify that all phases in plan.md carry ✅. Returns an error string or null.
function checkPlanDone(docsDir, slug) {
  const planPath = planFile(docsDir, slug)
  let planBody
  try {
    planBody = parseFrontmatter(readFileSync(planPath, 'utf8')).body
  } catch {
    return `plan.md not found: features/${slug}/plan.md`
  }
  const completion = derivePlanCompletion(planBody)
  if (completion === null) {
    return `plan.md has no ## Phases section: features/${slug}/plan.md`
  }
  if (completion.checked < completion.total) {
    return `plan not complete: ${completion.checked}/${completion.total} phases done in features/${slug}/plan.md`
  }
  return null
}

// ---- commands -----------------------------------------------------------

function reindex(docsDir, outFile) {
  const features = loadFeatures(docsDir)
  const { content, summary } = renderIndex(features)

  const out = outFile || join(docsDir, 'index.md')
  writeFileSync(out, content)

  const { finishable, stale } = ambientCounts(features)
  console.log(`reindex: ${features.length} feature(s) -> ${out}`)
  if (summary.length) console.log(summary.join('\n'))
  console.log(`${finishable} finishable, ${stale} stale`)
}

function check(docsDir) {
  const features = loadFeatures(docsDir)
  const problems = validateFeatures(features)

  if (problems.length === 0) {
    console.log(`check: ${features.length} feature(s), no problems`)
    return 0
  }
  console.log(`check: ${features.length} feature(s), ${problems.length} problem(s):`)
  for (const p of problems.sort()) console.log(`  - ${p}`)
  return 1
}

function triage(docsDir) {
  const features = loadFeatures(docsDir)
  const bands = triageView(features)
  const total = bands.reduce((n, band) => n + band.entries.length, 0)

  console.log(`triage: ${total} open feature(s)`)
  for (const band of bands) {
    console.log(`\n## ${band.label}`)
    for (const { feature, ageDays, actionable } of band.entries) {
      const artifacts =
        [feature.hasProposal && 'proposal', feature.hasPlan && 'plan'].filter(Boolean).join(', ') || 'no artifacts'
      const plan = feature.planCompletion
        ? `plan ${feature.planCompletion.checked}/${feature.planCompletion.total}`
        : 'no plan phases'
      const flag = actionable ? ' [actionable]' : ''
      const archPending = feature.archMerged === null ? ' [arch-pending]' : ''
      console.log(
        `  - ${feature.slug} (${feature.status}) — ${artifacts} — ${plan} — ${Math.floor(ageDays)}d${flag}${archPending}`,
      )
    }
  }
  return 0
}

function cmdInit(positionals, opts) {
  const [slug] = positionals
  if (!slug) {
    console.error('usage: featuremgr init <slug> --title <title> [--purpose <text>] [--docs <dir>]')
    process.exit(2)
  }
  if (!opts.title) {
    console.error('featuremgr init: --title is required')
    process.exit(2)
  }

  const path = featureFile(opts.docs, slug)
  try {
    createFeatureFile(path, { title: opts.title, purpose: opts.purpose })
  } catch (err) {
    if (err.code === 'EEXIST') {
      console.error(`featuremgr init: ${err.message}`)
      process.exit(1)
    }
    throw err
  }
  console.log(`init: created features/${slug}/feature.md (status: draft)`)
}

// Allowed transitions. Each entry is [fromStatus, toStatus, checkFn].
// checkFn(docsDir, slug) returns an error string or null.
const TRANSITIONS = [
  ['draft', 'active', checkPlanReady],
  ['draft', 'abandoned', null],
  ['active', 'in-review', checkPlanDone], // execution parks here after all phases ✅
  ['active', 'abandoned', null],
  ['in-review', 'done', null], // human ratifies via triage
  ['in-review', 'abandoned', null],
]

function cmdMark(positionals, opts) {
  const [slug, toStatus] = positionals
  if (!slug || !toStatus) {
    console.error('usage: featuremgr mark <slug> <status> [--docs <dir>]')
    process.exit(2)
  }
  if (!INTENTS.includes(toStatus)) {
    console.error(`featuremgr mark: unknown status '${toStatus}' (allowed: ${INTENTS.join(', ')})`)
    process.exit(2)
  }

  const path = featureFile(opts.docs, slug)
  const fromStatus = readStatus(path)

  if (!fromStatus) {
    console.error(`featuremgr mark: feature.md not found or has no status: features/${slug}/feature.md`)
    process.exit(1)
  }

  // Terminal-immutability guard.
  if (fromStatus === 'done' || fromStatus === 'abandoned') {
    console.error(`featuremgr mark: cannot transition from terminal status '${fromStatus}' (features/${slug})`)
    process.exit(1)
  }

  // No-op: same status.
  if (fromStatus === toStatus) {
    console.log(`mark: features/${slug} already has status '${toStatus}' — nothing to do`)
    return
  }

  const transition = TRANSITIONS.find(([from, to]) => from === fromStatus && to === toStatus)
  if (!transition) {
    console.error(`featuremgr mark: invalid transition ${fromStatus} -> ${toStatus} for features/${slug}`)
    process.exit(1)
  }

  const [, , checkFn] = transition
  if (checkFn) {
    const err = checkFn(opts.docs, slug)
    if (err) {
      console.error(`featuremgr mark: precondition failed — ${err}`)
      process.exit(1)
    }
  }

  patchFrontmatter(path, { status: toStatus })
  console.log(`mark: features/${slug} ${fromStatus} -> ${toStatus}`)
}

// ---- main -------------------------------------------------------------------

const { cmd, positionals, opts } = parseArgs(process.argv.slice(2))
switch (cmd) {
  case 'init':
    cmdInit(positionals, opts)
    break
  case 'mark':
    cmdMark(positionals, opts)
    break
  case 'reindex':
    reindex(opts.docs, opts.out)
    break
  case 'check':
    process.exit(check(opts.docs))
    break
  case 'triage':
    process.exit(triage(opts.docs))
    break
  default:
    console.error('usage: featuremgr <init|mark|reindex|check|triage> [--docs <dir>] [--out <file>]')
    process.exit(2)
}
