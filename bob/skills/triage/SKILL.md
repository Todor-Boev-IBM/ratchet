---
name: triage
description: Reconcile open features — decide done or abandoned per feature
argument-hint: '[docs-dir]'
metadata:
  disable-model-invocation: true
---

## Task

Run a triage session over the open features in a `docs/features/` tree: review each open
feature oldest-first and decide whether it stays open, is `done`, or is `abandoned`. Write the
decision to each feature's `feature.md`, then refresh the index.

## Role

You are the feature portfolio's reconciler. Triage is the single place the closing
`done`/`abandoned` decisions are made. `featuremgr` derives what is finishable or stale but never
closes anything itself — that judgment is made here, with the human present.

## Why this exists

Features accumulate across parallel, out-of-order flows. `create-proposal` parks them,
`create-plan`/`execute-plan` make them active and mark phases done, but nothing ever retires
them. Without triage the portfolio only grows. A plan with all phases done marks a feature
_finishable_, not `done` — the human confirms the close here.

## Workflow

### Step 1: Gather the open features

Run the triage view (from the repo root; pass the docs dir if not the default `docs`). The
path below is relative to this skill's own directory (`featuremgr` is a sibling skill under the
same `skills/` root) — resolve it from wherever this `SKILL.md` was loaded from, not from the
shell's current working directory:

```
node ../featuremgr/featuremgr.mjs triage --docs <docs-dir>
```

This prints the open features — `status: draft` or `active` only — ordered oldest-touched
first, grouped into weekly age bands. Each line carries the derived facts: which artifacts
exist, plan completion (`plan C/T`), age in days, and an `[actionable]` flag (set when the
plan's phases are all done, or the feature is at least a week untouched).

If there are no open features, report that and stop.

### Step 2: Walk features oldest-first

Go through the features in the order printed — stalest first. For each feature, read its
`feature.md` (and skim `proposal.md` / `plan.md` if you need context) and present a short
summary to the user: the title, its status, what artifacts exist, plan completion, and how
long it has sat untouched.

Then ask the user to choose one of:

- **keep** — leave the feature open. Its `status` is unchanged. Use this for work that is
  genuinely still in flight. (If a `draft` feature is now being actively worked, the user may
  ask to promote it to `active` — that is a legitimate keep-variant.)
- **done** — the feature is complete. Set `status: done`. Prefer this when the plan's phases
  are all `✅` (`[actionable]` via completion), but confirm with the user regardless.
- **abandoned** — the feature will not be pursued. Set `status: abandoned`.

Ask one feature at a time; do not batch. Lead with a recommendation for `[actionable]`
features (finishable → suggest `done`; long-stale with no progress → surface `abandoned` as an
option), but the user decides.

### Step 3: Apply decisions

For each `done`/`abandoned` decision, edit only the `status` field in that feature's
`feature.md`. Change nothing else — not the title, not the body, not the plan's phases.
A `keep` (with no promotion) writes nothing.

### Step 4: Refresh the index

After all decisions are applied, refresh the index (from the repo root; same sibling-relative
path as Step 1):

```
node ../featuremgr/featuremgr.mjs reindex
```

Then summarize: how many features were kept, closed as `done`, and abandoned.

## Rules

- **Triage is the only place `done`/`abandoned` are written.** `create-*` and `execute-plan`
  never set them; do not add that logic elsewhere.
- **`status` is the only field you touch.** Everything else on a feature is authored content
  or derived by `featuremgr` — never hand-edit derived facts or plan progress here.
- **Completion is a prompt, not an auto-close.** A fully ticked checklist means _finishable_;
  the user still confirms `done`.
- **Do not invent statuses.** The closed vocabulary is `draft`, `active`, `done`, `abandoned`.
