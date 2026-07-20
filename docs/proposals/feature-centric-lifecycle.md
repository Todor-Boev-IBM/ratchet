---
status: open
type: proposal
title: "Feature-Centric Document Lifecycle"
---

## How I Actually Work

The workflow is fluid and curiosity-driven, not a pipeline. A representative arc, as a sequence
of decisions:

- **Research.** I open a long session to explore something interesting, updating architecture
  documents as my understanding sharpens. No fixed goal yet.
- **Capture.** When the context crystallizes, I record it — as a **proposal** ("worth doing"),
  a **plan** ("enough to build"), or both. Sometimes I capture and walk away.
- **Choose what's next.** I might execute the plan right away, keep refining the proposal, or
  set it aside for whatever I'm already onto.
- **Run in parallel.** A plan executes in the background while I start fresh ideation sessions;
  a new idea can spawn its own flow on the spot. Sessions get abandoned or carried forward.
- **Clean up on finish.** Completing `/execute-plan` takes me straight into the recover-quality
  (code-cleanup) phase, which I do immediately rather than defer.
- **Commit by code, not by feature.** My commits summarize *changes to the code*; one may span
  several features, or none cleanly.

Today I drive this with skills that each work well on their own: `/create-proposal`,
`/create-plan`, `/execute-plan`, the commit skills (`/prepare-next-commit`,
`/prepare-single-commit`), and the `Design` and `Simplify` modes.

## The Tradeoffs I'm Making

This process is really about **directing attention** — the one scarce resource. Because agentic
execution runs in the background, I spend flow-state not on typing code but on whichever layer
has the most leverage: architecture research, planning, or review. That freedom is the point,
and it comes with tradeoffs I accept consciously:

- **Ideas outrun execution.** Ideation is fast and cheap; executing a plan is slow. The
  producer/consumer imbalance means a backlog *can* form — not inevitably, but depending on the
  project. The system has to handle the accumulating case without assuming it's universal.
- **Comprehension is debt.** Backgrounding execution means I don't hold the resulting code in
  my head. The recover-quality phase pays that debt while understanding is still fresh — which
  is why it's the one thing I *won't* defer, though I'll happily leave a proposal or plan
  parked. What I defer versus what I don't is itself an attention decision.
- **Abandonment is a signal, not a failure.** Since ideation is *meant* to outrun execution,
  some captured work is expected to be dropped. A visible, counted `abandoned` state is the
  honest scoreboard for my ideation-to-execution ratio — not a mess to hide.

## The Missing Skill: Managing the Feature Portfolio

My skills cover the *acts* — capture, execute, commit. Nothing manages the **portfolio** of
features that accumulates across these parallel, out-of-order flows. That gap is the actual
problem, and it shows up as:

- **I can't remember which is at what stage.** Looking at the pile of proposals and plans:
  which are just ideas I never committed to? Which are half-built? Which are effectively dead
  because I moved on? No skill answers
  *"across everything I've captured, what exists, what stage is each at, and what needs a decision from me."*
- **The forgotten middle rots.** Work that is captured or `active`, untouched for a long time
  because a newer flow pulled my attention, quietly decays because nothing ever prompts a
  decision about it.
- **Hand-maintained status drifts** precisely because I'm never *present at the transition* to
  update it — the transitions happen in my head, mid-context-switch, at no fixed event.

So the problem to resolve is not "where does status live." It is a
**missing portfolio-management capability**: keeping each feature's state truthful without depending
on my memory, and being **prompted to close out work one way or another** at the moments I actually
am present.

## Design Principles

- The **feature** is the unit that matters. A proposal and a plan are optional work products
  used to produce it, not the thing itself.
- **Separate what can be observed from what only I know.** Structural facts (which artifacts
  exist, whether a plan's phases are checked, when the folder was last touched) are *derived*
  by the tool and never stored. Only my *intent* toward a feature is stored, because only I
  know it.
- **Identity is the folder.** A feature is a directory; that is what everything else hangs on.
- **The tool observes, derives, and reports; it never silently rewrites** authored content.
- **Status changes only when I'm in the loop.** Nothing between deliberate checkpoints depends
  on me maintaining state mid-flight.

## Proposed Design

A feature is a directory: `docs/features/<slug>/`, containing:

- **`feature.md`** — the anchor, always present. Holds the feature's title and my single
  **intent** value (below). This is the unit the index lists.
- **`proposal.md`** — optional. The design record, when the feature warranted one.
- **`plan.md`** — optional. The implementation plan, when one was produced. Its phases are
  `### Phase N` sub-headings under a `## Phases` section, each carrying a status marker (`✅`
  done, `⏳` in progress, none = not started); the goal/deliverable prose under each heading
  keeps the plan readable for review. The tool reads completion straight from those markers, so
  there is no separate progress field to maintain.

`feature.md` is always present; at least one of `proposal.md` / `plan.md` is expected. It stays
minimal on purpose — title, intent, and a one-line statement of *what the feature is* (stable
purpose, not a design summary, so it doesn't drift against `proposal.md`). `proposal.md` and
`plan.md` are **pure content** — at most a title, no status of their own. The folder *is* the
feature: everything about it lives in one place.

### Intent vs. derived state

Two different kinds of state, kept apart:

**Intent** — the only thing stored, in `feature.md`:

| intent      | meaning                                                       |
| ----------- | ------------------------------------------------------------- |
| `parked`    | captured out of curiosity; not committed to (idea / research) |
| `active`    | I intend to work on it, or am working on it                   |
| `done`      | I'm satisfied and moving on                                   |
| `abandoned` | dropped; I've moved on without finishing                      |

**Derived facts** — computed by the tool, never stored:

- has `proposal.md`? has `plan.md`? — just which files exist
- **plan completion**: done / total from the `### Phase` markers in `plan.md`'s `## Phases`
  section; a plan with no such section simply has no completion signal
- **last touched**: folder mtime, to surface the forgotten middle

The stage I read is `intent × derived facts` — e.g. *"active, plan 4/6, last touched 31 days
ago."* I never hand-track the structural transitions, and the values I do own (`parked` →
`active` → `done`/`abandoned`) change rarely and only at moments I'm deciding something.

## Skills and How They Relate

Skills are **decision-capture points**, not a linear pipeline — matching how the work actually
flows. The tool reads and flags; skills write intent.

- **Capture** (today's `/create-proposal` and `/create-plan`, unified in behavior) — turn the
  current session's context into a feature folder. Emits `proposal.md`, `plan.md`, or both, and
  sets intent to `parked` (just capturing) or `active` (committing now). This is the
  crystallization moment out of a research session.
- **`/execute-plan`** — largely as today. On start, ensures intent is `active`; as it works, it
  **checks off plan phases** so completion becomes an observable fact. That check-off is what
  later lets Triage spot finishable work.
- **Triage** (new — the missing piece) — one concentrated skill, and the *only* place the
  closing decisions (`done` / `abandoned`) are made. It shows only the open intents — `parked`
  and `active`; once a feature is `done` or `abandoned` it drops out of the list. Within that
  set it surfaces what's actionable: work that hasn't moved in a long time, or a complete plan
  awaiting a call. It orders the list oldest-touched first, bucketed at one-week intervals, so
  staleness reads as age bands rather than a single stale/fresh cutoff. For each it prompts me
  to decide and writes the intent I choose. This is the deliberate "clear the backlog" session.
  It gets its own skill precisely because reasoning across the whole portfolio at once is heavy
  — not something to graft onto another skill.

The commit skills deliberately stay out of this. They already carry the hard job of grouping
changes into logical commits; portfolio state is a separate concern that would only dilute
both. A commit is not bound to a feature anyway (my commits summarize code, and may span
several features or none).

So intent is reconciled in exactly one place, and nothing in between depends on me updating
status mid-flight. What keeps Triage from depending on memory is the tool itself: because it
derives completion and staleness, any run — e.g. on `reindex`, which I do anyway — can surface
how many features are finishable or have gone stale. That ambient count is the nudge that tells
me it's time to triage; the decision-making stays entirely inside the Triage skill.

The research flow stays *outside* this system — it edits architecture docs on its own
lifecycle. Capture is the single bridge from "I was just poking around" into a feature folder;
the feature system does not try to own the research corpus.

## Behavioral Implications

- **No mid-flight bookkeeping.** One intent field, written only at checkpoints. Structural
  state is derived, so there's nothing to keep in sync.
- **The forgotten middle becomes visible.** Sorting by last-touched and surfacing stale
  `parked` / `active` features is exactly the question I can't answer today.
- **The tool stays read-only for content.** `reindex` writes only the index. `check` reports
  structural problems (missing `feature.md`, no artifact, unknown intent value) but never
  rewrites — correcting a flagged problem is a skill's job, in the loop.

## What Does Not Change

Documents stay plain markdown authored by a human/agent; the index stays a generated,
human-facing artifact; `done` and `abandoned` remain explicit decisions, never inferred.
