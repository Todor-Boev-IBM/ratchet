// lib/paths.mjs — the one place that knows a feature's on-disk layout:
// docs/features/<slug>/{feature,plan,proposal}.md. Everything else derives
// paths from these helpers so the layout lives in a single spot.

import { join } from 'node:path'

export const featuresDir = docsDir => join(docsDir, 'features')
export const featureDir = (docsDir, slug) => join(featuresDir(docsDir), slug)
export const featureFile = (docsDir, slug) => join(featureDir(docsDir, slug), 'feature.md')
export const planFile = (docsDir, slug) => join(featureDir(docsDir, slug), 'plan.md')
export const proposalFile = (docsDir, slug) => join(featureDir(docsDir, slug), 'proposal.md')
