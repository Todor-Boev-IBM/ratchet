---
name: create-proposal
description: Distill a design discussion into a proposal document
argument-hint: <feature>
metadata:
  disable-model-invocation: true
---

## Task

Capture the design discussion from this session into a proposal document for $1.

Store the proposal as `docs/features/<slug>/proposal.md`, alongside a `feature.md` anchor
(see "Register the feature" below).

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

Before writing, verify the discussion's assumptions:

- Do the referenced types/interfaces actually exist as described?
- Are the claimed behavioral properties accurate?
- Does the proposal conflict with existing patterns?
- Are there dependencies or interactions the discussion missed?

Flag discrepancies. Don't silently paper over them.

### Step 3: Produce the Proposal

Write a structured markdown document. Use only the sections that apply — skip empty
sections rather than writing "N/A".

## Proposal Structure

### Title

`# Proposal: [Concise Name]`

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

## Critical Guidelines

**DO:**

- Show API contracts as real code (types, signatures, doc comments)
- State design invariants explicitly ("the decision is immutable after claiming")
- Include concrete examples for each variant of behavior
- Name what doesn't change to bound the scope
- Flag assumptions and limitations

**DO NOT:**

- Include implementation phases, steps, or sequencing
- Enumerate files that will be modified
- Describe testing strategy (that's planning)
- Rehash the discussion — distill it
- Include pseudo-code where real type definitions suffice
- Write aspirational "future work" sections — either it's in scope or it's not

**Naming:** Use lowercase-kebab-case for the feature slug: `docs/features/{short-name}/`.
The proposal file is always named `proposal.md`. Match the slug style of existing features.

## Input

The primary input is the **session context** — the accumulated discussion in this
conversation. The feature description parameterizes what to focus on if the session
covered multiple topics.

If the session contains fewer than 3 concrete design decisions or lacks a clear problem
statement, ask clarifying questions before writing. A proposal from an incomplete
discussion is worse than no proposal.

## Register the feature (docmgr)

A proposal lives inside a feature directory. When you write it:

1. Create the feature directory `docs/features/<slug>/` and write two files.

`feature.md` — the anchor. Its frontmatter carries the feature's only stored state,
its `status`:

```
---
title: "<Feature Title>"
status: draft
---
One-line statement of what this feature is.
```

Use `status: draft` here — a proposal captures a design without committing to build
it yet. `create-plan` promotes the feature to `active` when the work is committed, and
Triage sets `done`/`abandoned` later. Never write `done`/`abandoned` yourself.

   `proposal.md` — the design document itself (the structure above). It is pure content;
   give it at most a `title` in frontmatter and no status of its own. The feature's state
   lives only on `feature.md`.

2. Refresh the index (run from the repo root):

   ```
   node ~/.bob/tools/docmgr.mjs reindex
   ```

   If the reindex command fails or the tool is not found, note the failure in your response
   and instruct the user to run it manually before proceeding.
