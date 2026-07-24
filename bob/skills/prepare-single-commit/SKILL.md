---
name: prepare-single-commit
version: '2.0'
description: Stage all changes and create a single git commit
argument-hint: <project>
metadata:
  disable-model-invocation: true
---

## Task

Prepare a git commit for project $1.

## Process

1. Check git status to identify all changed files
2. Stage all changes using `git add .`
3. Review git diff (staged) to understand the nature of changes
4. Generate commit message following the Git Commit Message Style below
5. Present the commit to the user in this format:
   - List the staged files being committed — `git add .` sweeps every modified and
     untracked file under the project, so show the full list the user is approving
   - Show the proposed message in a code block
   - Briefly summarize what changed (2-3 sentences)
   - Explain why you chose this commit type
   - Ask: "Should I proceed with this commit?"
6. Handle user response:
   - If approved (e.g., "yes", "commit it", "looks good"): execute `git commit -m "message"`
   - If edits requested: regenerate the message and present again
   - If user provides alternative message: use that instead
   - If more context needed: ask specific questions

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
