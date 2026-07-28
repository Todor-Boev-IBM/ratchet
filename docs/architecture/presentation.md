# Ratchet

## Conditions

The specific problem this addresses:

- Solo developer in a multi-repo codebase
- Tasks arrive as issues, output as PRs
- Need to improve the cognitive performance of the developer
  - The focus is the person not the agent output

---

## Evidence

Eight 9 months of daily use, several codebases:

| Project                    | Language   | LOC      | Journey                     |
| -------------------------- | ---------- | -------- | --------------------------- |
| Componator suite (7 repos) | Go         | ~40–60K  | Greenfield to Production    |
| Audit IS Package           | Java       | ~5K      | Dirty to Improved           |
| Angular app                | TS/Angular | ~60K     | Dirty to Greenfield Rewrite |
| Toy flow visualizer        | TS/React   | ~2K      | Greenfield to Prototype     |

- Agent started **~95%** of the code.
- Human share shrinks as the project matures.
- Not a point of pride:
  - **Your coding ability deteriorates**
  - Your higher-level thinkig does improve
  - Your research / experimentation ability is multipled

---

## What It Is Made Of

- A set of interlocking **skills** (verbs the agent knows)
- A **utility tool** (`featuremgr`) to track feature state
- Selected **MCP servers** to support the skills
- A **persona** defining communication style and interaction quality
- A **manual** for the human (`docs/architecture/README.md`)
- **Work in progress:** started to consolidate from a adhoc set of prompts to an integrated distribution (last week)

---

## Three Principles

**1. The scarce resource is attention**  
Every phase is designed to keep the human at the high-leverage layer — ideation and review — and shift the slow parts to the background.

**2. The code is the ground truth**
Sessions start from the code, not from documents that describe it.  
`docs/architecture` captures what the code cannot express to a reader; everything else is temporal.

**3. The codebase compounds**
Regularity and quality compound. Ambiguity compounds technical debt.  
The quality enforced in reconciliation is what the agent imitates next loop.

---

## The Workflow

...

---

## Running in Parallel

Phases do not run strictly in order.

- Execute runs in the background → new ideation starts immediately
- Abandonment is a signal, not a failure — ideation is meant to outrun execution

The backlog is managed with `/triage`: surfaces open work oldest-first, forces a decision on what has gone stale or is finished.

---

## Future Work

- Manage large/small features: e.g. spawn peer features, or multi-plan...
- Features relantionship to issues: e.g. tie to github issues?
- Improve `Load` phase: knowledge mangement, capture research results for later?
- More help with `Reconcile` phase: agent to review it's own work, specialized personas per language (ts, Go, etc.)
- Better MCP tools: code-indexing needs improvement
- Help welcome

---

## References

Componator suite (Go, production):

- [componator](https://github.com/ibm-webmethods/componator)
- [componator-k8s-providers](https://github.com/ibm-webmethods/componator-k8s-providers)
- [componator-aws-providers](https://github.com/ibm-webmethods/componator-aws-providers)
- [componator-tests](https://github.com/ibm-webmethods/componator-tests)
- [componator-build-tools](https://github.com/ibm-webmethods/componator-build-tools)
- [componator-wordpress](https://github.com/ibm-webmethods/componator-wordpress)
- [componator-cp4i-hello](https://github.com/ibm-webmethods/componator-cp4i-hello)
