---
name: reconcile-arch
version: "2.0"
description: >-
  Transfer architectural decisions from a completed feature into docs/architecture,
  then stamp arch-merged on the feature record. Use when a feature's plan is complete
  and its decisions have not yet been absorbed into the architecture docs.
argument-hint: <feature-slug>
metadata:
  disable-model-invocation: false
---

## Task

Run an architecture reconciliation session for the feature at `docs/features/<slug>/`.
Extract its captured architectural decisions, compare them against the project's
`docs/architecture/` tree, present a gap analysis in chat, collaborate with the human
on targeted updates, then stamp `arch-merged: <today>` on `feature.md` and refresh
the index.

## Role

You are the architecture keeper. Your job is to close the loop between completed
features and the living architecture docs: decisions that shaped the system should
be reflected in `docs/architecture/`, not orphaned in proposal/plan files. You
surface what is missing, propose where it belongs, and write nothing without the
human's confirmation.

## Why this exists

Features are designed and executed in focused slices, but `docs/architecture` must
accumulate the decisions across all of them. Without a scaffolded step, either the
agent trawls the entire codebase cold or the step is skipped. This skill bounds the
work to one feature at a time, uses its captured artifacts as the scope signal, and
leaves a `arch-merged` timestamp so future loops know which features have been
absorbed.

## Workflow

### Step 1: Read the feature artifacts

The feature directory is `docs/features/<slug>/`. Read, in this order:

1. **`proposal.md`** — primary source of architectural decisions, rationale, and
   trade-offs. Read it in full.
2. **`plan.md`** (Architecture Impact section) — the actionable translation of those
   decisions. Read the `## Architecture Impact` section if present; skim the rest for
   decisions that may not appear in the proposal.
3. **Git diff** (optional, secondary) — if the human asks, or if the proposal/plan
   feel thin, run a scoped diff to catch decisions that landed in code without a design
   record:

   ```
   git diff main -- ':(exclude)docs/' ':(exclude)*.md'
   ```

   Look for new interfaces, new components, changed coordination patterns. Ignore
   implementation churn.

If neither `proposal.md` nor `plan.md` exists, tell the human and stop.

### Step 2: Map the architecture tree

Read `docs/architecture/README.md` (or equivalent top-level entry point) to understand
the existing structure. If no README exists, list the directory:

```
ls docs/architecture/
```

Read the top-level entry point, then skim any section files that are candidates for
receiving new content. You do not need to read the whole tree exhaustively — read
enough to place each decision.

### Step 3: Produce a gap analysis

For each architectural decision extracted from the feature's artifacts:

- Identify which existing architecture file and section it belongs in (or state that a
  new section is warranted).
- State whether the decision is already captured there (accurately), partially present,
  or absent.

Format the gap analysis as a structured list in chat:

```
1. [Decision summary]
   → file: docs/architecture/<file>.md, section: <heading>
   → status: absent | partially present | already captured
   → proposed addition: <one or two sentences>
```

Emit the full list before writing anything. Do not auto-patch architecture files.

### Step 4: Write targeted updates (with human present)

For each absent or partially-present decision, propose the exact text addition to the
human. Write only what the human confirms. Architecture docs are authored prose —
silent or speculative updates corrupt intent.

When writing, add to the most specific existing section that fits. Prefer amending an
existing paragraph over creating a new heading. Only create a new heading when the
decision genuinely introduces a concept that has no existing anchor.

### Step 5: Stamp `arch-merged` and reindex

After the human confirms that all warranted updates have been applied, write the
provenance timestamp to `feature.md`:

1. Open `docs/features/<slug>/feature.md` and add (or update) the `arch-merged` field
   in the frontmatter:

   ```yaml
   arch-merged: <YYYY-MM-DD>   # today's date
   ```

2. Refresh the index (run from the repo root; `featuremgr` is a sibling skill under the
   same `skills/` root — resolve the path from wherever this `SKILL.md` was loaded):

   ```
   node ../featuremgr/featuremgr.mjs reindex
   ```

3. Confirm to the human: "arch-merged stamped; index refreshed."

## Rules

- **Gap analysis first, edits second.** Always present the full analysis before writing
  anything to architecture files. The human must see the complete picture before
  confirming.
- **Architecture files only.** Do not edit `proposal.md`, `plan.md`, `feature.md`
  (except the `arch-merged` stamp), or any source code.
- **`arch-merged` is the only frontmatter write.** The skill touches exactly one field
  on exactly one file (`feature.md`). It does not change `status`, titles, or any other
  field.
- **Do not set `status: done`.** Arch reconciliation is orthogonal to the feature
  lifecycle. A feature can be reconciled before or after it reaches `done`; this skill
  does not decide that.
- **"Already captured" decisions need no action.** If the architecture already reflects
  a decision accurately, say so in the gap analysis and move on. Do not re-add content
  that is already there.
- **Structure is discovered, not prescribed.** Each project's `docs/architecture/` tree
  has its own shape. Map to it; do not impose a canonical layout.
- **Git diff is a secondary confirmation, not the driver.** The non-code artifacts
  (proposal, plan) drive the analysis. The diff catches what slipped through without a
  design record.
