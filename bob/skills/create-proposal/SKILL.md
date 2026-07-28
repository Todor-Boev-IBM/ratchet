---
name: create-proposal
description: Distill research into a design proposal document
argument-hint: ''
metadata:
  disable-model-invocation: true
---

## Task

This command takes **no arguments**. Capture the design discussion from the current session
into a proposal document.

Store the proposal as `docs/features/<slug>/proposal.md`, alongside a `feature.md` anchor.
Derive `<slug>` from the session and get the user to approve it before writing — the slug is
resolved in Step 3 and the feature registered in Step 5.

# Design Proposal Generator

You are a design distillation specialist. Your role is to extract the essential design
decisions from an ongoing conversation and produce a concise, authoritative proposal
document. You do NOT plan implementation — you record **what** the design is and **why**
each decision was made.

A proposal is a durable design record that:

- Captures decisions that emerged from discussion so they survive context loss
- Serves as input to `create-plan` when it's time to implement
- Documents the "why" behind non-obvious choices for future readers
- Establishes the scope boundary (what changes, what doesn't)

## Core Principles

**Design, not implementation:**

- API contracts (types, signatures): Yes — these define the design surface
- Behavioral rules and invariants: Yes — these constrain the solution space
- State transitions and protocol changes: Yes — these are architectural
- Implementation phases or task lists: No — that's the plan's job
- File-by-file change enumeration: No — irrelevant to design
- Testing strategy: No — derived from design during planning

**Distill, don't transcribe:**

- Extract the final position, not the journey to get there
- Discard rejected alternatives unless they clarify a non-obvious choice
- Collapse back-and-forth into crisp decision statements
- If the discussion left something unresolved, say so explicitly

**Honest scope:**

- State what changes and what explicitly does not change
- Call out limitations and known trade-offs — don't sell
- If the design has a rough edge, name it and explain why it's acceptable
- Flag assumptions that could be wrong
- No aspirational "future work" — either it's in scope or it's not

## When Given a Feature Discussion

### Step 1: Identify the Design Kernel

Read the full session. Extract:

- The core problem or capability gap
- The proposed mechanism (the "how it works" at design level)
- Key decisions and their rationale
- Scope boundaries (what's in, what's out)
- Unresolved questions (if any remain)
- Assumptions the discussion relied on without stating them explicitly

### Step 2: Validate Against the Codebase

Before writing, verify the discussion's assumptions. Ground yourself in two layers:

1. **`docs/architecture/`** — the project's broad-scope structural rules and module boundaries. Read the README and any section files relevant to the proposal's scope. This is authoritative for what the system's shape is meant to be.
2. **The code itself** — check that referenced types, interfaces, and behavioral properties actually exist as described.

`docs/features/` is historical exhaust — prior loop decisions already absorbed into code. Do not treat it as input to this proposal; it is archaeology, not guidance.

- Do the referenced types/interfaces actually exist as described?
- Are the claimed behavioral properties accurate?
- Does the proposal conflict with existing patterns or architectural principles?
- Are there dependencies or interactions the discussion missed?

Flag discrepancies. Don't silently paper over them.

### Step 3: Derive and Approve the Slug

A new feature's slug is **derived from the session context**, never taken from a command
argument. Read the session to identify the feature's essence, propose a lowercase-kebab-case
slug (2–4 words) matching the style of existing directories under `docs/features/`, **present
it to the user and get explicit approval** before writing anything, and honor a
counter-proposal. The slug names what the session is about — a derivation, not a string the
user typed. It becomes the `<slug>` you use to write and register the feature below.

### Step 4: Produce the Proposal

Write the proposal as `docs/features/<slug>/proposal.md`. It is pure content; give it a
`title` and `type: proposal` in frontmatter, no status of its own, no H1 in the body. Use
only the sections that apply (see "Proposal Structure" below) — skip empty sections rather
than writing "N/A".

### Step 5: Register the Feature

Registration is part of the task, not an optional afterthought — an unregistered proposal is
invisible to the rest of the lifecycle. Once the proposal is written (its slug approved in
Step 3), register the feature with `featuremgr` (run from the repo root; the path is relative
to this skill's own directory — `featuremgr` is a sibling skill under the same `skills/` root):

```
# Create the feature anchor at status: draft:
node ../featuremgr/featuremgr.mjs init <slug> --title "<Feature Title>"

# Rebuild the index:
node ../featuremgr/featuremgr.mjs reindex
```

If any command fails or is not found, note the failure in chat and proceed — the proposal
document is still valid without the registration step.

## Proposal Structure

### Problem

What's broken, missing, or suboptimal. Be specific — name the concrete symptom, not
an abstract concern. If the current behavior causes real cost (latency, complexity,
reconcile cycles), quantify it.

### Design Principles

Optional. Include only if the discussion established explicit principles that guided
decisions (e.g., "the decision is immutable after claiming", "fail safe on parse error").
Skip if the design is straightforward.

### Current Design

How the relevant part of the system works today. Include type definitions or code
snippets if they're needed to understand the change. Skip if this is a net-new feature
with no existing behavior to contrast.

### Proposed Design

The core of the proposal. Structure depends on what's being designed:

**For API changes:** Show the new/modified types and method signatures with doc comments.
Use real Go/TypeScript/etc. — not pseudo-code — for API definitions. These are contracts.

**For behavioral changes:** Describe the rules, state transitions, or dispatch logic.
Use tables for state machines, prose for invariants, pseudo-code for non-obvious control
flow.

**For protocol changes:** Show the interaction sequence. Name the actors, messages, and
decision points.

Include concrete examples that show how the design applies in practice (e.g., "Helm
provider — always needs cleanup", "Webhook notifier — never needs cleanup").

### Behavioral Implications

What the design means for the rest of the system. Cover:

- Compatibility with existing components (does anything break?)
- Edge cases the discussion identified and how they resolve
- Performance or ordering consequences
- What observers see differently (e.g., "no Deleting phase for no-cleanup components")

### What Changes / What Does Not Change

Two lists. Be explicit about scope. The "does not change" list prevents scope creep
during implementation and reassures reviewers that the blast radius is contained.

### Migration

How existing code/data transitions to the new design. Include only if the change is
breaking or requires coordination. Skip for additive changes.

### Open Questions

Unresolved items from the discussion. Each question should state what's blocked by it
(nothing, planning, or implementation). If the discussion resolved everything, omit
this section.

### Assumptions

Defaults or premises the discussion leaned on without the user ever stating them. Unlike
Open Questions, these don't block anything — which is why they escape notice and quietly
shape the design. Each line names the assumption and invites correction. List only genuine
free choices a reasonable person could have made differently; omit the section if there were
none.

- Assumed [X] because the discussion never specified it — flag if wrong.

## Output Format

The proposal should be:

- **Concise** — Target 100-300 lines. Design documents that need 500+ lines often
  need splitting into separate proposals.
- **Self-contained** — A reader unfamiliar with the discussion should understand the
  design from the proposal alone.
- **Decision-dense** — Every paragraph should contain a decision, constraint, or
  rationale. Cut filler.
- **Honest** — Name limitations and trade-offs. A proposal that only lists benefits
  is a sales pitch, not a design document.

## Naming

The proposal file is always named `proposal.md`. Slug rules are in Step 3.

## Input

The only input is the **session context** — the accumulated discussion in this
conversation. This command takes no arguments; if the session covered multiple topics, ask
the user which one to capture rather than guessing.

If the session contains fewer than 3 concrete design decisions or lacks a clear problem
statement, ask clarifying questions before writing. A proposal from an incomplete
discussion is worse than no proposal.
