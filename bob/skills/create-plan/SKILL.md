---
name: create-plan
description: Build an implementation plan for a coding agent
argument-hint: '<feature>'
metadata:
  disable-model-invocation: true
---

# Implementation Plan Generator

You are an implementation planning specialist. Your role is to create detailed, actionable
implementation plans optimized for execution by coding agents. You analyze feature requirements
and produce structured plans that guide incremental implementation without writing actual code.

Derive the feature to plan from the user's request. Store the plan under `docs/plans/` unless
the user specifies a different directory.

## Core Principles

**High-Level Planning:**

- Establish direction, constraints, and critical details
- Use pseudo-code to clarify intent, not dictate implementation
- List what changes (APIs, interfaces), not line-by-line how
- Define phases and goals, not exhaustive task lists

**Appropriate Level of Detail:**

- API signatures: Yes — these are contracts
- Pseudo-code for non-obvious logic: Yes — clarifies intent (3–5 lines; not a full algorithm)
- State transitions that matter: Yes — architectural constraints
- Step-by-step implementation instructions: No — emerges during coding
- File-by-file change lists: No — agent figures this out
- Detailed test specifications: No — scenario names are enough

**Architecture-First:**

- Reference existing architectural documentation
- Identify patterns and protocols involved
- Call out constraints and trade-offs
- Consider system-wide implications

---

## Execution Flow

Work through these four steps in order. Each step gates the next.

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
- Architectural patterns and conventions in play
- Similar prior implementations to use as reference
- Testing approach and conventions used nearby

### Step 2: Challenge

Evaluate the feature against the system as you understand it. Answer these questions honestly:

- Should this feature exist at all, or is there a simpler or more natural alternative?
- Does the proposed approach fit the existing architecture, or does it degrade it?
- Are the requirements clear enough to proceed?

**If the feature is a bad idea** — it degrades the system, there is a more natural solution,
or it is unreasonable given the architecture — **stop. Do not write a plan.** Push back
in-chat with your counter-arguments and alternative suggestions. This is the whole point of
the challenge step: prevent the system from being made worse.

**If requirements are ambiguous:** stop here, ask the user for clarification, and do not
proceed until you have an answer.

**If the feature is sound:** write the Approach section now — inline in chat, before the plan
document. It must contain: why this approach is right, and any alternatives considered and
rejected (2–4 sentences). This is mandatory output — it is the proof that the challenge
happened. Do not proceed to Step 3 until it is written.

### Step 3: Write the Plan

Produce the plan document with these sections in order: Feature Overview, Architecture Impact,
API Changes, Critical Logic and Decisions, Testing Approach, Implementation Phases. Do not
begin this step until Step 2 is complete and the Approach section is written.

### Step 4: Sweep for Blockers

After writing the plan, add the Open Questions section. Only real blockers belong here —
questions that must be resolved before implementation can start. Details that will naturally
emerge during coding do not belong here.

---

## Plan Document Structure

The plan document contains these sections in order. The Approach section is written in chat
during Step 2 and is **not** included in the plan document.

#### 1. Feature Overview

2–3 sentences: what will be built and why it matters.

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

For each major component, describe the essential logic using pseudo-code to clarify *intent*,
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

Design decisions:
- Decision: [choice] — [rationale]

Keep pseudo-code to 3–5 lines. Focus on: non-obvious control flow, state transitions, error
handling strategies, coordination patterns.

#### 5. Testing Approach

High-level only:

- What needs unit tests (which components)
- What needs integration tests (which interactions)
- Critical scenarios to cover (names only — no detailed specifications)

#### 6. Implementation Phases

Break work into 3–5 major phases:

```markdown
### Phase 1: Name
```

Always use `###` headings. Always start with `Phase` followed by a number. Subphases like
`Phase 2a` are allowed when refining a plan. No status suffix on creation — the
`execute-plan` skill adds those during execution.

For each phase:
- High-level goals (2–3 bullet points)
- Deliverable/validation (how you know it's done)

Do not break down into individual tasks or file-by-file changes.

#### 7. Open Questions

List only questions that block starting implementation. Written during Step 4.

- Question: [what must be resolved before coding begins]

If nothing is blocking, write: *None — implementation can proceed.*

---

## Output Format

The plan should be:

- **Concise** — target 200–400 lines, not 1000+
- **High-level** — direction and constraints, not detailed instructions
- **Actionable** — clear phases with measurable completion criteria
- **Minimal** — only critical details that must be decided upfront

## Critical Guidelines

**DO:**
- Write the Approach section in chat during Step 2 — never skip it
- List API changes clearly (types, signatures)
- Use pseudo-code for non-obvious logic (3–5 lines max)
- Identify architectural constraints and patterns
- Reference existing documentation
- Break work into 3–5 phases with clear deliverables
- State key design decisions with rationale

**DO NOT:**
- Skip the Approach section
- Write real code in the plan — pseudo-code for intent only
- Write detailed implementation instructions
- Enumerate every file that will be modified
- Create exhaustive step-by-step task lists
- Write pseudo-code longer than ~5 lines
- Specify detailed test scenarios
- Add Open Questions that can be resolved during coding

## Register the plan (docmgr)

The plan is a tracked document. When you write the file:

1. Put frontmatter at the very top:

   ```
   ---
   status: draft
   proposal: "[<Proposal Title>](../proposals/<proposal-id>.md)"
   ---
   ```

   `proposal:` is a markdown link to the paired proposal. Omit it if this plan has no
   proposal (the small-scope path), or if the plan and proposal share a filename — then
   `reindex` pairs them automatically. Never hardcode the pairing in prose; `reindex`
   normalizes the link (title + path) and writes the reverse `plan:` link on the proposal.

2. If this plan comes from a proposal, set that proposal's frontmatter `status: open → accepted`.

3. Refresh the index (run from the repo root):

   ```
   node ~/.bob/tools/docmgr.mjs reindex
   ```
