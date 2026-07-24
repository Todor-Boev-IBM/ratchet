// lib/transitions.mjs — the feature status state machine.
//
// The only lifecycle rules featuremgr enforces: which status a feature may move
// to next, and the plan.md preconditions that gate certain moves. Pure model
// logic — it reads feature.md / plan.md but never writes; the CLI applies the
// chosen change via lib/write.mjs. See SKILL.md for the human-facing description.
//
//   draft     -> active      plan.md must exist with a ## Phases section
//   draft     -> abandoned   (no precondition)
//   active    -> in-review   all ### Phase headings in plan.md carry ✅
//   active    -> abandoned   (no precondition)
//   in-review -> done        (no precondition; human ratifies via triage)
//   in-review -> abandoned   (no precondition)
//   done, abandoned -> any   rejected — terminal statuses are immutable

import { readMarkdown } from './markdown.mjs'
import { featureFile, planFile } from './paths.mjs'
import { derivePlanCompletion } from './features.mjs'

// --- plan preconditions ------------------------------------------------------

// Load plan.md's phase completion for <slug>. Returns `{ completion, error }`:
// `error` is set when plan.md is missing entirely; otherwise `completion` is
// `{ checked, total }` or null (no ## Phases section with phase headings).
function readPlanCompletion(docsDir, slug) {
  const plan = readMarkdown(planFile(docsDir, slug))
  if (!plan) return { completion: null, error: `plan.md not found: features/${slug}/plan.md` }
  return { completion: derivePlanCompletion(plan.body), error: null }
}

// Guard: plan.md exists and has a ## Phases section with phase headings.
// Returns an error string or null.
function checkPlanReady(docsDir, slug) {
  const { completion, error } = readPlanCompletion(docsDir, slug)
  if (error) return error
  if (completion === null) {
    return `plan.md has no ## Phases section with phase headings: features/${slug}/plan.md`
  }
  return null
}

// Guard: every phase in plan.md carries ✅. Returns an error string or null.
function checkPlanDone(docsDir, slug) {
  const { completion, error } = readPlanCompletion(docsDir, slug)
  if (error) return error
  if (completion === null) {
    return `plan.md has no ## Phases section: features/${slug}/plan.md`
  }
  if (completion.checked < completion.total) {
    return `plan not complete: ${completion.checked}/${completion.total} phases done in features/${slug}/plan.md`
  }
  return null
}

// --- state machine -----------------------------------------------------------

// Allowed transitions. Each entry is [fromStatus, toStatus, checkFn].
// checkFn(docsDir, slug) returns a precondition-error string or null.
const TRANSITIONS = [
  ['draft', 'active', checkPlanReady],
  ['draft', 'abandoned', null],
  ['active', 'in-review', checkPlanDone], // execution parks here after all phases ✅
  ['active', 'abandoned', null],
  ['in-review', 'done', null], // human ratifies via triage
  ['in-review', 'abandoned', null],
]

const TERMINAL = new Set(['done', 'abandoned'])

// Read the current status of <slug>'s feature.md, or null if the file is
// missing or has no status field.
export function currentStatus(docsDir, slug) {
  return readMarkdown(featureFile(docsDir, slug))?.data.status || null
}

// Decide what marking <slug> to <toStatus> should do, without applying it.
// Returns exactly one of:
//   { action: 'apply',  from, to }   — caller should write status = to
//   { action: 'noop',   status }     — already at that status; nothing to do
//   { action: 'reject', error }      — not allowed, or a precondition failed
// `error` is a bare message with no program-name prefix — the CLI adds that.
export function evaluateTransition(docsDir, slug, toStatus) {
  const from = currentStatus(docsDir, slug)
  if (!from) {
    return { action: 'reject', error: `feature.md not found or has no status: features/${slug}/feature.md` }
  }
  if (TERMINAL.has(from)) {
    return { action: 'reject', error: `cannot transition from terminal status '${from}' (features/${slug})` }
  }
  if (from === toStatus) {
    return { action: 'noop', status: from }
  }
  const transition = TRANSITIONS.find(([f, t]) => f === from && t === toStatus)
  if (!transition) {
    return { action: 'reject', error: `invalid transition ${from} -> ${toStatus} for features/${slug}` }
  }
  const checkFn = transition[2]
  if (checkFn) {
    const err = checkFn(docsDir, slug)
    if (err) return { action: 'reject', error: `precondition failed — ${err}` }
  }
  return { action: 'apply', from, to: toStatus }
}
