---
title: "Architecture Reconciliation Skill"
---

# Proposal: Architecture Reconciliation Skill

## Problem

The Ratchet Reconcile phase includes "syncing what changed back into `docs/architecture`" but this step is entirely unscaffolded. No skill, no focused scope, no prompt. Without scaffolding, the agent must trawl the whole codebase cold to determine what changed and whether the architecture docs reflect it — or the step is skipped entirely.

The result is two compounding problems:

1. `docs/architecture` drifts from the code and from the decisions that shaped it. A future loop's agent reads architecture docs that no longer describe the system.
2. There is no provenance record on a feature indicating whether its captured decisions were ever absorbed into the architecture. A proposal is "valid at a point in time" — without a merge timestamp, there is no way to know which proposals have shaped the current architecture and which are orphaned design records.

## Design Principles

- **One-way transfer.** The skill moves decisions *into* `docs/architecture`. It does not maintain a separate principles document or intermediate accumulator — the architecture tree is the destination and the ground truth.
- **Feature-scoped focus.** The skill operates on a single feature at a time, using its captured artifacts to bound what the agent reads. This is the whole point: avoid trawling the codebase by giving the agent a focused scope signal.
- **Non-code artifacts are the primary signal.** The proposal captures architectural decisions; the plan's Architecture Impact section carries them forward in actionable form. Code changes are a secondary confirmation — useful to catch anything that landed without a design record, not the driver of what gets merged.
- **Architecture structure is discovered, not prescribed.** Each project's `docs/architecture` tree has its own shape. The skill reads the existing structure and maps to it; it does not impose a canonical layout.

## Proposed Design

### Inputs

The skill takes a feature slug as its argument: `/reconcile-arch <slug>`, resolving to `docs/features/<slug>/`.

From that directory it reads, in priority order:

1. **`proposal.md`** — the architectural decisions, rationale, and trade-offs. Primary source.
2. **`plan.md`** (Architecture Impact section) — the actionable translation of those decisions. Fills the gap for plan-only features and confirms the proposal's intent was preserved during planning.
3. **Git diff** (scoped, non-doc files) — secondary confirmation. Used to catch decisions that landed in code but were never captured in the proposal or plan. Specifically: new interfaces, new components, changed coordination patterns. Pure implementation churn is ignored.

### Architecture mapping

Before proposing any changes, the skill reads `docs/architecture/README.md` (or equivalent top-level entry point) to understand the existing structure. For each architectural decision extracted from the feature's artifacts, it identifies which existing file should absorb it — or notes that a new section is warranted.

The skill produces a gap analysis in chat: "this decision belongs in `runtime/README.md` under Design Principles and is not yet present", "this section already reflects this decision accurately". The human and agent then write the targeted additions together. The skill does not auto-patch architecture files without review.

### Provenance stamp

When the reconciliation is complete — decisions reviewed, architecture updated — the skill writes a single field to `feature.md`:

```yaml
arch-merged: 2026-07-22
```

This stamps the feature record with the date the merge was last performed. It applies regardless of whether the feature has a proposal, a plan, or both.

`featuremgr` derives from this field:

- **Triage view**: surfaces open features where `arch-merged` is absent as "not yet arch-reconciled" — a distinct actionable bucket alongside "finishable".
- **Staleness signal**: `arch-merged` date vs. last code change (mtime) — features where code changed significantly after the merge are flagged as potentially stale.
- **Future superseded detection**: when a later feature's proposal explicitly overrides an earlier decision, `arch-merged` provides the date baseline for that comparison. Deferred to a later activity.

### What the skill does not do

- Does not maintain a `docs/principles/` accumulator or any intermediate doc layer.
- Does not auto-update architecture docs without human review — it produces the gap analysis and proposes targeted changes.
- Does not set the feature's `status` field. Arch reconciliation is orthogonal to the `draft → active → done` lifecycle; a feature can be `done` without arch reconciliation (not every feature warrants it) and can be arch-reconciled before it is `done`.
- Does not compute "superseded" status — deferred.

## Behavioral Implications

**featuremgr index:** The index gains a column or indicator for `arch-merged` status. Features with no `arch-merged` field and `status: active` or `done` surface as candidates for reconciliation.

**Triage:** The triage view gains a "not yet arch-reconciled" bucket. The Triage skill already handles `done`/`abandoned` decisions; this adds a pre-done checkpoint for features whose decisions haven't been absorbed.

**Proposal lifecycle:** Proposals remain frozen content — their body is never edited post-creation. The `arch-merged` stamp on `feature.md` is the only machine-written artifact from this skill. The proposal is the ADR stream; `arch-merged` records when that stream was last absorbed.

**Architecture docs diversity:** The skill is designed to handle arbitrary `docs/architecture` structures. It reads the existing tree, does not impose a schema, and maps decisions to wherever they belong in that project's structure.

## What Changes / What Does Not Change

**Changes:**

- New `reconcile-arch` skill in `bob/skills/`.
- `feature.md` gains an optional `arch-merged: <date>` field (no schema change, featuremgr reads it additively).
- `featuremgr` derives arch-merged status and surfaces it in triage and index.
- `feature-centric-lifecycle` plan's "no status on individual artifacts" rule is narrowed: proposal/plan carry no lifecycle status, but `feature.md` may carry provenance timestamps.

**Does not change:**

- `proposal.md` and `plan.md` remain pure content — no new frontmatter fields on those files.
- The `status` lifecycle on `feature.md` (`draft → active → done → abandoned`) is unchanged.
- `docs/architecture` structure in any project — the skill adapts to it.
- The execute-plan, create-plan, create-proposal skills — no changes.

## Open Questions

- **featuremgr rendering of `arch-merged`:** Should the index show a date column, a boolean indicator, or just surface it in the triage view? Deferred to planning — does not affect the skill design.

## Assumptions

- Assumed the skill operates on the currently active workspace's `docs/features/` tree — it is not multi-repo aware. Flag if cross-repo arch reconciliation is needed.
- Assumed `docs/architecture/README.md` (or a top-level README) exists as the entry point for architecture structure discovery. The skill will need a fallback if no entry point exists.
