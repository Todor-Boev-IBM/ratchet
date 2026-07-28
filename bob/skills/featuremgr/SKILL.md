---
name: featuremgr
description: Internal tool bundle — not a standalone skill. Provides the featuremgr.mjs
  CLI (init/mark/reindex/check/triage) that other ratchet skills invoke directly by sibling
  path.
metadata:
  disable-model-invocation: true
---

## What this is

This directory is not meant to be invoked on its own. It exists so `featuremgr.mjs` and its
`lib/` are shipped as files alongside the other ratchet skills when installed via `npx skills
add`. Peer skills (`create-proposal`, `create-plan`, `execute-plan`, `triage`) call the script
directly from their own `SKILL.md` instructions, using a path relative to their own skill
directory. Do not add task instructions here for an agent to follow.

## CLI reference

Invoke by a path **relative to the calling skill's own directory** — `featuremgr` is a sibling
skill under the same `skills/` root. Run all commands from the repo root:

```txt
node ../featuremgr/featuremgr.mjs init   <slug> --title <title> [--purpose <text>]
node ../featuremgr/featuremgr.mjs mark   <slug> <status>
node ../featuremgr/featuremgr.mjs reindex             # rebuild docs/index.md from the tree
node ../featuremgr/featuremgr.mjs check                # structural audit (report-only)
node ../featuremgr/featuremgr.mjs triage [--docs <d>]  # open features, oldest-first, age-banded
```

All commands accept `--docs <dir>` to target a non-default docs directory.

**`init <slug> --title <title>`** — Create `docs/features/<slug>/feature.md` at `status: draft`.
Fails with exit 1 if the slug already exists. Pass `--purpose` for the one-line body text.

**`mark <slug> <status>`** — Transition a feature's status with precondition guards:

- `draft → active`: `plan.md` must exist with a `## Phases` section
- `active → in-review`: all `### Phase` headings in `plan.md` must carry `✅`
- `in-review → done`: no document precondition (phases proven at `active → in-review`)
- `draft/active/in-review → abandoned`: no document precondition
- Any transition from `done` or `abandoned`: rejected (terminal statuses are immutable)
- Same-status mark: no-op (prints "nothing to do")

**`reindex`** — Regenerate `docs/index.md`. Run after any `init`, `mark`, or plan phase update.

**`check`** — Report structural problems (missing `feature.md`, invalid `status`, plan with no
`## Phases` section, etc.). Never mutates.

**`triage`** — Print the open (`draft`/`active`/`in-review`) features, stalest first, each flagged
`[actionable]` when finishable or ≥1 week untouched, and `[arch-pending]` until
`reconcile-arch` stamps `arch-merged`.

If a command fails or is not found, note it and proceed — the feature documents themselves
remain valid without the update.
