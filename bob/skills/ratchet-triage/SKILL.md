---
name: ratchet-triage
description: Prune open features — abandon dead ones and close stragglers execute-plan left open
argument-hint: '[docs-dir]'
metadata:
  disable-model-invocation: true
---

## Task

Run a triage session over the open features in a `docs/features/` tree: review each open
feature oldest-first and decide whether it stays open, is `abandoned`, or is `done`. Write
the decision to each feature's `feature.md`, then refresh the index.

## Role

You are the feature portfolio's pruner. `ratchet-execute-plan` parks completed features at
`in-review` after all phases are validated — triage is where those features are ratified
as `done`. Triage also retires dead work as `abandoned`. `ratchet-featuremgr` derives what is
finishable or stale but never closes anything itself — that judgment is made here, with
the human present.

## Why this exists

Features accumulate across parallel, out-of-order flows. `ratchet-create-proposal` parks them as
`draft`, `ratchet-create-plan` makes them `active`, and `ratchet-execute-plan` parks validated work at
`in-review`. Triage closes the loop: it ratifies `in-review` features as `done` and
retires proposals that never became plans, plans that crashed mid-flight, and work that
was quietly dropped. Without triage the portfolio only grows stale or stuck entries.

## Feature lifecycle

The full status state machine is enforced by `featuremgr mark`. The essentials for this skill:

- Triage sees the **open** statuses: `draft`, `active`, and `in-review`.
- Triage owns **`done`** for `in-review` features (the normal close after human ratification)
  and **`abandoned`** for any open feature that should not be pursued.
- `done` and `abandoned` are terminal and **immutable**: `featuremgr mark` will reject any
  attempt to re-mark them. More work is a new slug referencing the old one, never a reopen.

## Workflow

### Step 1: Gather the open features

Run the triage view from the repo root (pass the docs dir if not the default `docs`). The
path is relative to this skill's own directory — `ratchet-featuremgr` is a sibling skill under the
same `skills/` root:

```
../ratchet-featuremgr/featuremgr.mjs triage --docs <docs-dir>
```

This prints the open features — `status: draft`, `active`, or `in-review` — ordered
oldest-touched first, grouped into weekly age bands. Each line carries the derived facts: which artifacts
exist, plan completion (`plan C/T`), age in days, an `[actionable]` flag (set when the plan's
phases are all done, or the feature is at least a week untouched), and `[arch-pending]` until
`ratchet-merge-arch` has stamped `arch-merged`.

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
  plan, or a rejected `in-review`. Set `status: abandoned`.
- **done** — the work is ratified. Use this for `in-review` features after the human confirms
  the execution landed correctly. Also use for the rare straggler `active` feature whose
  `ratchet-execute-plan` run was interrupted before it could park at `in-review` — confirm phases are
  all `✅` and validation passed before applying. Never use `done` to bless unexecuted work.

Ask one feature at a time; do not batch. Lead with a recommendation for `[actionable]`
features (finishable-but-unstamped → suggest the `done` mop-up; long-stale with no progress →
surface `abandoned`), but the user decides.

### Step 3: Apply decisions

For each `done`/`abandoned` decision, call `featuremgr mark` (run from the repo root;
`ratchet-featuremgr` is a sibling skill under the same `skills/` root):

```
../ratchet-featuremgr/featuremgr.mjs mark <slug> done
# or:
../ratchet-featuremgr/featuremgr.mjs mark <slug> abandoned
```

`in-review → done` has no doc precondition (phases were proven complete when `ratchet-execute-plan`
parked the feature). For a straggler `active` feature being closed as `done`, `mark` will
enforce the all-phases-`✅` precondition and fail if it isn't met — preventing accidental
blessing of unexecuted work. A `keep` (with no promotion) calls nothing.

### Step 4: Refresh the index

After all decisions are applied (from the repo root; same sibling-relative path as Step 1):

```
../ratchet-featuremgr/featuremgr.mjs reindex
```

Then summarize: how many features were kept, closed as `done`, and abandoned.

## Rules

- **Triage owns `done` for `in-review` features and `abandoned` for any open feature.**
  `ratchet-execute-plan` parks work at `in-review` after validation; triage ratifies it. For a
  straggler `active` feature, `done` is mop-up only — `featuremgr mark` will reject it if
  phases are incomplete, preventing accidental blessing of unexecuted work.
- **Never touch `feature.md` directly.** All status changes go through `featuremgr mark`.
  Plan progress, titles, and body content are other skills' concerns — never hand-edit them
  during triage.
- **A finishable flag is a prompt, not proof.** For straggler `active` features, confirm
  phases are all `✅` and validation actually passed before calling `mark done`.
- **Terminal statuses are immutable.** `featuremgr mark` will reject any re-mark of
  `done`/`abandoned`. More work is a new slug.
