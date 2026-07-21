---
name: execute-plan
description: >-
  Execute an implementation plan phase-by-phase, marking progress in the plan
  document
argument-hint: <plan-file-path>
metadata:
  disable-model-invocation: true
---

## Task

Execute the implementation plan at $1.

Start from the first incomplete phase (or resume where progress markers indicate).

## Role

You are an implementation executor. You receive a plan document (typically created by the `/create-plan` command)
and execute it phase by phase, doing the actual coding work. After completing each phase, you mark progress
directly in the plan document so work can be resumed across sessions.

## Workflow

### Step 1: Read and Understand the Plan

1. Read the plan document completely
2. Identify all phases — the `### Phase <number>: Name` sub-headings under the `## Phases`
   section (names may carry subphase suffixes like `2a`, `3.1`)
3. Read each phase heading's status marker to determine where to resume
4. Read architecture docs, project rules, and other references mentioned in the plan

### Step 2: Determine Starting Point

Scan the `### Phase` headings under `## Phases` for their status token:

- `[done]` (conventionally written `[done] ✅`) — phase completed, skip it
- `[wip]` (conventionally written `[wip] ⏳`) — phase started but not finished (e.g. an interrupted run), resume here
- no token — not started

The text tokens (`[done]`, `[wip]`) are what the tooling looks for; the emoji are decorative
and purely for human readability. Write whichever representation you prefer, but always include
the text token so `featuremgr` can parse it.

If every phase has `[done]`, inform the user the plan is complete and exit.
If a phase has `[wip]`, resume from it — re-verify its partial work before continuing, since it
may have been interrupted mid-flight.
Otherwise, start from the first unmarked phase.

### Step 3: Execute Each Phase

Before the first phase this session, set the feature's status to `active`
(see Feature lifecycle below).

For each phase, in order:

1. **Announce** — Tell the user which phase you're starting and its goals
2. **Mark in-progress** — Append `[wip] ⏳` to the phase heading in `plan.md`:
   ```
   ### Phase 2: Core Logic [wip] ⏳
   ```
   This is the crash-protection marker: if the run is interrupted, the `[wip]` token records
   exactly which phase was mid-flight so the next invocation resumes there. The `⏳` is
   decorative — you may omit it, but it helps at a glance.
3. **Implement** — Do the actual work:
   - Read relevant source files to understand current state
   - Make code changes following the plan's guidance
   - Run tests, linters, or builds as appropriate
   - Fix issues that arise during implementation
4. **Validate** — Check the phase's completion criteria from the plan
5. **Mark completed** — Replace `[wip] ⏳` with `[done] ✅` and the date, then reindex:
   ```
   ### Phase 2: Core Logic [done] ✅ 2026-07-19
   ```
6. **Summarize** — Brief summary of what was done in this phase

### Step 4: After All Phases

When all phases are marked `[done]`:

1. Run final validation (tests, build, lint)
2. Refresh the index (see Feature lifecycle below). Do **not** set the feature's status to
   `done` — a fully completed plan makes the feature _finishable_, but the human confirms
   `done` during Triage. Leave `status: active`.
3. Summarize total work done

## Progress Marker Format

The `## Phases` section is a strict contract with the `create-plan` skill: each phase is a
`### Phase` sub-heading carrying a status token.

```markdown
## Phases

### Phase 1: Foundation [done] ✅ 2026-07-19

Goals:

- ...

### Phase 2: Core Logic [wip] ⏳

Goals:

- ...

### Phase 3: Polish
```

Tokens: `[done]` (with optional `✅` and date) = done, `[wip]` (with optional `⏳`) = in
progress (the crash-recovery point), no token = not started. The emoji are decorative — `featuremgr`
only reads the text tokens. The goal/deliverable prose lives under each heading and is left
untouched. `featuremgr` counts `[done]` phases against the total number of `### Phase` headings as
the feature's completion.

## Execution Rules

**Mark progress, don't skip it.** The primary purpose of this command is ensuring progress
is tracked in the plan document. Never skip marking a phase (`[wip]` on start, `[done]` on
finish) before moving to the next.

**Validate before marking `[done]`.** A phase is complete when its deliverable/validation
criteria from the plan are met, not just when you've written code.

## Resumption

This command is designed to be invoked multiple times on the same plan:

- First invocation: starts from Phase 1
- Subsequent invocations: reads progress markers and resumes from last incomplete phase
- If the plan is fully completed, it reports that and exits

This makes it safe to interrupt and resume long plans across multiple sessions.

## Feature lifecycle (featuremgr)

A plan lives in a feature directory `docs/features/<slug>/`. The feature's only stored state
is the `status` field on `feature.md`; plan progress is the `## Phases` section's per-phase
`[done]`/`[wip]` text tokens (optionally followed by `✅`/`⏳` for readability), which the
index derives — it is never copied into frontmatter.

- Statuses: `draft → active → done` (or `abandoned`). Only `draft` and `active` are open.
- On starting execution, set `feature.md`'s `status: active` (promoting from `draft` if
  needed). This is the only frontmatter write this skill makes.
- Do **not** set `status: done` or `abandoned`. Completing the phases marks the feature
  _finishable_; the human confirms `done` (or `abandoned`) during Triage.
- After marking a phase `✅` or changing status, refresh the index (run from the repo root):

  ```
  node ../featuremgr/featuremgr.mjs reindex
  ```

  The path is relative to this skill's own directory (`featuremgr` is a sibling skill under the
  same `skills/` root); resolve it from wherever this `SKILL.md` was loaded from, not from
  the shell's current working directory.

- Audit at any time with `node ../featuremgr/featuremgr.mjs check` (same sibling-relative path).
