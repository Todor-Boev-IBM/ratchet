---
name: ratchet-execute-plan
description: >-
  Execute an implementation plan phase-by-phase, marking progress in the plan
  document
argument-hint: <feature.md> [phase selector]
metadata:
  disable-model-invocation: true
---

## Task

`$1` must point to an existing `feature.md`. Execute the implementation plan found in
`plan.md` in the same directory (the parent of `$1`).

**Precondition:** if `$1` is missing, is not an existing `feature.md`, or that directory has
no `plan.md` with a `## Phases` section, **STOP** and report the problem — do not search other
features for a plan and do not create one.

Start from the first incomplete phase (or resume where progress markers indicate).

The invocation may also carry a **phase selector** — explicit (`phase 3`, `phase 2a`) or
relative (`next phase`). A selector means **run exactly that one phase, then stop for review**.
With no selector, run every remaining phase to completion. Step 2 resolves both.

## Role

You are an implementation executor. You receive a plan document (typically created by the `/create-plan` command)
and execute it phase by phase, doing the actual coding work. After completing each phase, you mark progress
directly in the plan document so work can be resumed across sessions.

## Workflow

### Step 1: Read and Understand the Plan

1. Resolve `plan.md` from `$1`'s directory (the parent of the given `feature.md`), then read
   it completely
2. Identify all phases — the `### Phase <number>: Name` sub-headings under the `## Phases`
   section (names may carry subphase suffixes like `2a`, `3.1`)
3. Read each phase heading's status marker to determine where to resume
4. Read architecture docs, project rules, and other references mentioned in the plan

### Step 2: Determine Scope and Starting Point

Scan the `### Phase` headings under `## Phases` for their marker emoji:

- `✅` — phase completed, skip it
- `⏳` — phase started but not finished (e.g. an interrupted run), resume here
- no marker — not started

**Starting phase.** If the invocation named an explicit phase, start there. Otherwise — including
a relative selector like `next phase` — derive it:

If every phase has `✅`, inform the user the plan is complete and exit.
If a phase has `⏳`, resume from it — re-verify its partial work before continuing, since it
may have been interrupted mid-flight.
Otherwise, start from the first unmarked phase.

**Scope.** A separate decision from the starting phase, and the one that governs when you stop:

- **A selector was given** — explicit (`phase 3`) _or_ relative (`next phase`) — the scope is
  **exactly one phase**. Resolving `next` into a concrete phase number does **not** widen the
  scope: execute that single phase, then stop for review.
- **No selector** — the scope is every remaining phase, run to completion.

Announce the resolved scope along with the first phase, so the user can correct you before any
work starts.

### Step 3: Execute Each Phase

Before the first phase this session, promote the feature to `active` (run from the repo root;
the path is relative to this skill's own directory — `ratchet-featuremgr` is a sibling skill under the
same `skills/` root). `mark` is a no-op if it is already `active`:

```
node ../ratchet-featuremgr/featuremgr.mjs mark <slug> active
```

For each phase in scope, in order:

1. **Announce** — Tell the user which phase you're starting and its goals
2. **Mark in-progress** — Append `⏳` to the phase heading in `plan.md`:
   ```
   ### Phase 2: Core Logic ⏳
   ```
   This is the crash-protection marker: if the run is interrupted, the `⏳` emoji records
   exactly which phase was mid-flight so the next invocation resumes there.
3. **Implement** — Do the actual work:
   - Read relevant source files to understand current state
   - Make code changes following the plan's guidance
   - Run tests, linters, or builds as appropriate
   - Fix issues that arise during implementation
4. **Validate** — Check the phase's completion criteria from the plan
5. **Mark completed** — Replace `⏳` with `✅` and the date:
   ```
   ### Phase 2: Core Logic ✅ 2026-07-19
   ```
   then refresh the index:
   ```
   node ../ratchet-featuremgr/featuremgr.mjs reindex
   ```
6. **Summarize** — Brief summary of what was done in this phase

**If the scope is a single phase, do not roll into the next phase.** If phases remain, stop
here — report what was done, name the phase that comes next so the user can resume, and hand
back for review. But if that phase was the last one and every phase is now `✅`, continue to
Step 4: finishing the plan always parks it for review, no matter how execution was scoped.

### Step 4: After All Phases

Run this step whenever every phase is marked `✅`, **regardless of how execution was scoped** —
a single-phase run that completes the final phase parks the plan for review just like a
run-to-completion does. If phases remain unfinished, skip this step.

When all phases are marked `✅`:

1. Run final validation (tests, build, lint). **`in-review` requires this to pass** — all
   phases `✅` plus green validation is the bar.
2. Park the feature at `in-review` and rebuild the index (run from the repo root):
   ```
   ../ratchet-featuremgr/featuremgr.mjs mark <slug> in-review
   ../ratchet-featuremgr/featuremgr.mjs reindex
   ```
   This hands off to the human for sign-off. Tell the user: "execution complete — run
   `/ratchet-triage` to review and close this feature as `done`."
   `mark in-review` enforces the precondition itself — it fails if any phase lacks `✅`, which
   is a signal that validation was called prematurely.
3. Summarize total work done

Audit the feature tree at any time with `../ratchet-featuremgr/featuremgr.mjs check`.

## Progress Marker Format

The `## Phases` section is a strict contract between `ratchet-create-plan`, `ratchet-execute-plan`, and
`ratchet-featuremgr` — see [plan-phases](../ratchet-featuremgr/plan-phases.md) for the full grammar. Beyond
the `⏳`/`✅` markers used in Step 3, one rule matters while executing: leave each phase's
goal/deliverable prose untouched — only the heading marker changes.

## Execution Rule

**Mark progress, don't skip it.** Tracking progress in the plan document is this command's
primary purpose. Never move to the next phase without marking the current one (`⏳` on start,
`✅` on finish), and never mark `✅` before the plan's validation criteria actually pass.
