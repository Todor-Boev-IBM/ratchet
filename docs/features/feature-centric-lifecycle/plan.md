---
title: "Feature-Centric Document Lifecycle"
---

# Feature-Centric Document Lifecycle

## Feature Overview

Replace the parallel `docs/proposals/` + `docs/plans/` layout (paired by filename, each doc
carrying its own status) with a per-feature directory `docs/features/<slug>/` holding a small
`feature.md` anchor plus optional `proposal.md` / `plan.md`. A feature's only stored state is a
single `status` field on `feature.md`; everything else (which artifacts exist, plan completion,
last-touched) is *derived* by `featuremgr` and never written back. `featuremgr` becomes read-only with
respect to content, gains a `triage` surface, and a new Triage skill becomes the single place
the closing `done`/`abandoned` decisions are made. This solves the real problem — a feature
portfolio that accumulates across parallel, out-of-order flows with no way to see what is at
what stage.

## Architecture Impact

- **The doc model is rewritten, not extended.** `lib/model.mjs` today encodes proposals,
  plans, pairing, cascade rules, and frontmatter repair. The feature model discards all of it:
  no pairing, no per-doc status, no cross-document cascade, no `maintainFrontmatter`. This is a
  replacement of `model.mjs`, reusing only `markdown.mjs` (frontmatter parse + file walk).
- **`reindex` loses its second job.** It stops writing document frontmatter and only renders
  `index.md`. The write path (`maintainFrontmatter` / `serializeDocFrontmatter`) is deleted
  outright, not repurposed.
- **Two derivations are introduced** that read but never store: plan completion (from the
  `### Phase` headings' `✅` markers inside a `## Phases` section of `plan.md`) and
  last-touched (filesystem mtime of a feature's files). These feed both the index and a new
  `triage` command.
- **Skill surface: `bob/skills/` only, for now.** `create-proposal`, `create-plan`,
  `execute-plan` change behavior and a new `triage` skill is added. Only the `bob/skills/`
  sources are updated in this plan; mirroring into consuming repos' `.github/prompts/` is
  deliberately deferred to a later activity.
- **Constraint:** `featuremgr` is already invoked by the workflow (skills run it), so making it the
  read/derive surface adds no new dependency. It must remain dependency-free Node.
- **Supersedes** the abandoned `tool-owned-frontmatter-lifecycle` plan, which centralized
  *more* mutation in the tool; this goes the other way — the tool mutates nothing but the index.

## API Changes

### On-disk format (the real contract)

- `docs/features/<slug>/feature.md` — required per feature. Flat frontmatter:
  `title: "<string>"`, `status: <draft|active|done|abandoned>`. Body: one-line purpose.
- `docs/features/<slug>/proposal.md`, `plan.md` — optional, pure content, at most a `title`.
  No status of their own.
- `plan.md` progress marker: a `## Phases` section whose `### Phase ...` sub-headings each
  carry a status marker — `✅` (done), `⏳` (in progress, a crash-recovery point), or none
  (not started). Completion = `✅` phases over total phase headings; absence of the section, or
  a section with no phase headings, = no signal. The goal/deliverable prose under each heading
  keeps the document human-readable and is not parsed.

### New model (`lib/features.mjs`, replacing `lib/model.mjs`)

- `INTENTS = ['draft', 'active', 'done', 'abandoned']` — the closed vocabulary.
- `loadFeatures(docsDir) -> Feature[]` — walk `<docsDir>/features/*/` (i.e. `docs/features/`),
  parse each `feature.md`, detect artifacts, attach derived facts. Pure read.
- `Feature` shape: `{ slug, title, status, purpose, hasProposal, hasPlan, planCompletion,
  lastTouched }` where `planCompletion` is `{ checked, total } | null` and `lastTouched` is an
  epoch ms.
- `derivePlanCompletion(planBody) -> { checked, total } | null` — count the `### Phase`
  headings' `✅` markers within the `## Phases` section.
- `deriveLastTouched(featureDir) -> number` — most recent mtime among the folder's files.
- `validateFeatures(features) -> string[]` — structural problems only (see §4). Pure, no I/O.
- `triageView(features) -> Bucket[]` — open-status features (`draft`/`active`) only, ordered
  oldest-touched first, grouped into one-week age bands.

### CLI (`featuremgr.mjs`)

- `featuremgr reindex [--docs <dir>] [--out <file>]` — render `index.md` from features; **never**
  writes a feature file. Prints an ambient nudge line: `N finishable, M stale`.
- `featuremgr check [--docs <dir>]` — structural audit only; exit non-zero on problems.
- `featuremgr triage [--docs <dir>]` — **new.** Print the triage view (open statuses, oldest-first,
  weekly bands, with derived facts) for the Triage skill to consume. Read-only.

`docs/features/` may be empty initially; new work populates it. Migrating the existing
`proposals/`+`plans/` tree is out of scope here (a separate activity).

### Removed

- Everything pairing-related: `pair:` field, `buildPartners`, `partnerOf`, legacy link
  fallback, `PAIR_RULE`, `OTHER_TYPE`, filename-stem matching.
- `maintainFrontmatter`, `serializeDocFrontmatter` — the document write path.
- Per-type `BUCKETS` and the plan-done→proposal-implemented cascade.

## Critical Logic and Decisions

**Component: derivations (`lib/features.mjs`)**

Plan completion — count the `### Phase` headings in the designated section, ignore phase
headings elsewhere:

```text
find the "## Phases" heading in plan.md body
scan its `### Phase ...` sub-headings until the next "##" heading
total = number of phase headings; checked = those carrying the ✅ marker
(⏳ = in progress and no marker = not started both count as not done)
total == 0  ->  return null   # no machine-readable signal, not 0/0
else        ->  return { checked, total }
```

Last-touched — reflects edits, so use the newest file mtime, not the directory's own:

```text
lastTouched(dir) = max(mtimeMs of every file directly in dir, recursively)
```

**Component: triage view (`lib/features.mjs`)**

```text
open = features where status in {draft, active}
sort open by lastTouched ascending          # oldest first
band by 7-day age from now: [0-7), [7-14), ...   # bands, not a cutoff
within each band keep the oldest-first order
mark actionable: plan complete (checked == total) OR band age >= 1
```

Design decisions:

- **The tool never writes feature content — only `index.md`.** `reindex` dropping
  `maintainFrontmatter` is the whole point: no second writer, so no silent corruption of
  authored state. `check` reports; a skill (with the human present) fixes.
- **Status is the only stored state; structure is always derived.** `draft`/`active` are the
  only statuses Triage ever shows; `done`/`abandoned` remove a feature from the working list.
- **Completion raises a question, never sets `done`.** A `## Phases` section with every phase
  marked `✅` marks a feature *finishable*; the human decides `done` in Triage.
- **`last-touched` uses filesystem mtime by choice, with a known weakness.** mtime is reset by
  fresh clones/checkouts, so staleness can read wrong after a clone. Accepted for v1 because it
  is dependency-free and correct in the steady-state single-checkout case; a git-log-based
  variant is deferred (see §7).

**Component: structural check (`validateFeatures`)**

Rules (report-only):

```text
- every docs/features/<slug>/ has a feature.md
- feature.md has a title and a status in INTENTS
- at least one of proposal.md / plan.md exists
- (warn) plan.md present but no "## Phases" section with phase headings  -> no completion signal
```

## Testing Approach

- **Unit (`lib/features.mjs`):** `derivePlanCompletion` (no section, section with no phase
  headings, mixed done/in-progress/not-started, phase headings outside `## Phases` ignored,
  non-phase sub-headings ignored); `deriveLastTouched`; `triageView` ordering + banding +
  open-intent filtering; `validateFeatures` each rule.
- **Unit (render):** `index.md` grouped by status with derived facts; ambient nudge counts.
- **Integration:** run `reindex`/`check`/`triage` against a fixture `docs/features/` tree and
  assert output; assert `reindex` writes no file other than `index.md`.
- Critical scenarios (names): read-only-reindex, finishable-detection, stale-banding,
  open-status-only-triage, completion-ignores-out-of-section-phases.

## Phases

### Phase 1: Feature model and read-only reindex ✅ 2026-07-19

- Add `lib/features.mjs` (load features, derive completion + last-touched); rewrite `render.mjs`
  to group by status and show derived facts; delete pairing/frontmatter-write code paths.
- Rewire `featuremgr reindex` to the feature model; it writes only `index.md`.
- Deliverable: against a fixture `docs/features/` tree, `reindex` produces a correct
  status-grouped `index.md` and touches no feature file.

### Phase 2: check and triage surfaces ✅ 2026-07-19

- Implement `validateFeatures` and wire `featuremgr check`; implement `triageView` and add
  `featuremgr triage`; add the `N finishable, M stale` nudge line to `reindex` output.
- Deliverable: `check` flags each structural violation on a fixture; `triage` lists open
  features oldest-first in weekly bands with artifacts + completion.

### Phase 3: Capture and execute-plan skills (`bob/skills/`) ✅ 2026-07-19

- Update `create-proposal` / `create-plan` to create a `docs/features/<slug>/` folder, write
  `feature.md` (status `draft` when just capturing, `active` when committing), and emit
  `proposal.md` / `plan.md`; keep `create-plan`'s readable `### Phase N` headings under a
  `## Phases` container, emitted with no status marker.
- Update `execute-plan` to set status `active` and mark `### Phase` headings `⏳` on start /
  `✅` on finish as phases progress (retaining the crash-recovery marker).
- Scope: `bob/skills/` sources only; `.github/prompts/` mirrors are deferred.
- Deliverable: capturing and executing produce correct folders, intents, and phase markers.

### Phase 4: Triage skill; confirm commit skills untouched ✅ 2026-07-19

- Add a `triage` skill that runs `featuremgr triage`, walks the open features (oldest-first bands),
  prompts keep / `done` / `abandoned` per feature, and writes the chosen `status` to
  `feature.md`.
- Verify `prepare-next-commit` / `prepare-single-commit` carry no triage logic.
- Deliverable: a Triage session reconciles intents end-to-end; commit skills are unchanged.

## Open Questions

None block implementation. Deferred by decision:

- **Git-based last-touched** — filesystem mtime is accepted for now; a clone-stable `git log`
  variant may replace it later.
- **Migrating the existing `proposals/`+`plans/` tree** — a separate activity; `docs/features/`
  starts empty and new work populates it.
- **Mirroring skills into `.github/prompts/`** — deferred; `bob/skills/` is updated first.
