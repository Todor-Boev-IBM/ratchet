---
title: "Architecture Reconciliation Skill"
type: plan
---

## Feature Overview

Build a `/reconcile-arch <slug>` skill that, after a feature's plan is complete, reads the
feature's proposal and/or plan, compares their architectural decisions against the current
`docs/architecture` tree, and produces a targeted gap analysis in chat. The human and agent
then update the relevant architecture files together. When done, the skill stamps
`arch-merged: <date>` on `feature.md` and refreshes the featuremgr index.

The goal is to close the loop that currently has no scaffolding: keeping `docs/architecture`
current without trawling the whole codebase, and leaving a provenance record so future loops
can tell which features shaped the architecture and when.

## Architecture Impact

- New skill `bob/skills/reconcile-arch/SKILL.md` — follows the same pattern as `triage`,
  `identify-low-value-tests`. Chat-style, powerful model, no `disable-model-invocation`.
- `feature.md` gains an optional `arch-merged: <ISO-date>` field. featuremgr reads it
  additively — no schema change required, existing features without the field are unaffected.
- `lib/features.mjs` gains `archMerged` on the `Feature` shape (parsed from frontmatter,
  `null` if absent).
- `lib/render.mjs` adds an `Arch Merged` column to the index table.
- `featuremgr triage` output gains an `[arch-pending]` flag for open features that have no
  `arch-merged` date (i.e., candidates for reconciliation).
- No changes to `create-proposal`, `create-plan`, `execute-plan`, or `triage` skills.

## API Changes

**Modified Types (feature shape in `lib/features.mjs`):**

- `Feature`: add `archMerged: string | null` — ISO date string from `feature.md` frontmatter
  `arch-merged` field, or `null` if absent.

**Modified Functions:**

- `loadFeature(dir, slug) -> Feature`: parse `arch-merged` from frontmatter into `archMerged`.
- `renderIndex(features) -> { content, summary }`: add `Arch Merged` column to index table.
- `triage(docsDir)` CLI command: append `[arch-pending]` flag to features where
  `archMerged === null` and `status` is `draft` or `active`.

**No new exported functions** — `arch-merged` is read passively alongside existing fields.

## Critical Logic and Decisions

**Component: reconcile-arch skill**

Key responsibilities:

- Read the feature directory (`docs/features/<slug>/`) — proposal.md if present, then
  plan.md Architecture Impact section, then optionally a scoped git diff as confirmation.
- Read the target project's `docs/architecture/` entry point to understand existing structure.
- Produce a gap analysis in chat: for each architectural decision in the feature artifacts,
  state which architecture file it belongs in and whether it is already present.
- After human-confirmed updates are applied, write `arch-merged: <today>` to `feature.md`
  and run `featuremgr reindex`.

Critical flow:

```text
read feature dir: proposal.md (primary) → plan.md Architecture Impact (fallback/complement)
read docs/architecture/README.md (or equivalent entry point) to map existing structure
for each decision in feature artifacts:
  find matching section in architecture tree, or note it as absent
present gap analysis in chat; do not auto-patch architecture files
after human confirms updates: stamp arch-merged on feature.md, reindex
```

Implementation decisions:

- **Chat-style, not auto-patch.** The skill surfaces gaps and proposes targeted additions; the
  agent writes them with the human present. Architecture docs are authored prose — silent
  auto-updates would corrupt intent.
- **Git diff is optional and secondary.** The skill mentions it can run a scoped diff as a
  confirmation step (to catch implementation-level decisions that weren't captured in the
  proposal), but the non-code artifacts drive the analysis.
- **`arch-merged` is written by the skill, not featuremgr.** featuremgr is read-only with
  respect to feature content. The skill writes the field directly to `feature.md` frontmatter
  (same pattern as triage writing `status`).
- **`docs/architecture` structure is discovered, not prescribed.** The skill reads whatever
  structure exists; it does not require a canonical layout.

**Component: featuremgr `archMerged` field**

Key responsibilities:

- Parse `arch-merged` from `feature.md` frontmatter into `archMerged: string | null`.
- Surface it in the index table and triage output.

Critical flow:

```text
loadFeature: data['arch-merged'] ?? null  →  archMerged
renderIndex: add column "Arch Merged", value formatDate(archMerged) or "—"
triage output: append [arch-pending] when archMerged === null and feature is open
```

Implementation decisions:

- **`null` means "never merged", not "not applicable".** Every open feature without
  `arch-merged` is flagged `[arch-pending]` in triage — the human decides whether to
  reconcile or skip.
- **`archMerged` is a string (ISO date), not a Date object** — stored and displayed as-is,
  no conversion needed.

## Testing Approach

- **Unit (`lib/features.mjs`):** `archMerged` present and absent in frontmatter; `loadFeature`
  returns correct value in both cases.
- **Unit (`lib/render.mjs`):** index table includes `Arch Merged` column with date or `—`.
- **Integration (`test/cli.test.mjs`):** `triage` output includes `[arch-pending]` for open
  features without `arch-merged`; does not include it when `arch-merged` is set.
- Critical scenarios: arch-pending-flagged-in-triage, arch-merged-shown-in-index,
  arch-merged-absent-renders-dash.
- **Skill (`bob/skills/reconcile-arch/SKILL.md`):** no automated test — validated by manual
  walkthrough on the `reconcile-arch` feature itself after execution.

## Phases

### Phase 1: featuremgr — `archMerged` field and index column [done] ✅ 2025-07-22

Goals:

- Add `archMerged: string | null` to `Feature` shape in `loadFeature` (parse `arch-merged`
  from frontmatter).
- Add `Arch Merged` column to `renderIndex` table.
- Add unit tests for both.

Deliverable: `reindex` output includes `Arch Merged` column; features without the field show
`—`; features with it show the ISO date.

### Phase 2: featuremgr — `[arch-pending]` flag in triage [done] ✅ 2025-07-22

Goals:

- Add `archMerged` to the triage output line for open features where it is `null`.
- Add integration test covering both flagged and non-flagged cases.

Deliverable: `featuremgr triage` prints `[arch-pending]` for open features without
`arch-merged`; features with the field do not show the flag.

### Phase 3: `reconcile-arch` skill [done] ✅ 2025-07-22

Goals:

- Write `bob/skills/reconcile-arch/SKILL.md` following the skill authoring conventions.
- Skill reads proposal.md → plan.md Architecture Impact → optional git diff.
- Skill reads `docs/architecture/` entry point to map existing structure.
- Skill produces gap analysis in chat, then (on confirmation) stamps `arch-merged` and
  reindexes.

Deliverable: `/reconcile-arch reconcile-arch` runs on this feature itself and produces a
coherent gap analysis; `arch-merged` is stamped on `feature.md` after the session.

## Open Questions

_None — implementation can proceed._

## Assumptions

- Assumed `docs/architecture/README.md` is the standard entry point for structure discovery;
  the skill will need a fallback (list directory, pick first `.md`) if no README exists.
- Assumed `arch-merged` date is written as `YYYY-MM-DD` ISO format — same style as phase
  completion dates in plan.md.
- Assumed the triage CLI output (not the Triage skill's prose) is the right place for
  `[arch-pending]` — it keeps featuremgr's machine-readable output as the signal source.
