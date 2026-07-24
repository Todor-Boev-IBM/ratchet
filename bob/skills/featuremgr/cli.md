# The `featuremgr` CLI

How the skills invoke `featuremgr.mjs` to manage feature lifecycle and maintain the index.

Invoke by a path **relative to the calling skill's own directory** — `featuremgr` is a sibling
skill under the same `skills/` root. Run all commands from the repo root:

```txt
node ../featuremgr/featuremgr.mjs init   <slug> --title <title> [--purpose <text>]
node ../featuremgr/featuremgr.mjs mark   <slug> <status>
node ../featuremgr/featuremgr.mjs reindex            # rebuild docs/index.md from the tree
node ../featuremgr/featuremgr.mjs check               # structural audit (report-only)
node ../featuremgr/featuremgr.mjs triage [--docs <d>] # open features, oldest-first, age-banded
```

All commands accept `--docs <dir>` to target a non-default docs directory.

## Commands

**`init <slug> --title <title>`** — Create `docs/features/<slug>/feature.md` at `status: draft`.
Fails with exit 1 if the slug already exists. Pass `--purpose` for the one-line body text.

**`mark <slug> <status>`** — Transition a feature's status with precondition guards:
- `draft → active`: `plan.md` must exist with a `## Phases` section
- `active → done`: all `### Phase` headings in `plan.md` must carry `✅`
- `draft/active → abandoned`: no document precondition
- Any transition from `done` or `abandoned`: rejected (terminal statuses are immutable)
- Same-status mark: no-op (prints "nothing to do")

**`reindex`** — Regenerate `docs/index.md`. Run after any `init`, `mark`, or plan phase update.

**`check`** — Report structural problems (missing `feature.md`, invalid `status`, plan with no
`## Phases` section, etc.). Never mutates.

**`triage`** — Print the open (`draft`/`active`) features, stalest first, each flagged
`[actionable]` when finishable or ≥1 week untouched, and `[arch-pending]` until
`reconcile-arch` stamps `arch-merged`.

If a command fails or is not found, note it and proceed — the feature documents themselves
remain valid without the update.
