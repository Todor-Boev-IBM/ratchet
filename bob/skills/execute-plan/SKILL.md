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
2. Identify all phases — headings matching `### Phase <number>: Name` (numbers may include
   subphase suffixes like `2a`, `3.1`, etc.)
3. Check for status suffixes to determine where to resume
4. Read architecture docs, project rules, and other references mentioned in the plan

### Step 2: Determine Starting Point

Scan `### Phase` headings for status suffixes:

- `✅` — phase completed, skip it
- `⏳` — phase in progress, resume here
- No suffix — not started

If all phases have `✅`, inform the user and exit.
If a phase has `⏳`, resume from that phase.
Otherwise, start from the first unmarked phase.

### Step 3: Execute Each Phase

Before the first phase this session, set the plan's frontmatter to `status: active`
(see Document lifecycle below).

For each phase, in order:

1. **Announce** — Tell the user which phase you're starting and its goals
2. **Mark in-progress** — Append `⏳` to the phase heading:
   ```
   ### Phase 2: Core Logic ⏳
   ```
3. **Implement** — Do the actual work:
   - Read relevant source files to understand current state
   - Make code changes following the plan's guidance
   - Run tests, linters, or builds as appropriate
   - Fix issues that arise during implementation
4. **Validate** — Check the phase's completion criteria from the plan
5. **Mark completed** — Replace `⏳` with `✅` and the date:
   ```
   ### Phase 2: Core Logic ✅ 2026-03-07
   ```
6. **Summarize** — Brief summary of what was done in this phase

### Step 4: After All Phases

When all phases are completed:

1. Run final validation (tests, build, lint)
2. Update the document lifecycle (see below): set the plan's frontmatter `status: done`;
   if the plan is paired with a proposal, set that proposal's frontmatter `status: implemented`;
   then refresh the index.
3. Summarize total work done

## Progress Marker Format

Phase headings follow a strict contract with the `/create-plan` command:

```markdown
### Phase 1: Foundation ✅ 2026-03-07

Goals:

- ...

### Phase 2: Core Logic ⏳

Goals:

- ...

### Phase 3: Polish
```

(no suffix = not started)

The `✅`/`⏳` suffixes are visible in rendered markdown so progress is scannable at a glance.

## Execution Rules

**Mark progress, don't skip it.** The primary purpose of this command is ensuring progress
is tracked in the plan document. Never skip marking a phase before moving to the next.

**Validate before marking complete.** A phase is complete when its deliverable/validation
criteria from the plan are met, not just when you've written code.

## Resumption

This command is designed to be invoked multiple times on the same plan:

- First invocation: starts from Phase 1
- Subsequent invocations: reads progress markers and resumes from last incomplete phase
- If the plan is fully completed, it reports that and exits

This makes it safe to interrupt and resume long plans across multiple sessions.

## Document lifecycle (docmgr)

Plans and proposals are tracked documents. Status lives in frontmatter; the index is generated.

- Plan status: `draft → active → done` (or `abandoned`).
- On starting execution, set the plan to `active`. On completion, set it to `done`.
- If the plan is paired with a proposal (its `proposal:` link, or a same-named proposal), a
  completed plan means that proposal is realized — set the proposal's frontmatter
  `status: implemented`.
- After any status change, refresh the index (run from the repo root):

  ```
  node ~/.bob/tools/docmgr.mjs reindex
  ```

- Audit at any time with `node ~/.bob/tools/docmgr.mjs check`.
