#!/usr/bin/env node
// docmgr — a read-only index builder and triage surface for a docs/ tree of
// features. A feature is a directory docs/features/<slug>/ holding a required
// feature.md anchor plus optional proposal.md / plan.md.
//   • reindex  — regenerates docs/index.md from the features. Never writes a
//                feature file — the index is the only output.
//   • check    — read-only structural audit (feature.md present, title + intent
//                valid, at least one artifact, plan phases present).
//   • triage   — read-only view of open features (parked/active), oldest-touched
//                first in weekly age bands, for the Triage skill to consume.
//
// Model
//   docs/
//     features/<slug>/feature.md    -> required anchor
//     features/<slug>/proposal.md   -> optional
//     features/<slug>/plan.md       -> optional
//   feature.md frontmatter (flat key: value pairs only, see lib/markdown.mjs):
//     title: <string>    required, authored.
//     intent: <parked|active|done|abandoned>   the ONLY stored state. Everything
//                        else (which artifacts exist, plan completion, last
//                        touched) is derived, never written back.
//   plan.md progress marker: a `## Phases` section whose `### Phase ...` sub-
//     headings each carry a `✅` (done) / `⏳` (in progress) / no marker (not
//     started) status. Completion = `✅` phases over total phase headings.
//
// File layout
//   lib/markdown.mjs  — generic helpers (find *.md files, parse frontmatter).
//   lib/features.mjs  — the feature model: loading features, deriving plan
//                       completion + last-touched, validation, triage view.
//                       Reads but never writes.
//   lib/render.mjs    — turns a loaded feature set into docs/index.md markdown.
//   docmgr.mjs (here) — CLI only: argv parsing, command dispatch, and the thin
//                       reindex/check/triage commands that wire the model +
//                       render + I/O together and print the results.
//
// Usage
//   docmgr reindex [--docs <dir>] [--out <file>]
//   docmgr check   [--docs <dir>]
//   docmgr triage  [--docs <dir>]

import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { parseArgs as parseNodeArgs } from 'node:util'
import { loadFeatures, validateFeatures, triageView, ambientCounts } from './lib/features.mjs'
import { renderIndex } from './lib/render.mjs'

// ---- args -------------------------------------------------------------------

function parseArgs(argv) {
  const [cmd, ...rest] = argv
  const { values } = parseNodeArgs({
    args: rest,
    options: { docs: { type: 'string', default: 'docs' }, out: { type: 'string' } },
  })
  return { cmd, opts: { docs: values.docs, out: values.out ?? null } }
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
      console.log(`  - ${feature.slug} (${feature.intent}) — ${artifacts} — ${plan} — ${Math.floor(ageDays)}d${flag}`)
    }
  }
  return 0
}

// ---- main -------------------------------------------------------------------

const { cmd, opts } = parseArgs(process.argv.slice(2))
switch (cmd) {
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
    console.error('usage: docmgr <reindex|check|triage> [--docs <dir>] [--out <file>]')
    process.exit(2)
}
