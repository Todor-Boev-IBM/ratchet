#!/usr/bin/env node
// featuremgr — lifecycle manager and index builder for a docs/features tree.
//
// A feature is a directory docs/features/<slug>/ with a required feature.md
// anchor (the only place status is stored) plus optional proposal.md / plan.md.
// Everything else — artifacts present, plan completion, last-touched — is
// derived, never written back. See SKILL.md for the model and the status state
// machine; the allowed transitions are encoded in TRANSITIONS below.
//
// Commands: init, mark, reindex, check, triage.
// Layout: lib/markdown.mjs (read frontmatter) · lib/paths.mjs (on-disk layout) ·
//   lib/features.mjs (model + derivations) · lib/transitions.mjs (status state
//   machine) · lib/render.mjs (index.md) · lib/write.mjs (feature.md writes) ·
//   this file (CLI: parse, dispatch, format/print).
//
// Each command is a pure function returning `{ code, stdout?, stderr? }`; only
// the entry point at the bottom prints and exits, so commands are unit-testable
// without spawning a subprocess.
//
// Usage
//   featuremgr init   <slug> --title <title> [--purpose <text>] [--docs <dir>]
//   featuremgr mark   <slug> <status> [--docs <dir>]
//   featuremgr reindex [--docs <dir>] [--out <file>]
//   featuremgr check   [--docs <dir>]
//   featuremgr triage  [--docs <dir>]

import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs as parseNodeArgs } from 'node:util'
import { loadFeatures, validateFeatures, triageView, ambientCounts, artifactNames, INTENTS } from './lib/features.mjs'
import { renderIndex } from './lib/render.mjs'
import { createFeatureFile, patchFrontmatter } from './lib/write.mjs'
import { evaluateTransition } from './lib/transitions.mjs'
import { featureFile } from './lib/paths.mjs'

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

// (Status reads and the transition state machine live in lib/transitions.mjs;
// plan-completion parsing lives in lib/features.mjs.)

// ---- commands -----------------------------------------------------------
// Each command returns `{ code, stdout?, stderr? }`; the entry point prints and
// exits. Commands may write to disk (index.md, feature.md) but never print.

export function reindex(docsDir, outFile) {
  const features = loadFeatures(docsDir)
  const { content, summary } = renderIndex(features)

  const out = outFile || join(docsDir, 'index.md')
  writeFileSync(out, content)

  const { finishable, stale } = ambientCounts(features)
  const stdout = [`reindex: ${features.length} feature(s) -> ${out}`]
  if (summary.length) stdout.push(...summary)
  stdout.push(`${finishable} finishable, ${stale} stale`)
  return { code: 0, stdout }
}

export function check(docsDir) {
  const features = loadFeatures(docsDir)
  const problems = validateFeatures(features)

  if (problems.length === 0) {
    return { code: 0, stdout: [`check: ${features.length} feature(s), no problems`] }
  }
  const stdout = [`check: ${features.length} feature(s), ${problems.length} problem(s):`]
  for (const p of problems.sort()) stdout.push(`  - ${p}`)
  return { code: 1, stdout }
}

export function triage(docsDir) {
  const features = loadFeatures(docsDir)
  const bands = triageView(features)
  const total = bands.reduce((n, band) => n + band.entries.length, 0)

  const stdout = [`triage: ${total} open feature(s)`]
  for (const band of bands) {
    stdout.push(`\n## ${band.label}`)
    for (const { feature, ageDays, actionable } of band.entries) {
      const artifacts = artifactNames(feature).join(', ') || 'no artifacts'
      const plan = feature.planCompletion
        ? `plan ${feature.planCompletion.checked}/${feature.planCompletion.total}`
        : 'no plan phases'
      const flag = actionable ? ' [actionable]' : ''
      const archPending = feature.archMerged === null ? ' [arch-pending]' : ''
      stdout.push(
        `  - ${feature.slug} (${feature.status}) — ${artifacts} — ${plan} — ${Math.floor(ageDays)}d${flag}${archPending}`,
      )
    }
  }
  return { code: 0, stdout }
}

export function cmdInit(positionals, opts) {
  const [slug] = positionals
  if (!slug) {
    return { code: 2, stderr: ['usage: featuremgr init <slug> --title <title> [--purpose <text>] [--docs <dir>]'] }
  }
  if (!opts.title) {
    return { code: 2, stderr: ['featuremgr init: --title is required'] }
  }

  const path = featureFile(opts.docs, slug)
  try {
    createFeatureFile(path, { title: opts.title, purpose: opts.purpose })
  } catch (err) {
    if (err.code === 'EEXIST') {
      return { code: 1, stderr: [`featuremgr init: ${err.message}`] }
    }
    throw err
  }
  return { code: 0, stdout: [`init: created features/${slug}/feature.md (status: draft)`] }
}

// Allowed transitions and their preconditions live in lib/transitions.mjs;
// cmdMark just asks evaluateTransition what to do and applies it.
export function cmdMark(positionals, opts) {
  const [slug, toStatus] = positionals
  if (!slug || !toStatus) {
    return { code: 2, stderr: ['usage: featuremgr mark <slug> <status> [--docs <dir>]'] }
  }
  if (!INTENTS.includes(toStatus)) {
    return { code: 2, stderr: [`featuremgr mark: unknown status '${toStatus}' (allowed: ${INTENTS.join(', ')})`] }
  }

  const decision = evaluateTransition(opts.docs, slug, toStatus)
  if (decision.action === 'reject') {
    return { code: 1, stderr: [`featuremgr mark: ${decision.error}`] }
  }
  if (decision.action === 'noop') {
    return { code: 0, stdout: [`mark: features/${slug} already has status '${decision.status}' — nothing to do`] }
  }

  patchFrontmatter(featureFile(opts.docs, slug), { status: toStatus })
  return { code: 0, stdout: [`mark: features/${slug} ${decision.from} -> ${decision.to}`] }
}

// ---- main -------------------------------------------------------------------

// Dispatch a parsed command to its handler. Returns the command result
// `{ code, stdout?, stderr? }`; unknown commands yield the top-level usage.
export function dispatch(cmd, positionals, opts) {
  switch (cmd) {
    case 'init':
      return cmdInit(positionals, opts)
    case 'mark':
      return cmdMark(positionals, opts)
    case 'reindex':
      return reindex(opts.docs, opts.out)
    case 'check':
      return check(opts.docs)
    case 'triage':
      return triage(opts.docs)
    default:
      return { code: 2, stderr: ['usage: featuremgr <init|mark|reindex|check|triage> [--docs <dir>] [--out <file>]'] }
  }
}

// Run only when invoked as the entry script, so tests can import the commands
// above without triggering argv parsing or process.exit.
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { cmd, positionals, opts } = parseArgs(process.argv.slice(2))
  const result = dispatch(cmd, positionals, opts)
  for (const line of result.stdout ?? []) console.log(line)
  for (const line of result.stderr ?? []) console.error(line)
  process.exit(result.code ?? 0)
}
