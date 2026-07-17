---
name: prepare-next-commit
description: Create the next atomic git commit from unstaged changes
argument-hint: <project>
metadata:
  disable-model-invocation: true
---

## Task

Create the next atomic commit for project $1 from unstaged changes.

Run repeatedly until all changes are committed. Each invocation handles one logical unit.

## Workflow

**On each invocation:**

1. Check for unstaged changes
   - If none: inform user "All changes committed" and exit
2. Select next logical unit
   - Use Selection Priority below
   - Pick smallest coherent change
3. Stage selected files
   - `git add <files>`
4. Generate commit message
   - Follow Conventional Commit Format below
   - Follow Style Guide below
5. Present to user
   - Show which files
   - Show proposed message
   - Explain grouping rationale
   - Ask for approval
6. Handle user response
   - Approved → commit
   - Skip → unstage, find next unit
   - Include more → add files, present again
   - Edit → regenerate message
   - Custom message → use it
7. After successful commit
   - Show remaining unstaged files
   - Remind to run again

## Selection Priority

Pick the smallest logical unit in this order:

1. **Build/tooling** - Dockerfile, Makefile, build scripts, .github/
2. **Dependencies** - go.mod/go.sum, package.json, requirements.txt
3. **Refactoring** - Code restructuring without behavior change
4. **Features/fixes** - New functionality or bug fixes (with tests)
5. **Documentation** - README, comments, docs/

**Keep together:**

- Interface change + all implementations
- Breaking change + migration code
- New dependency + code using new APIs
- File moves + import path updates
- Tests for the code being changed

**Split when safe:**

- Multiple unrelated fixes
- Build config + features (unless feature needs config)
- Docs + code (unless docs describe that code)
- Dependency updates + unrelated features

## User Interaction Pattern

**Present each commit like this:**

```txt
Files to commit:
  - path/to/file1.go
  - path/to/file2.go

Proposed commit message:
```

[commit message in code block]

```txt
Summary: <2-3 sentence explanation of what changed>

Commit type: <why you chose feat/fix/refactor/etc>

Grouping: <why these specific files belong together>

Should I proceed with this commit?
```

**Handle these responses:**

- `yes`, `commit`, `looks good` → Execute: `git commit -m "message"`
- `skip`, `skip this` → Unstage and find next unit
- `include <file>` → Add file, present again
- `<alternative message>` → Use custom message instead
- Edit request → Regenerate and present again

**After successful commit show:**

```
✓ Committed: <subject line>

Remaining unstaged files:
  - file3.go
  - file4.md

Run this command again to commit the next unit.
```

**If all changes committed:**

```
✓ All changes committed

Recent commits:
  - <commit 1>
  - <commit 2>

You can now push your changes.
```

## Conventional Commit Format

Use this prefix structure:

- `feat:` - New feature
- `fix:` - Bug fix
- `refactor:` - Code restructuring without behavior change
- `test:` - Test additions or modifications
- `docs:` - Documentation changes
- `chore:` - Build, dependency, or tooling updates

Optional scope: `feat(controller):` or `fix(reconciler):`

**Scope Guidelines:**

- Use scope to specify the affected component/area when clear
- For multi-project workspace, consider using project name as scope
- Omit scope if change spans multiple areas or is project-wide
- Keep scope brief and lowercase

## Git Commit Message Style

Write commits that explain changes to other developers:

**Good Example:**

```txt
refactor: use expectComponentsEventually/Consistently helpers in tests

- Replace direct component fetching patterns with reusable helpers
- Consolidate component-fetching pattern to reduce duplication
- Improve test readability across the suite
```

**Length Restrictions:**

- **Subject line (first line):** 50 characters recommended, 72 characters maximum
- **Body lines:** 72 characters maximum (wrap longer lines)

**Key Rules:**

- **Explain WHAT and WHY, not HOW** - The diff shows the how
- **Write like a human, not a report generator** - Humans don't count details
- **Avoid in commit messages:**
  - File-by-file enumeration
  - Function/class name lists
  - Line counts, function counts, or other metrics
  - Specific numbers (e.g., "updated 5 files", "added 3 functions")
  - Step-by-step descriptions of code changes
  - Test pass/coverage statistics
  - Percentage changes or measurement comparisons
- **Focus on:** High-level intent, architectural decisions, rationale, breaking changes
- **No graphic symbols:** No emojis, arrows, boxes, or decorative characters

## Status Reporting

After each successful commit, show progress:

```txt
✓ Committed: <commit message subject line>

Remaining unstaged changes:
  - path/to/file1.go
  - path/to/file2.md
  - path/to/file3_test.go

Run this command again to commit the next atomic unit.
```

If all changes are committed:

```txt
✓ All changes have been committed.

Recent commits:
  - <commit 1 subject>
  - <commit 2 subject>
  - <commit 3 subject>

You can now push your changes.
```
