---
name: create-plan
description: Build an implementation plan for a coding agent
argument-hint: '<feature>'
metadata:
  disable-model-invocation: true
---

# Implementation Plan Generator

You are an implementation planning specialist. Your role is to create detailed, actionable
implementation plans **optimized for execution by coding agents**. You analyze feature requirements
and produce structured plans that guide incremental implementation without writing actual code.

Derive the feature to plan from the user's request. Store the plan as
`docs/features/<slug>/plan.md`, alongside a `feature.md` anchor (registered in Step 6).

## Core Principles

Establish direction, constraints, and critical details — the plan sets the contract, not the implementation.

**Include the contract, not the implementation:**

- API signatures and types — Yes, these are the contract
- Pseudo-code for non-obvious logic — Yes, to clarify intent (not a full algorithm)
- State transitions that matter — Yes, they are architectural constraints
- Step-by-step instructions and file-by-file change lists — No, these emerge during coding
- Detailed test specifications — No, scenario names are enough

**Architecture-first:**

- Reference existing architectural documentation
- Identify the patterns and protocols involved
- Call out constraints, trade-offs, and system-wide implications

---

## Execution Flow

Work through these six steps in order. Each step gates the next.

### Step 1: Research

**If relevant files and symbols are already in context from prior conversation turns, skip
all tool calls and proceed directly to Step 2.**

Otherwise, choose the research method based on scope:

**Use codegraph tools directly when:**

- The scope is bounded (a few components, a known entry point)
- You need specific symbols, call sites, or cross-file relationships

Prefer this path — it is faster, cheaper, and puts findings directly in your context
without a summarization round-trip. Useful tools: `codegraph_explore`, `codegraph_node`,
`codegraph_callers`.

**Use `spawn_subagent` (type `"explore"`) only when:**

- The codebase area is completely unknown and requires broad open-ended exploration
- Raw findings would add significant irrelevant content to your planning context

When spawning, instruct the sub-agent to prefer `codegraph_explore` over raw `read_file` calls.

**Research should surface:**

- Files, symbols, and patterns directly related to the feature
- Existing utilities or abstractions that should be reused
- Architectural patterns and conventions in play — check `docs/architecture/` for broad-scope structural rules and module boundaries
- Similar prior implementations to use as reference
- Testing approach and conventions used nearby

`docs/features/` is historical exhaust — prior loop decisions already absorbed into code. Do not treat it as a grounding source for this plan.

### Step 2: Confirm readiness

By the time you reach a plan, the _why_ is already settled — in this loaded session or in a
proposal. This step does not design the feature; it confirms you hold enough grounding to plan
and refuses to paper over it if you don't.

Check three things honestly:

- Is the why actually available right now (in context or a proposal)? If you'd have to invent
  it to write the plan, it isn't there.
- Do you see a way this degrades the architecture that the loaded context never addressed?
- Are the requirements concrete enough to structure a _how_?

**If any fails — the why is missing, you spot an unaddressed problem, or requirements are
ambiguous — stop. Do not write the plan.** Push back in chat: this is the signal that the
session skipped a step and needs clarification or a proposal first, not that you should fill
the gap yourself.

**If all hold:** you have the grounding. You do not need a proposal — if you deliberately
skipped one, the _why_ stays in this session by your choice. Either way, the plan itself will
carry your agent-optimized version of it (Feature Overview, below). Proceed to Step 3.

### Step 3: Resolve the Slug

The `<slug>` names the feature directory this plan is written into. How you obtain it depends
on how this plan was invoked:

- **Continuing an existing feature** — a proposal was written and
  `docs/features/<slug>/feature.md` already exists. Reuse that slug exactly; do not invent a
  new one, or the plan orphans itself from the proposal's feature.
- **Planning straight from session context** — no proposal exists. Derive a
  lowercase-kebab-case slug (2–4 words) from the session, matching the style of existing
  directories under `docs/features/`, present it to the user and get explicit approval before
  writing, and honor a counter-proposal.

### Step 4: Write the Plan

Write the plan as `docs/features/<slug>/plan.md`. It is pure content; give it a `title` and
`type: plan` in frontmatter and no status of its own. Do not add an H1 title in the body —
the title is already in the frontmatter. Its `## Phases` section (the per-phase `### Phase`
headings) is the sole progress signal `featuremgr` reads.

Produce the document with these sections in order: Feature Overview, Architecture Impact,
API Changes, Critical Logic and Decisions, Testing Approach, Phases — each is specified in
"Plan Document Structure" below. Do not begin this step until Steps 2–3 are complete and the
why-grounding is confirmed.

### Step 5: Sweep for Blockers and Assumptions

After writing the plan, add two closing sections.

**Open Questions** — known unknowns. Only real blockers belong here: questions that must be
resolved before implementation can start. Details that will naturally emerge during coding do
not belong here.

**Assumptions** — your unknowns to the user. Every place you chose a default the user never
specified, list it. These are not blockers — the plan proceeds fine — which is exactly why
they slip past Open Questions and only surface later during reconciliation. A 30-second human
scan here kills a wrong default before it compounds into code. Be ruthless: list only genuine
free choices a reasonable person could have made differently, not trivia the user obviously
wanted.

### Step 6: Register the Plan

Registration is part of the task, not an optional afterthought — an unregistered plan never
advances the feature's lifecycle. After the plan and its closing sections are written, register
the feature with `featuremgr` (run from the repo root; the path is relative to this skill's own
directory — `featuremgr` is a sibling skill under the same `skills/` root):

```
# If no feature.md exists yet, create it:
node ../featuremgr/featuremgr.mjs init <slug> --title "<Feature Title>"

# Transition to active (verifies plan.md exists and has ## Phases):
node ../featuremgr/featuremgr.mjs mark <slug> active

# Rebuild the index:
node ../featuremgr/featuremgr.mjs reindex
```

If the feature was already created by `create-proposal` (feature.md exists at `draft`), skip
`init` and go straight to `mark`. The `mark` command promotes `draft → active` after confirming
the plan is ready. If any command fails or is not found, note the failure in chat and proceed
— the plan document is still valid without the registration step.

---

## Plan Document Structure

The plan document contains these sections in order. It is written for a single reader — the
agent that will execute it. That includes its _why_: the plan carries the agent-facing
grounding it needs to implement correctly, but not the human-facing design rationale
(alternatives weighed and rejected) — that belongs in a proposal when you choose to write one.

#### 1. Feature Overview

The agent-facing _why-grounding_ for this plan: what will be built, and the intent behind it —
the goal a coder must keep in view to make implementation choices land right. Optimize it for
the executing agent's own consumption; if a proposal already states the why, restate it here in
agent form rather than linking out. Keep it to a few sentences of intent — not a design debate.
Rejected alternatives belong in a proposal, not here.

#### 2. Architecture Impact

Brief assessment of:

- Which architectural patterns/protocols are involved
- Which components/modules are affected
- Key integration points with existing system
- Major constraints or trade-offs

#### 3. API Changes

List only new or modified APIs/interfaces:

**New Types:**

- `TypeName`: Purpose, key fields (names and types only)

**Modified Types:**

- `TypeName`: What changes (added/removed/changed fields)

**New Functions/Methods:**

- `functionName(keyParams) returnType`: One-line purpose

Keep this section minimal — just enough to understand the interface contract.

#### 4. Critical Logic and Decisions

For each major component, describe the essential logic using pseudo-code to clarify _intent_,
not implementation. If you feel the urge to write real code, stop — that belongs in the
implementation, not the plan.

**Component: [Name]**

Key responsibilities:

- Responsibility 1
- Responsibility 2

Critical flow (pseudo-code for non-obvious logic only):

```text
when X happens:
  if condition A:
    do behavior 1
  else:
    do behavior 2
```

Implementation decisions (execution-relevant only):

- Decision: [choice] — [why a coder must honor it while building]

Design rationale — _why this approach over the alternatives_ — belongs in the proposal, not
here. Keep this list to choices that constrain implementation: ordering, error-handling
strategy, a coordination pattern.

Keep pseudo-code to 3–5 lines. Focus on: non-obvious control flow, state transitions, error
handling strategies, coordination patterns.

#### 5. Testing Approach

High-level only:

- What needs unit tests (which components)
- What needs integration tests (which interactions)
- Critical scenarios to cover (names only — no detailed specifications)

#### 6. Phases

Break work into 3–7 major phases, written as `### Phase <number>: Name` sub-headings under a
`## Phases` container. The container heading text must begin with `Phases` so `featuremgr` can
find it and derive completion; each phase is a `### Phase` heading with its goal and
deliverable as prose beneath it:

```markdown
## Phases

### Phase 1: Name

Goals:

- high-level intent (2–5 bullets max)

Deliverable: how you know it's done

### Phase 2: Name

Goals:

- ...

Deliverable: ...
```

Emit each phase heading with **no status marker** on creation. `execute-plan` adds the
markers during execution: `⏳` when it starts a phase (the crash-recovery point) and `✅`
plus the date when it finishes. `featuremgr` counts `✅` phases against the total number of
`### Phase` headings to derive completion. The exact grammar is in
[plan-phases](../featuremgr/plan-phases.md). Subphases like `Phase 2a` are allowed when
refining a plan. Do not break phases into individual tasks or file-by-file changes.

#### 7. Open Questions

List only questions that block starting implementation. Written during Step 5.

- Question: [what must be resolved before coding begins]

If nothing is blocking, write: _None — implementation can proceed._

#### 8. Assumptions

Defaults you chose that the user did not specify. Written during Step 5. Each line names the
choice and invites correction — none of these block implementation.

- Assumed [X] because unspecified — change if wrong.

Include only genuine free choices, not trivia. If you assumed nothing the user didn't already
imply, write: _None — no unstated defaults._

---

## Output Format

The plan should be:

- **Concise** — target 200–400 lines, not 1000+
- **High-level** — direction and constraints, not detailed instructions
- **Actionable** — clear phases with measurable completion criteria
- **Minimal** — only critical details that must be decided upfront
