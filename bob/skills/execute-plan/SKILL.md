---
name: execute-plan
description: >-
  Execute an implementation plan phase-by-phase, marking progress in the plan
  document
argument-hint: <feature.md>
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

### Step 2: Determine Starting Point

Scan the `### Phase` headings under `## Phases` for their marker emoji:

- `✅` — phase completed, skip it
- `⏳` — phase started but not finished (e.g. an interrupted run), resume here
- no marker — not started

If every phase has `✅`, inform the user the plan is complete and exit.
If a phase has `⏳`, resume from it — re-verify its partial work before continuing, since it
may have been interrupted mid-flight.
Otherwise, start from the first unmarked phase.

### Step 3: Execute Each Phase

Before the first phase this session, set the feature's status to `active`
(see Feature lifecycle below).

For each phase, in order:

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
5. **Mark completed** — Replace `⏳` with `✅` and the date, then reindex:
   ```
   ### Phase 2: Core Logic ✅ 2026-07-19
   ```
6. **Summarize** — Brief summary of what was done in this phase

### Step 4: After All Phases

When all phases are marked `✅`:

1. Run final validation (tests, build, lint). **`done` requires this to pass** — all phases
   `✅` plus green validation is the bar.
2. Mark the feature done and rebuild the index (run from the repo root):
   ```
   node ../featuremgr/featuremgr.mjs mark <slug> done
   node ../featuremgr/featuremgr.mjs reindex
   ```
   This is the normal success terminal — the skill that executed and validated the work owns
   the close. Do **not** call `mark abandoned`; that is triage's transition.
3. Summarize total work done

## Progress Marker Format

The `## Phases` section is a strict contract between `create-plan`, `execute-plan`, and
`featuremgr` — see [plan-phases](../featuremgr/plan-phases.md) for the full grammar. The
two rules that matter while executing:

- Use `⏳` for in-progress and `✅` for done — these are what `featuremgr` parses. Place them
  at the end of the heading before any date (e.g. `### Phase 2: Name ✅ 2026-07-19`).
- Leave each phase's goal/deliverable prose untouched — only the heading marker changes.

## Execution Rules

**Mark progress, don't skip it.** The primary purpose of this command is ensuring progress
is tracked in the plan document. Never skip marking a phase (`⏳` on start, `✅` on finish)
before moving to the next.

**Validate before marking `✅`.** A phase is complete when its deliverable/validation
criteria from the plan are met, not just when you've written code.

## Resumption

This command is designed to be invoked multiple times on the same plan:

- First invocation: starts from Phase 1
- Subsequent invocations: reads progress markers and resumes from last incomplete phase
- If the plan is fully completed, it reports that and exits

This makes it safe to interrupt and resume long plans across multiple sessions.

## Feature lifecycle (featuremgr)

A plan lives in a feature directory `docs/features/<slug>/`. The feature's status is managed
exclusively by `featuremgr`. This skill calls it for two transitions (run from the repo root;
`featuremgr` is a sibling skill under the same `skills/` root):

- **On starting execution** — promote from `draft` to `active` if needed:
  ```
  node ../featuremgr/featuremgr.mjs mark <slug> active
  ```
  (`mark` is a no-op if already `active`.)

- **On validated completion** — when every phase is `✅` and final validation passes:
  ```
  node ../featuremgr/featuremgr.mjs mark <slug> done
  node ../featuremgr/featuremgr.mjs reindex
  ```
  The executor holds the ground truth that the work landed, so it owns the success close.
  `mark done` enforces the precondition — it will fail if any phase lacks `✅`, which is a
  signal that validation was called prematurely.

Do **not** call `mark abandoned` — that is triage's transition. Audit at any time with
`node ../featuremgr/featuremgr.mjs check`.
