export const STAGES = ['discover', 'design', 'build', 'ship', 'grow'] as const
export type Stage = typeof STAGES[number]

export const ARTIFACT_TYPES = [
  'brief', 'research', 'prd', 'design', 'architecture', 'plan', 'review', 'experiment', 'launch', 'note',
] as const
export type ArtifactType = typeof ARTIFACT_TYPES[number]

export const EVIDENCE_KINDS = ['url', 'file', 'command', 'note'] as const
export type EvidenceKind = typeof EVIDENCE_KINDS[number]

export const CHECK_STATUSES = ['pending', 'passed', 'failed', 'waived'] as const
export type CheckStatus = typeof CHECK_STATUSES[number]
export type CheckCategory = 'product' | 'engineering' | 'quality' | 'launch'
export type Actor = 'human' | 'agent'

export const REQUIRED_CHECKS = [
  { id: 'product-scope', title: 'Product scope and acceptance', category: 'product', skillId: 'pe-intended-vs-implemented' },
  { id: 'tests', title: 'Tests and verification', category: 'engineering', skillId: 'pe-test-harness' },
  { id: 'independent-review', title: 'Independent review', category: 'quality', skillId: 'pe-independent-review' },
  { id: 'release-plan', title: 'Release plan and rollback', category: 'launch', skillId: 'pe-release-gate' },
] as const

export const LIMITS = {
  title: 160,
  summary: 4000,
  content: 32000,
  detail: 4000,
  option: 500,
  options: 8,
  evidenceLinks: 12,
  uri: 2048,
  workspacePath: 4096,
  evidenceFileBytes: 2 * 1024 * 1024,
  artifacts: 160,
  evidence: 400,
  decisions: 200,
  activity: 4000,
  projectBytes: 16 * 1024 * 1024,
} as const

export interface Artifact {
  id: string
  type: ArtifactType
  title: string
  content: string
  skillId?: string
  evidenceIds: string[]
  createdAt: string
  updatedAt: string
}

export interface Evidence {
  id: string
  kind: EvidenceKind
  title: string
  uri?: string
  summary: string
  verification: 'reported' | 'snapshot'
  /** SHA-256 of the workspace file at capture time. */
  digest?: string
  actor: Actor
  createdAt: string
}

export interface EvidenceView extends Evidence {
  freshness: 'reported' | 'current' | 'stale'
}

export interface Decision {
  id: string
  title: string
  context: string
  options: string[]
  status: 'pending' | 'decided'
  choice?: string
  rationale?: string
  evidenceIds: string[]
  createdAt: string
  resolvedAt?: string
}

export interface Check {
  id: string
  title: string
  category: CheckCategory
  required: boolean
  status: CheckStatus
  evidenceIds: string[]
  note?: string
  reviewedRevision?: number
  updatedAt?: string
}

export interface Activity {
  id: string
  kind: 'project.create' | ProjectCommand['kind']
  actor: Actor
  targetId?: string
  label: string
  detail?: string
  createdAt: string
  revision: number
}

export interface ProjectSummary {
  id: string
  title: string
  summary: string
  workspacePath: string
  stage: Stage
  revision: number
  createdAt: string
  updatedAt: string
}

export interface Project extends ProjectSummary {
  schemaVersion: 1
  /** Advances when the reviewed product or its evidence changes. */
  reviewRevision: number
  artifacts: Artifact[]
  evidence: Evidence[]
  decisions: Decision[]
  checks: Check[]
  activity: Activity[]
}

export interface CheckView extends Check {
  stale: boolean
  staleEvidenceIds: string[]
}

export type ReleaseBlocker =
  | { kind: 'pending-decision'; id: string; title: string }
  | { kind: 'check-pending' | 'check-failed' | 'check-stale' | 'check-missing-evidence'; id: string; title: string }

export type NextAction =
  | { kind: 'add-artifact'; artifactType: ArtifactType; skillId: string }
  | { kind: 'resolve-decision'; id: string; title: string }
  | { kind: 'review-check'; id: string; title: string; skillId: string }
  | { kind: 'move-stage'; stage: Stage }
  | { kind: 'collect-evidence'; skillId: string }

export interface ProjectView {
  project: Project
  evidence: EvidenceView[]
  checks: CheckView[]
  release: { ready: boolean; blockers: ReleaseBlocker[] }
  nextAction: NextAction
}

export type ProjectCommand =
  | { kind: 'project.update'; title?: string; summary?: string }
  | { kind: 'artifact.save'; id?: string; type: ArtifactType; title: string; content: string; skillId?: string; evidenceIds?: string[] }
  | { kind: 'artifact.importFile'; id?: string; type: ArtifactType; title: string; path: string; skillId?: string; evidenceIds?: string[] }
  | { kind: 'evidence.add'; evidenceKind: EvidenceKind; title: string; uri?: string; summary: string }
  | { kind: 'decision.add'; title: string; context: string; options: string[]; evidenceIds?: string[] }
  | { kind: 'decision.resolve'; id: string; choice: string; rationale: string }
  | { kind: 'decision.reopen'; id: string; reason: string }
  | { kind: 'check.set'; id: string; status: CheckStatus; evidenceIds?: string[]; note?: string }
  | { kind: 'stage.move'; stage: Stage }

export type ExportFormat = 'json' | 'markdown'

export interface ProductExport {
  filename: string
  mediaType: 'application/json' | 'text/markdown'
  content: string
}

export interface SkillCatalog {
  schemaVersion: 1
  upstream: { repository: string; commit: string }
  packs: { id: string; title: string; titleZh: string; description: string }[]
  skills: {
    name: string
    originalName: string
    title: string
    titleZh: string
    description: string
    pack: string
    stage: Stage
    userInvocable: boolean
    modelInvocable: boolean
    relativePath: string
    sourcePath: string
    resourceBase: string
    capabilities?: string[]
  }[]
}

export type ProductRequest =
  | { op: 'list' }
  | { op: 'get'; projectId: string }
  | { op: 'create'; title: string; summary?: string; workspacePath?: string }
  | { op: 'mutate'; projectId: string; expectedRevision: number; command: ProjectCommand }
  | { op: 'export'; projectId: string; format: ExportFormat }
  | { op: 'catalog' }

export interface ProductResults {
  list: ProjectSummary[]
  get: ProjectView
  create: ProjectView
  mutate: ProjectView
  export: ProductExport
  catalog: SkillCatalog
}

export type ProductErrorCode = 'invalid-input' | 'not-found' | 'conflict' | 'blocked' | 'forbidden' | 'unavailable'
export type ProductResponse<Operation extends ProductRequest['op'] = ProductRequest['op']> =
  | { ok: true; data: ProductResults[Operation] }
  | { ok: false; error: { code: ProductErrorCode; message: string; blockers?: ReleaseBlocker[] } }
