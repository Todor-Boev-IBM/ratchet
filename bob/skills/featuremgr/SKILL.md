---
name: featuremgr
description: Internal tool bundle — not a standalone skill. Provides the featuremgr.mjs
  CLI (reindex/check/triage) that other ratchet skills invoke directly by sibling path.
metadata:
  internal: true
---

## What this is

This directory is not meant to be invoked on its own. It exists so `featuremgr.mjs` and its
`lib/` are shipped as files alongside the other ratchet skills when installed via `npx skills
add`. Peer skills (`create-proposal`, `create-plan`, `execute-plan`, `triage`) call the script
directly from their own `SKILL.md` instructions, using a path relative to their own skill
directory:

```
node ../featuremgr/featuremgr.mjs <reindex|check|triage> [--docs <dir>] [--out <file>]
```

Do not add task instructions here for an agent to follow — this file only carries the tool's
metadata so an installer that discovers skills by `SKILL.md` also ships this directory's
contents. See `featuremgr.mjs`'s header comment for the CLI's own documentation.
