#!/usr/bin/env node
// docmgr — a mechanical index builder and cross-link maintainer for a docs/ tree
// of proposals and plans.
//   • reindex  — regenerates docs/index.md AND repairs the frontmatter cross-link
//                on both paired docs (writes a doc only when its link changed).
//   • check    — read-only audit (status validity, broken link targets, pair coherence).
//
// Model
//   docs/
//     proposals/**/*.md   -> type: proposal
//     plans/**/*.md       -> type: plan
//   Frontmatter:
//     status: <bucket>                 required, authored
//     plan:   "[title](rel/path.md)"   on proposals — generated/repaired by reindex
//     proposal: "[title](rel/path.md)" on plans     — generated/repaired by reindex
//   Pairing identity = the link target's filename (id). A proposal and a plan with
//   the same filename auto-pair; a link field overrides when the names differ.
//   Derived: id <- filename stem; type <- top dir; title <- first `# heading`.
//
// Usage
//   docmgr reindex [--docs <dir>] [--out <file>]
//   docmgr check   [--docs <dir>]

import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from 'node:fs'
import { join, relative, sep, basename, extname, dirname } from 'node:path'

// Canonical status buckets per type. Rendering follows this order; `check`
// flags any status outside these sets.
const BUCKETS = {
  proposal: ['open', 'accepted', 'implemented', 'abandoned'],
  plan: ['draft', 'active', 'done', 'abandoned'],
}

// A plan being `done` implies its proposal should be `implemented`.
const PAIR_RULE = { planDone: 'done', proposalDone: 'implemented' }

// ---- args -------------------------------------------------------------------

function parseArgs(argv) {
  const [cmd, ...rest] = argv
  const opts = { docs: 'docs', out: null }
  for (let i = 0; i < rest.length; i++) {
    if (rest[i] === '--docs') opts.docs = rest[++i]
    else if (rest[i] === '--out') opts.out = rest[++i]
  }
  return { cmd, opts }
}

// ---- io ---------------------------------------------------------------------

function walk(dir) {
  const out = []
  let entries
  try {
    entries = readdirSync(dir)
  } catch {
    return out
  }
  for (const name of entries) {
    const p = join(dir, name)
    const st = statSync(p)
    if (st.isDirectory()) out.push(...walk(p))
    else if (extname(p) === '.md') out.push(p)
  }
  return out
}

function parseFrontmatter(text) {
  const lines = text.split(/\r?\n/)
  if (lines[0]?.trim() !== '---') return { data: {}, body: text }
  let i = 1
  const fm = []
  while (i < lines.length && lines[i].trim() !== '---') fm.push(lines[i++])
  if (i >= lines.length) return { data: {}, body: text } // no closing fence
  const body = lines.slice(i + 1).join('\n')
  const data = {}
  for (const line of fm) {
    const m = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/)
    if (!m) continue
    data[m[1]] = m[2].trim().replace(/^["']|["']$/g, '')
  }
  return { data, body }
}

function firstHeading(body) {
  for (const line of body.split(/\r?\n/)) {
    const m = line.match(/^#\s+(.*)$/)
    if (m) return m[1].trim()
  }
  return null
}

// ---- load -------------------------------------------------------------------

// Field that names the partner: proposals carry a `plan:` link, plans a `proposal:` link.
const LINK_FIELD = { proposal: 'plan', plan: 'proposal' }

// Pull the target filename (id) out of a markdown link value like
// `[Title](../plans/foo.md)` -> `foo`.
function parseLinkId(value) {
  const m = value && value.match(/\]\(([^)]+)\)/)
  return m ? basename(m[1].trim()).replace(/\.md$/, '') : null
}

function loadDocs(docsDir) {
  const docs = []
  for (const type of ['proposal', 'plan']) {
    const sub = type === 'proposal' ? 'proposals' : 'plans'
    for (const file of walk(join(docsDir, sub))) {
      const raw = readFileSync(file, 'utf8')
      const { data, body } = parseFrontmatter(raw)
      const id = data.id || basename(file, '.md')
      const pairId = parseLinkId(data[LINK_FIELD[type]]) || data.ref || null
      docs.push({
        type,
        id,
        status: data.status || null,
        pairId,
        title: data.title || firstHeading(body) || id,
        path: relative(docsDir, file).split(sep).join('/'),
        file,
        raw,
        data,
        body,
      })
    }
  }
  return docs
}

function pair(doc, partners) {
  return partners.get(keyOf(doc)) || null
}

function keyOf(d) {
  return `${d.type}:${d.id}`
}

// Resolve each doc's partner (the paired plan/proposal). A cross-link on either
// side pairs both; otherwise a same-id doc of the opposite type pairs.
function buildPartners(docs, index) {
  const partners = new Map()
  const linkPair = (a, b) => {
    partners.set(keyOf(a), b)
    if (!partners.has(keyOf(b))) partners.set(keyOf(b), a)
  }
  for (const d of docs) {
    if (!d.pairId) continue
    const other = d.type === 'proposal' ? 'plan' : 'proposal'
    const t = index.get(`${other}:${d.pairId}`)
    if (t) linkPair(d, t)
  }
  for (const d of docs) {
    if (partners.has(keyOf(d))) continue
    const other = d.type === 'proposal' ? 'plan' : 'proposal'
    const t = index.get(`${other}:${d.id}`)
    if (t) linkPair(d, t)
  }
  return partners
}

// ---- reindex ----------------------------------------------------------------

function relLink(fromPath, to) {
  const rel = relative(dirname(fromPath), to.path).split(sep).join('/')
  return `[${to.title}](${rel})`
}

// Rebuild a doc's frontmatter: status first, then the managed cross-link, then
// any other keys the author added. `ref` is retired in favour of the link.
function serializeFrontmatter(doc, linkValue) {
  const linkField = LINK_FIELD[doc.type]
  const managed = new Set(['status', 'ref', linkField])
  const out = []
  if (doc.status) out.push(`status: ${doc.status}`)
  if (linkValue) out.push(`${linkField}: "${linkValue}"`)
  for (const [k, v] of Object.entries(doc.data)) {
    if (managed.has(k)) continue
    out.push(`${k}: ${v}`)
  }
  return out
}

// Repair/generate the cross-link on both paired docs. Writes a file only when
// its frontmatter link actually changed. Returns the number of files touched.
function maintainLinks(docs, partners) {
  let updated = 0
  for (const d of docs) {
    const p = pair(d, partners)
    const linkValue = p ? relLink(d.path, p) : null
    const next = `---\n${serializeFrontmatter(d, linkValue).join('\n')}\n---\n${d.body}`
    if (next !== d.raw) {
      writeFileSync(d.file, next)
      updated++
    }
  }
  return updated
}

function orderedBuckets(type, docs) {
  const known = BUCKETS[type]
  const seen = new Set(docs.map(d => d.status || '(no status)'))
  const extra = [...seen].filter(s => !known.includes(s)).sort()
  return [...known.filter(s => seen.has(s)), ...extra]
}

function link(doc) {
  return `[${doc.title}](${doc.path})`
}

function reindex(docsDir, outFile) {
  const docs = loadDocs(docsDir)
  const index = new Map(docs.map(d => [`${d.type}:${d.id}`, d]))
  const partners = buildPartners(docs, index)
  const updated = maintainLinks(docs, partners)

  const lines = ['# Docs Index', '', '_Generated by docmgr — do not edit by hand._', '']
  const summary = []

  for (const type of ['proposal', 'plan']) {
    const ofType = docs.filter(d => d.type === type)
    lines.push(`## ${type === 'proposal' ? 'Proposals' : 'Plans'}`, '')
    for (const bucket of orderedBuckets(type, ofType)) {
      const rows = ofType
        .filter(d => (d.status || '(no status)') === bucket)
        .sort((a, b) => a.title.localeCompare(b.title))
      if (rows.length === 0) continue
      summary.push(`  ${type}/${bucket}: ${rows.length}`)
      const otherLabel = type === 'proposal' ? 'Plan' : 'Proposal'
      lines.push(`### ${bucket} (${rows.length})`, '')
      lines.push(`| ${type === 'proposal' ? 'Proposal' : 'Plan'} | ${otherLabel} |`, '| --- | --- |')
      for (const d of rows) {
        const p = pair(d, partners)
        lines.push(`| ${link(d)} | ${p ? link(p) : '—'} |`)
      }
      lines.push('')
    }
  }

  const out = outFile || join(docsDir, 'index.md')
  writeFileSync(out, lines.join('\n'))
  console.log(`reindex: ${docs.length} docs, ${updated} link(s) updated -> ${out}`)
  console.log(summary.join('\n'))
}

// ---- check ------------------------------------------------------------------

function check(docsDir) {
  const docs = loadDocs(docsDir)
  const index = new Map(docs.map(d => [`${d.type}:${d.id}`, d]))
  const partners = buildPartners(docs, index)
  const problems = []

  // duplicate ids within a type
  const byKey = new Map()
  for (const d of docs) {
    const k = `${d.type}:${d.id}`
    if (byKey.has(k)) problems.push(`duplicate id: ${d.type} '${d.id}' (${d.path} and ${byKey.get(k)})`)
    else byKey.set(k, d.path)
  }

  for (const d of docs) {
    // missing status
    if (!d.status) {
      problems.push(`no status: ${d.path}`)
    } else if (!BUCKETS[d.type].includes(d.status)) {
      problems.push(`invalid status '${d.status}' for ${d.type}: ${d.path} (allowed: ${BUCKETS[d.type].join(', ')})`)
    }
    // cross-link target must exist on disk
    const linkField = LINK_FIELD[d.type]
    const linkVal = d.data[linkField]
    if (linkVal) {
      const m = linkVal.match(/\]\(([^)]+)\)/)
      if (!m) problems.push(`malformed ${linkField} link in ${d.path}`)
      else if (!existsSync(join(docsDir, dirname(d.path), m[1].trim())))
        problems.push(`broken ${linkField} link in ${d.path} -> ${m[1].trim()}`)
    }
    // inconsistent pair: plan done but proposal not implemented
    if (d.type === 'plan' && d.status === PAIR_RULE.planDone) {
      const p = pair(d, partners)
      if (p && p.status !== PAIR_RULE.proposalDone) {
        problems.push(
          `inconsistent pair: plan '${d.id}' is done but proposal is '${p.status}' (expected ${PAIR_RULE.proposalDone})`,
        )
      }
    }
  }

  if (problems.length === 0) {
    console.log(`check: ${docs.length} docs, no problems`)
    return 0
  }
  console.log(`check: ${docs.length} docs, ${problems.length} problem(s):`)
  for (const p of problems.sort()) console.log(`  - ${p}`)
  return 1
}

// ---- main -------------------------------------------------------------------

const { cmd, opts } = parseArgs(process.argv.slice(2))
if (cmd === 'reindex') {
  reindex(opts.docs, opts.out)
} else if (cmd === 'check') {
  process.exit(check(opts.docs))
} else {
  console.error('usage: docmgr <reindex|check> [--docs <dir>] [--out <file>]')
  process.exit(2)
}
