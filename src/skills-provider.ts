import { readFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import catalog from '../upstream/catalog.json' with { type: 'json' }

const providerName = 'dsh-product-engineering'
// BUNDLED_SKILL_RANK in the pinned DSH skill registry.
const bundledSkillRank = 600
const frontmatterPattern = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/u

interface SkillLookupOptions {
  readonly signal?: AbortSignal
}

function candidateFor(skill: (typeof catalog.skills)[number]) {
  const path = fileURLToPath(new URL(`../${skill.relativePath}`, import.meta.url))
  return {
    name: skill.name,
    description: skill.description,
    invocation: Object.freeze({ modelInvocable: skill.modelInvocable, userInvocable: skill.userInvocable }),
    source: 'bundled' as const,
    provider: providerName,
    path,
    resourceBase: Object.freeze({ kind: 'directory' as const, path: dirname(path) }),
    rank: bundledSkillRank,
    locator: path,
  }
}

type Candidate = Readonly<ReturnType<typeof candidateFor>>

function createSkillProvider(lifecycle: AbortSignal) {
  const candidates = Object.freeze(catalog.skills.map(skill => Object.freeze(candidateFor(skill))))
  const candidateSet = new Set<Candidate>(candidates)
  return {
    name: providerName,
    async list(options: SkillLookupOptions = {}) {
      lifecycle.throwIfAborted()
      options.signal?.throwIfAborted()
      return candidates
    },
    async get(candidate: Candidate, options: SkillLookupOptions = {}) {
      const signal = options.signal === undefined ? lifecycle : AbortSignal.any([lifecycle, options.signal])
      signal.throwIfAborted()
      if (!candidateSet.has(candidate)) return undefined
      const { rank: _rank, locator, ...summary } = candidate
      const raw = await readFile(locator, { encoding: 'utf8', signal })
      signal.throwIfAborted()
      const frontmatter = frontmatterPattern.exec(raw)
      const header = frontmatter?.[1].split(/\r?\n/u) ?? []
      if (frontmatter === null || !header.includes(`name: ${summary.name}`)) {
        throw new Error(`${providerName}: invalid skill frontmatter in ${locator}`)
      }
      const content = raw.slice(frontmatter[0].length).trim()
      if (content.length === 0) throw new Error(`${providerName}: empty skill body in ${locator}`)
      return { ...summary, content }
    },
  }
}

interface SkillContext {
  readonly skills: {
    registerProvider(create: (control: { readonly signal: AbortSignal }) => ReturnType<typeof createSkillProvider>): () => void
  }
}

/** Register the packaged catalog on the caller's DSH skill-registry layer. */
export function registerSkills(ctx: SkillContext): () => void {
  return ctx.skills.registerProvider(control => createSkillProvider(control.signal))
}
