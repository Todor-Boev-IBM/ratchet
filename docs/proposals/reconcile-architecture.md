---
status: open
type: proposal
title: "Reconcile Skill: Machine-Assisted Recovery of the Reconcile Phase"
---

## Problem

The Reconcile phase is the one phase [process.md](../../process.md) declares non-deferrable —
it keeps the codebase a reliable teacher for the next loop and repays the comprehension debt
that backgrounding execution incurs. It is also the phase I actually avoid. Reconcile is
entirely human-gated: I read agent code by hand, hold it against the principles in
`docs/architecture`, and judge which way each mismatch cuts. That holding-two-things-in-my-head
work is what exhausts me, and when attention loses — my own thesis says attention is the scarce
resource — the phase gets skipped. When it's skipped, the compounding loop runs *backward*: the
agent imitates un-reconciled code, and ambiguity breeds ambiguity.

So the phase whose entire justification is protecting the next loop is the phase most exposed to
being dropped. That is the gap this skill targets.

## Design Principles

- **Machine classifies, human disposes.** The skill never edits code or docs. It produces a
  triaged report of divergences; every fix is a human decision. Auto-fixing would erase
  intentional drift or in-progress work — the documented failure mode where an agent treats
  descriptions of existing code as a fresh spec and regenerates duplicates.
- **Direction-aware, not consistency-checking.** In this process `docs/architecture`
  *deliberately* drifts from code — concrete guidance hardens into principle over time. A naive
  code-vs-doc diff would flag that intentional drift as error and bury the signal in noise. The
  skill must classify *which way* a mismatch cuts, not merely detect that one exists.
- **Output is decisions, not code.** Success is measured by whether Reconcile gets *lighter*.
  If the human ends up re-reading agent code line-by-line anyway, the skill has failed. The
  report is a short ranked list of judgments, not a wall of source.
- **Reduce load on first contact.** This skill is added to the phase I already skip when tired.
  If v1 makes Reconcile heavier, it dies. It must relieve load immediately or not ship.

## The Core Model: Four Buckets

Every divergence between a code region and its governing principle falls into one of four
classes. Only two are defects. This taxonomy is the whole skill.

| Divergence                                   | Meaning            | Default action           |
| -------------------------------------------- | ------------------ | ------------------------ |
| Code **violates** a stated principle         | Code rot           | Propose code fix / flag  |
| Doc asserts something now **false**          | Doc rot            | Propose doc update       |
| Doc silent, code added **detail**            | Expected drift     | Suppress (not a defect)  |
| Code complexity governed by **no** principle | Simplify candidate | Flag for `Simplify` mode |

The two suppressed-by-default cases (expected drift) are what a consistency checker gets wrong.
The "harden" action — promoting recurring code detail into a new principle — is a *proposed*
transition out of the expected-drift bucket, never automatic, because promotion is a judgment
act.

## Proposed Design

### Invocation and scope

The skill takes one of two scope anchors and runs the same classifier over both:

- **Feature-scoped** — anchor on the git diff of a just-executed plan. Cheap and precise; this
  is the run that fires at the end of `/execute-plan`, catching rot while the change is fresh.
- **Module-scoped** — anchor on a directory plus its governing `docs/architecture` documents.
  This is the cold run for a dedicated load→reconcile cleanup session.

```text
reconcile --feature <slug>      # diff-anchored, post-execute
reconcile --module <path>       # directory-anchored, cleanup session
```

### Pipeline

```text
1. Resolve scope → set of changed/relevant code symbols (via codegraph + git diff)
2. Gather governing principles → the docs/architecture sections that apply to that scope
3. For each (symbol, principle) pair that interacts:
     classify into one of the four buckets
     assign severity
4. Suppress the expected-drift bucket unless --all
5. Emit ranked report: bucket, severity, location, one-line judgment, proposed action
```

Classification is the mechanical cross-referencing that exhausts me by hand; severity ranking is
what lets the report stay short. The human reads judgments and picks actions.

### Report shape

The output is a summary line plus a ranked list — decisions, not source:

```text
6 divergences (2 code-rot, 1 doc-rot, 3 expected — suppressed)

CODE ROT
  [high] flow/engine.go:cleanupWorkload — violates "cleanup is idempotent" (docs/architecture/lifecycle.md)
         → proposed: guard re-entry; flag for fix
  [med]  connkit/resolve.go:lookup — duplicates connhttp resolution instead of reusing it
         → proposed: extract shared path

DOC ROT
  [med]  docs/architecture/triggers.md — states "triggers are pull-only"; streaming triggers now push
         → proposed: update doc to describe push path

Run with --all to see 3 expected-drift items.
```

### What the skill must never do

- Edit code or `docs/architecture` files.
- Report the expected-drift bucket by default.
- Emit raw code dumps in place of a judgment.
- Treat an existing-code description as a spec to regenerate against.

## Behavioral Implications

- **Fits the attention thesis.** The machine does the mechanical read-and-classify; the human
  keeps every judgment. This is the same split the whole process rests on, applied to its
  weakest phase.
- **Composes with `Simplify`.** The fourth bucket is a feeder into the existing `Simplify` mode
  rather than a new fixer — no overlap, clean handoff.
- **Feeds the harden loop.** Proposed doc-updates and principle-promotions are how
  [process.md](../../process.md)'s "sync what changed back into docs/architecture" becomes a
  prompted step instead of something I have to remember to do.

## What Changes / What Does Not Change

**Changes**

- Adds a `reconcile` skill under `bob/skills/`.
- `/execute-plan` gains an optional final step that invokes the feature-scoped run.

**Does not change**

- No change to `docs/architecture` authoring — the drift-toward-principle model stays exactly
  as-is; the skill reads it, never rewrites it.
- No change to the commit or triage phases.
- Reconcile stays human-gated. This assists the phase; it does not automate it.

## Open Questions

- **Governing-principle resolution.** How does the skill reliably map a code region to the
  `docs/architecture` sections that govern it? Path/naming heuristics, an explicit front-matter
  mapping, or embedding search? This is the hard part and blocks a useful v1. *(blocks planning)*
- **Severity model.** What makes a divergence "high"? Without a defensible ranking the report
  is just a flat list and the load-reduction goal fails. *(blocks planning)*

## Assumptions

- Assumed `docs/architecture` is the canonical principle source; if principles also live inline
  in code comments or elsewhere, the gather step needs another input — flag if so.
- Assumed codegraph + git diff is sufficient to resolve feature scope; if executed plans don't
  map cleanly to a diff (e.g. squashed or interleaved work), the feature anchor weakens.
- Assumed the narrowest useful v1 is *feature-scoped, code-rot bucket only, propose-only*, and
  that the module-scoped cold engine is deferred — building the full four-bucket engine up front
  is the over-engineering the process itself warns against. Flag if you'd rather validate the
  cold-cleanup workflow first.
