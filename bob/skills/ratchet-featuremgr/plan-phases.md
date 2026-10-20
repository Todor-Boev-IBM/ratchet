# Plan phase grammar

Defines the `## Phases` contract in `plan.md` — authored by `ratchet-create-plan`, marked by
`ratchet-execute-plan`, and read by `ratchet-featuremgr` to derive completion.

Plan progress is derived from the `plan.md` body — it is **never** copied into frontmatter.
`ratchet-featuremgr` reads exactly this shape:

```markdown
## Phases

### Phase 1: Foundation ✅ 2026-07-19

Goals:

- ...

### Phase 2: Core Logic ⏳

Goals:

- ...

### Phase 3: Polish
```

- Phases are the `### Phase <number>: Name` sub-headings **inside the `## Phases` section**.
  Headings elsewhere are ignored; the next `##` heading ends the section.
- Marker emoji in a phase heading:
  - `✅` — phase complete (conventionally followed by a date)
  - `⏳` — phase started, not finished — the crash-recovery resume point
  - *no marker* — not started
- **The emoji are what the tooling parses.** Place them at the end of the heading before any
  date. Leave each phase's goal/deliverable prose untouched — only the heading marker changes.
- Completion is `count(✅) / count(### Phase)`. A feature is *finishable* when all phases
  carry `✅`; that is a signal, not a status.
