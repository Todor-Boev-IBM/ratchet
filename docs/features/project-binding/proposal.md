---
title: "Project Binding"
type: proposal
---

## Problem

Ratchet installs entirely into `~/.bob`. A repository carries no signal that it is developed
with ratchet, and ratchet carries no signal about which repository it is operating on. Three
consequences follow.

**The skill namespace collides with Bob's.** Ratchet ships `create-plan`, which is also the
slug Bob's built-in Plan mode hardcodes in its instructions: _"Must always start of every
planning session, call `use_skill` with `skill_name: "create-plan"`."_ The global ratchet skill
wins that resolution. Combined with `skill` and `mode` both present in
`allowed_permissions`, there is an unattended path:

1. Bob switches to Plan mode on its own — documented behaviour, auto-approved via `mode`.
2. Plan mode's instructions fire `use_skill create-plan` — auto-approved via `skill`.
3. The slug resolves to ratchet's skill.
4. It writes `docs/features/<slug>/plan.md` and runs `featuremgr init` — auto-approved via
   `edit` and `execute`.

This contradicts ratchet's own restraint rule, stated in the research mode: _"Proposals and
plans exist only as output of `/create-proposal` and `/create-plan`, which only the user can
invoke."_ That invariant is currently false, and it is false through a path the workflow never
configured.

**Every repository is a ratchet repository.** Because the override is global and bound to a
built-in mode, Plan mode runs ratchet in any directory — unrelated repos, scratch work,
someone else's codebase. "Ratchet project" cannot be a meaningful category while the process
is installed at machine scope and occupies a vendor slug.

**Phases without mechanism decay to zero.** Measured in cox-runtime across 48 features, one
developer, sustained motivation:

| Phase                         | Mechanically enforced                             | Adherence |
| ----------------------------- | ------------------------------------------------- | --------- |
| Plan exists before code       | `featuremgr` precondition on `draft → active`     | 48/48     |
| Phases marked complete        | `featuremgr` precondition on `active → in-review` | 40/40     |
| `arch-merged` stamp           | none — `reconcile-arch` sets no status            | 0/48      |
| Features abandoned via triage | none — human-invoked, no precondition             | 0/48      |

Where a precondition exists, adherence is total. Where the phase depends on recall, it is
zero. The two phases at zero are Reconcile and Triage — the phases that run when attention is
lowest, which is the resource the workflow is built to conserve. Part of the `arch-merged` gap
is chronological (`reconcile-arch` postdates most of those features) but the signal holds: an
unstamped reconciliation is indistinguishable from a skipped one.

**The process is invisible where it is shared.** `docs/features/` is in the repository and is
read by collaborators — draft proposals are used to consult them. Nothing in the repository
states what the directory is, whether producing one is required, or that the index only covers
work done through ratchet. A partial record presented as a complete one is worse than no
record.

## Design Principles

- **Process is personal; project context is repo-scoped.** Skills describe how a developer
  works and travel with the developer. Rules, constraints, and artifacts describe the codebase
  and stay with it. Placement follows ownership, not convenience.
- **Bind by declaration, not coercion.** A repository states that it uses ratchet. It does not
  compel anyone to. Collaborators using another process remain first-class.
- **Mechanism over recall.** Any phase whose execution depends on the developer remembering it
  will trend to zero. If a phase matters, it needs a precondition or a prompt that arrives
  without being asked for.
- **Never occupy a vendor slug.** Depending on undocumented precedence between built-in,
  global, and project skills is a silent failure waiting for a point release.

## Current Design

`install.sh` copies `bob/skills/*` to `~/.bob/skills/`, merges `custom_modes.yaml` by slug, and
writes `communication-style.md` to `~/.bob/rules/`. `mcp.json` is excluded and merged by hand.

Repositories contain `.bob/mcp.json` (codegraph path) and, in ratchet projects, `docs/features/`
and `docs/architecture/`. Nothing else marks a repository as participating. Gates are
conventional CI outside ratchet's scope, and remain so.

## Proposed Design

### 1. Namespace the skills

Prefix all skills with `ratchet-`: `ratchet-create-plan`, `ratchet-execute-plan`,
`ratchet-create-proposal`, and so on.

This releases `create-plan` back to Bob, restoring built-in Plan mode to its intended
behaviour, and restores the restraint invariant — a `ratchet-` skill can only be reached by the
user naming it. It also removes the dependency on an undocumented resolution order.

`featuremgr` is tooling rather than a workflow verb and is invoked by other skills, not by the
user; it keeps its name.

### 2. Distribution stays global

Skills, modes, `communication-style.md`, and `featuremgr` remain in `~/.bob`. Reasons:

- The skills are still changing. One copy means one edit propagates to every repository.
- Features span repositories (relay-connector crosses cox-runtime and cox-integrations).
  Per-project skills would put two copies inside one feature with nothing keeping them equal.
- After namespacing, global skills are already inert in non-ratchet repositories. Vendoring
  would solve a problem the rename has closed.

The trigger to revisit is handing ratchet to a team, at which point the process must be
reviewable in a pull request and pinned per repository. If that happens, follow
how-we-work-starter's shape: commit the source form, generate the installed form, gitignore the
output — so vendored copies cannot drift by construction.

### 3. Repository declaration layer

A ratchet project is defined by what it declares, not by carrying the tooling:

| Artifact                    | Audience                          | Coercive |
| --------------------------- | --------------------------------- | -------- |
| `AGENTS.md`                 | every tool — Bob, Copilot, Claude | no       |
| `.bob/rules/CONSTRAINTS.md` | all Bob users in this repo        | no       |
| `.bob/rules-{slug}/`        | ratchet modes only                | no       |
| `docs/README.md`            | humans                            | no       |
| `.bob/settings.json` hooks  | all Bob users in this repo        | **yes**  |

`AGENTS.md` carries repository facts, not ratchet process — where architecture docs live, the
commit format, build commands. It is the substantive shared document precisely because it
survives Bob. `.bob/rules/` stays a thin pointer rather than a second copy.

`CONSTRAINTS.md` is borrowed from how-we-work-starter: absolute prohibitions, each stated as
prohibition, reason, and correct alternative. It binds the codebase rather than the person and
benefits collaborators who have never heard of ratchet. Mined from review history, not invented.

`.bob/rules-{slug}/` carries the ratchet process itself. Bob loads it only when that mode is
active, so it is version-controlled and reviewable while remaining invisible to anyone working
in another mode. Per-project variation — different planning conventions for a TypeScript
repository than a Go one — belongs here, layered onto the same global skill.

`docs/README.md` closes the visibility gap in a paragraph: what `features/` is, that drafts are
open for comment, that producing one is not required, and that the index covers only work done
through this process so absence means nothing.

### 4. Lifecycle hooks

Bob supports shell hooks in `~/.bob/settings/settings.json` (global) and `.bob/settings.json`
(workspace, merged on top). `SessionStart` and `UserPromptSubmit` write stdout into model
context; `UserPromptSubmit` and `PreToolUse` block on exit code 2.

**`SessionStart`, global, no-op when `docs/features/` is absent.** Emits `featuremgr` state:
features in review without `arch-merged`, stale drafts, what is active. Reconcile and Triage
fail as recall problems; this puts their inputs in front of the developer before any attention
has been spent. Non-blocking by design.

Global rather than per-project, deliberately. Hooks run unsandboxed with full user permissions,
so a repository shipping `.bob/settings.json` executes its author's shell on every collaborator
who opens it. Keeping hooks global removes that exposure entirely and still works everywhere.

**`PreToolUse` matching `^write_file$`.** Enforces proposal immutability, which the skills
currently only request. A proposal belonging to a feature at `status: done` is frozen; the hook
blocks the write.

### 5. `arch-merged` becomes a precondition

`featuremgr` gains a precondition on `in-review → done`: the feature must carry an
`arch-merged` stamp, or an explicit marker that it has no architectural impact. This is the only
transition currently without one, and it guards the phase measured at 0%.

## Behavioral Implications

- Bob's Plan mode returns to Bob's behaviour. Ratchet planning becomes explicit invocation only.
- Non-ratchet repositories become genuinely non-ratchet. Opening a scratch directory no longer
  risks a `docs/features/` tree.
- Collaborators are unaffected in every layer except hooks, which is why hooks stay global.
- The `SessionStart` hook consumes context tokens on every session in a ratchet repository.
  Output must stay terse.
- Existing `docs/features/` content is untouched. The changes are additive.

## What Changes / What Does Not Change

**Changes**

- All ratchet skills gain a `ratchet-` prefix; `install.sh` installs under the new names.
- `~/.bob/settings/settings.json` gains `SessionStart` and `PreToolUse` hooks.
- `featuremgr` gains an `arch-merged` precondition and a hook-friendly status output mode.
- Ratchet projects gain `AGENTS.md`, `.bob/rules/CONSTRAINTS.md`, `.bob/rules-{slug}/`, and
  `docs/README.md`.

**Does not change**

- Distribution remains global. No vendoring, no per-project skill copies.
- Gates remain conventional CI, outside ratchet's scope.
- The phase model, the feature lifecycle states, and the artifact formats are untouched.
- No collaborator is required to adopt anything.
- `docs/features/` stays in the repository and stays shared.

## Migration

1. Rename skill directories and their `name:` frontmatter; remove the old ones from `~/.bob`.
2. Update cross-references between skills — `create-plan` is named inside `create-proposal`,
   `triage`, and `reconcile-arch`.
3. Update `custom_modes.yaml` where modes name skills.
4. Delete `cox-runtime/.github/prompts/` — abandoned Copilot ports still visible in that
   tool's prompt picker as a stale ratchet v1.

No repository content requires migration.

## Open Questions

- Does an `arch-merged` precondition dead-end features with genuinely no architectural impact?
  A "no arch impact" stamp is the obvious escape, but it is also the obvious way to route
  around the gate. Blocks implementation of item 5.
- What is an acceptable context cost for `SessionStart` output? Blocks nothing; needs a budget
  before the hook is written.
- Bob's `workflow` tool group and "pre-defined workflows" are unexamined and may overlap what
  `featuremgr` does by hand. Blocks nothing; worth reading before building item 5.

## Assumptions

- Assumed collaborators must never be compelled to use ratchet, and that this outweighs the
  completeness of the feature index — flag if wrong.
- Assumed global distribution stays correct because ratchet remains a single-developer
  workflow. The decision inverts if it is handed to a team.
- Assumed Bob's skill precedence (project over global over built-in) holds. It is observed,
  not documented, which is itself an argument for namespacing.
- Assumed hooks are the right enforcement layer rather than extending `featuremgr` into a
  daemon or pre-commit hook — chosen because hooks are already in Bob and require no new
  process.
