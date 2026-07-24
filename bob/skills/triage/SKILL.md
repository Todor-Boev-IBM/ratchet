---
name: triage
description: Prune open features — abandon dead ones and close stragglers execute-plan left open
argument-hint: '[docs-dir]'
metadata:
  disable-model-invocation: true
---

## Task

Run a triage session over the open features in a `docs/features/` tree: review each open
feature oldest-first and decide whether it stays open, is `abandoned`, or — for a straggler
`execute-plan` left unstamped — is `done`. Write the decision to each feature's `feature.md`,
then refresh the index.

## Role

You are the feature portfolio's pruner. In the normal flow `execute-plan` already closes a
feature as `done` the moment its plan validates — so triage is **not** where `done` is usually
decided. Triage exists to retire what execution never will: **`abandoned`** for crashed or
dead features, plus the occasional **`done`** straggler whose plan finished but whose stamp was
lost to an interrupted run. `featuremgr` derives what is finishable or stale but never closes
anything itself — that judgment is made here, with the human present.

## Why this exists

Features accumulate across parallel, out-of-order flows. `create-proposal` parks them as
`draft`, `create-plan` makes them `active`, and `execute-plan` closes the ones that run to a
validated finish as `done`. What nothing else retires: proposals that never became plans,
plans that crashed mid-flight, and work that was quietly dropped. Without triage the portfolio
only grows stale entries. Triage is the garbage collector for those.

## Feature lifecycle

The full status state machine is enforced by `featuremgr mark`. The essentials for this skill:

- Triage only ever sees the **open** statuses, `draft` and `active`.
- Triage owns **`abandoned`**, and calls `mark done` only as mop-up for a straggler
  `execute-plan` left unstamped — never to bless unexecuted work.
- `done` and `abandoned` are terminal and **immutable**: `featuremgr mark` will reject any
  attempt to re-mark them. More work is a new slug referencing the old one, never a reopen.

## Workflow

### Step 1: Gather the open features

Run the triage view from the repo root (pass the docs dir if not the default `docs`). Resolve
the sibling path from where this `SKILL.md` was loaded — see [cli](../featuremgr/cli.md)
for the path caveat and the full command set:

```
node ../featuremgr/featuremgr.mjs triage --docs <docs-dir>
```

This prints the open features — `status: draft` or `active` only — ordered oldest-touched
first, grouped into weekly age bands. Each line carries the derived facts: which artifacts
exist, plan completion (`plan C/T`), age in days, an `[actionable]` flag (set when the plan's
phases are all done, or the feature is at least a week untouched), and `[arch-pending]` until
`reconcile-arch` has stamped `arch-merged`.

If there are no open features, report that and stop.

### Step 2: Walk features oldest-first

Go through the features in the order printed — stalest first. For each feature, read its
`feature.md` (and skim `proposal.md` / `plan.md` if you need context) and present a short
summary to the user: the title, its status, what artifacts exist, plan completion, and how
long it has sat untouched.

Then ask the user to choose one of:

- **keep** — leave the feature open, `status` unchanged. Use this for work that is genuinely
  still in flight. (If a `draft` feature is now being actively worked, promoting it to
  `active` is a legitimate keep-variant.)
- **abandoned** — the feature will not be pursued: a dead proposal, a crashed or superseded
  plan. Set `status: abandoned`. This is triage's primary close.
- **done** — _mop-up only._ Normally `execute-plan` already set `done` when the plan
  validated, so a finishable feature surfacing here means its run was interrupted before
  stamping. Confirm the work truly landed (plan phases all `[done]`, validation green), then
  set `status: done`. Never use this to bless work that has not actually been executed and
  validated.

Ask one feature at a time; do not batch. Lead with a recommendation for `[actionable]`
features (finishable-but-unstamped → suggest the `done` mop-up; long-stale with no progress →
surface `abandoned`), but the user decides.

### Step 3: Apply decisions

For each `done`/`abandoned` decision, call `featuremgr mark` (run from the repo root;
`featuremgr` is a sibling skill under the same `skills/` root):

```
node ../featuremgr/featuremgr.mjs mark <slug> abandoned
# or, for a straggler mop-up:
node ../featuremgr/featuremgr.mjs mark <slug> done
```

`mark` will enforce preconditions — `mark done` fails if the plan phases are not all `✅`,
which prevents accidental blessing of unexecuted work. A `keep` (with no promotion) calls
nothing.

### Step 4: Refresh the index

After all decisions are applied (from the repo root; same sibling-relative path as Step 1):

```
node ../featuremgr/featuremgr.mjs reindex
```

Then summarize: how many features were kept, closed as `done`, and abandoned.

## Rules

- **Triage owns `abandoned`; `execute-plan` owns `done`.** Triage calls `mark done` only as
  mop-up for a straggler whose validated plan lost its stamp to an interrupted run — never to
  bless unexecuted work. `featuremgr mark` enforces this: `mark done` fails if phases are
  incomplete.
- **Never touch `feature.md` directly.** All status changes go through `featuremgr mark`.
  Plan progress, titles, and body content are other skills' concerns — never hand-edit them
  during triage.
- **A finishable flag is a prompt, not proof.** Confirm phases are all `✅` and validation
  actually passed before any `done` mop-up.
- **Terminal statuses are immutable.** `featuremgr mark` will reject any re-mark of
  `done`/`abandoned`. More work is a new slug.
