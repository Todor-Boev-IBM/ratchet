# Ratchet Process

> AI magnifies the developer you already are.

## Principles

Three principles shape the ratchet workdlow.

### The scarce resource is attention

The workflow's goal is to improve the cognitive ability of a single developer.

The whole process is arranged to keep attention neither starved nor overwhelmed:

- [Ideation](#load) carries you over the initial hump of getting focused; starting cold is hard.
- Research and planning keep you at the layer where thinking is fast.
- [Execution](#execute) runs in the background, so the slow work costs little attention and keeps fatigue low.
- [Reconciliation](#reconcile) is unavoidable, but is timed to happen when the agent still holds context,
  so you can interrogate it about the code and switch focus more easily.
- The generated code is good enough to carry forward, so when you choose to hand-code you don't start from scratch.

### The code is the ground truth

The process produces two kinds of artifact: durable and temporal.

Durable artifacts are the code and the `docs/architecture` prose that explains its principles.
Every loop begins from these — they are not derived from a higher-level spec, they *are* the spec.

Temporal artifacts are proposals and plans. A proposal captures a design worth pursuing; a plan
details how to build it. Each is authoritative only for the duration of its use: future intent
when written, a working contract during execution, scaffolding to discard once the code exists.
This is the opposite of spec-driven development, where the spec is the authority and the code a derivative of it.

Architecture documents occupy a middle ground. Early in a project they read like specifications —
exact behavior descriptions, code snippets, module contracts. As that detail transfers into code,
they solidify into structural concerns: module boundaries, general behavior rules, architecture
decisions absorbed from closed proposals.

### The codebase compounds

You are never working on a blank page. Each loop leaves behind more examples for the agent.
Consistent quality compounds at a steady rate; ambiguity compounds technical debt at an accelerating rate.

So the quality maintained now buys a higher success rate on every loop that follows. As the codebase grows and its
principles become legible in the code itself, it gets *easier* to add to rather than harder.

The architecture documents and code never stay perfectly in sync; you can't spend each loop on both.
Part of the work is to keep the gap small enough so they mostly complement rather than contradict.

![Ratchet Loop](architecture-loop.svg)

## The arc of a feature

A representative pass moves through four styles of work. Each uses a different interaction style and is suitable for
a different class of [model](#models).

![Ratchet Flow](architecture-flow.svg)

### Load

Chat style, requires a powerful model.

Every session starts with an intent — [research a topic](#tools), fix a bug, implement a feature.

Within that goal the session may run long as both the human and agent understanding improves.
Here you load the problem constraints into context and use the agent to discover blind spots, so the
[Communication Style](../../bob/rules/communication-style.md) is critical.

### Capture

When the context crystallizes, record it: `/create-proposal` for a design record worth doing, `/create-plan` for an
implementation plan detailed enough for an agent to build against.

Crystallization is often a deliberate step — asking the agent to summarize what has been discovered so far.
This both consolidates your understanding and primes the agent for the respective capture skill.

### Execute

Batch-job style; can tolerate weaker models for simpler tasks.

The `/execute-plan` steps through the plan's phases. This is the slow part, and it runs in the background while fresh ideation sessions start.

### Reconcile

Chat style, requires a powerful model.

This is the knife's edge, where you invest in the next loop:

- Reconcile to good quality and the next loop is easier — the code grows at a steady pace, you fight entropy.
- Let quality slip and the next loop is harder - code deteriorates at an accelerating pace, you go along with entropy.

Completing execution leads straight into this recover-quality phase rather than deferring it.
This work requires judgement, suspicion, and experience to know what is "good enough".

- Challenge the agent to explain code, remove redundancies, refactor to better patterns, explain edge cases.
- Run the `Simplify` mode
- Run `/identify-low-value-tests` — agents often create large amounts of near-useless tests
- Run `/reconcile-arch` to transfer completed architecture decisions to `/docs/architecture`
- Use `/create-proposal` or `/create-plan` to capture discovered work for later.

This is a natural point to drop into hand-coding. The agent produces code that hits the right APIs and has the structure
you want; it is easier to start from that, clean it, and take it forward rather than to begin from scratch.

### Commit

Chat style, suitable for weaker models.

Use `/prepare-next-commit` and `/prepare-single-commit` to group changes into logical commits.
Commits summarize changes to the code, not features: one commit may span several features, or none cleanly.

## Running in parallel

The phases do not run strictly in order. A plan executes in the background while a new ideation session begins; a new
idea can spawn its own flow on the spot. Sessions are abandoned or carried forward as attention moves.

The tradeoffs we accept in order to maintain high rate of ideation are:

- **Comprehension debt:**
  Backgrounding execution means the resulting code is not in your head as you work on something else.
  When the plan is done you no longer have good understanding of what the code does.
  This is why to mitigate this, [reconcile](#reconcile) cannot be deferred, unlike other phases.
  It is done right after execution while you still have some recent context from examining the plan and
  the agent has peak context because it is just out of executing the same plan.
- **Abandoned work:**
  Ideation has to be rapid and unrestrained to explore the problem space effectively; capturing work and abandoning it as the implementation catches up is an acceptable cost.

## Managing the backlog

Parallel, out-of-order flows accumulate a pile of proposals and plans. Capture, execute, and commit each operate on a single item; none of them tracks the whole. Left unmanaged, the pile develops a forgotten middle — work that was captured or started, then left untouched as newer flows pulled attention away.

The `triage` skill closes this gap. It surfaces open work oldest-first, bucketed by age, and prompts a
decision on what has gone stale or is finished. It is the single place closing decisions are made, run as a
deliberate clear-the-backlog session rather than grafted onto another skill.

Triage output also flags open features that carry no `arch-merged` date as `[arch-pending]` — a second
actionable bucket alongside `[actionable]` (finishable). A feature can be triage-closed without being
arch-reconciled; not every feature warrants an architecture update. But the flag keeps it visible.

## Graphical prompting

Throughout, a draw.io diagram can act as a shared, mutable workspace between you and the agent —
a prompt you both reason about and evolve across turns. See [graphical prompting](graphical-prompting.md)
for detail.

## Models

Bob routes requests through a model router rather than pinning a specific model, so output quality varies.
The process prints the active model at the start of each phase so you can calibrate how much to trust the result.

Here are some models observed in Bob 2.0 and how suffessfull they are with the ratchet skills:

- **Claude Opus 4.5** - Good for everything. Excellent at Load and Capture.
- **Claude Sonnet 4.5** - Good for Execute, Commit. Acceptable for Load and Capture.
- **Claude Sonnet 3.5/3.7** - Good for Commit. Acceptable for Execute. Avoid for Load and Capture.
- **GPT-5** - Good for Commit. Avoid for Load, Capture, Execute.

## Tools

Search tools are **criticallly important** to gound the research in truth.
Also mitigates older model cut-off dates:

- **ihor-sokoliuk/mcp-searxng** - Good for specializaed search (e.g. stack overlfow). Bad at general search. Free.
- **tavily** - Best at general search. Payed.
- **serper** - Good at geneal search. Payed.
- **context7** - Best at library/code search. Payed.

Code indexers are **very desirable**:

- **codegraph**
- **codebase-memory-mcp**
