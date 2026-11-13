import { randomUUID } from 'node:crypto'
import { defaultChecks, projectView, stageAdvance } from './checks.ts'
import { canonicalWorkspace, captureFile, captureTextFile, evidenceUrl, evidenceViews, workspaceFile } from './evidence.ts'
import { ProductError } from './errors.ts'
import { exportProject } from './export.ts'
import { ProjectStore } from './store.ts'
import {
  LIMITS, type Activity, type Actor, type Artifact, type Decision, type Evidence, type ProductRequest,
  type ProductResults, type Project, type ProjectCommand, type SkillCatalog,
} from './types.ts'
import { invalid } from './validation.ts'

export type ProductAccess = { actor: 'human' } | { actor: 'agent'; workspacePath: string }

type EngineOptions = {
  dataDirectory: string
  defaultWorkspaceDirectory?: string
  loadCatalog: () => SkillCatalog
  allowOwnerWorkspace?: (path: string) => boolean
}

type Change = Pick<Activity, 'label' | 'targetId' | 'detail'> & { scopeChanged?: boolean }

function admit(command: ProjectCommand, actor: Actor): void {
  if (actor === 'human') return
  switch (command.kind) {
    case 'decision.resolve':
    case 'decision.reopen':
    case 'check.set':
    case 'stage.move':
      throw new ProductError('forbidden', 'This action requires a human in the product workbench.')
  }
}

function find<T extends { id: string }>(items: T[], id: string, entity: string): T {
  const result = items.find(item => item.id === id)
  if (result === undefined) throw new ProductError('not-found', `${entity} was not found in this project.`)
  return result
}

function linkEvidence(project: Project, ids: string[] = []): string[] {
  const existing = new Set(project.evidence.map(item => item.id))
  if (ids.some(id => !existing.has(id))) invalid('Every evidence link must point to evidence in this project.')
  return ids
}

function saveArtifact(project: Project, command: Extract<ProjectCommand, { kind: 'artifact.save' }>, now: string): Change {
  const previous = command.id === undefined ? undefined : find(project.artifacts, command.id, 'Artifact')
  if (previous === undefined && project.artifacts.length >= LIMITS.artifacts) invalid('Artifact limit reached.')
  const artifact: Artifact = {
    id: previous?.id ?? randomUUID(), type: command.type, title: command.title, content: command.content,
    skillId: command.skillId, evidenceIds: linkEvidence(project, command.evidenceIds ?? previous?.evidenceIds),
    createdAt: previous?.createdAt ?? now, updatedAt: now,
  }
  if (previous === undefined) project.artifacts.push(artifact)
  else project.artifacts[project.artifacts.indexOf(previous)] = artifact
  const scopeChanged = previous === undefined || previous.type !== artifact.type || previous.title !== artifact.title
    || previous.content !== artifact.content || previous.evidenceIds.join(',') !== artifact.evidenceIds.join(',')
  return { label: artifact.title, targetId: artifact.id, scopeChanged }
}

function importArtifact(project: Project, command: Extract<ProjectCommand, { kind: 'artifact.importFile' }>, actor: Actor, now: string): Change {
  const previous = command.id === undefined ? undefined : find(project.artifacts, command.id, 'Artifact')
  if (previous === undefined && project.artifacts.length >= LIMITS.artifacts) invalid('Artifact limit reached.')
  if (project.evidence.length >= LIMITS.evidence) invalid('Evidence limit reached.')
  const uri = workspaceFile(command.path)
  const previousSnapshots = new Set(project.evidence.filter(item => item.kind === 'file' && item.uri === uri).map(item => item.id))
  const evidenceIds = linkEvidence(project, command.evidenceIds ?? previous?.evidenceIds).filter(id => !previousSnapshots.has(id))
  if (evidenceIds.length >= LIMITS.evidenceLinks) {
    invalid(`Keep at most ${LIMITS.evidenceLinks - 1} other evidence links to make room for the imported file snapshot.`)
  }
  const { content, digest } = captureTextFile(project.workspacePath, uri)
  const snapshot: Evidence = {
    id: randomUUID(), kind: 'file', title: command.title, uri, summary: 'Source file imported as an artifact.',
    verification: 'snapshot', digest, actor, createdAt: now,
  }
  project.evidence.push(snapshot)
  const change = saveArtifact(project, { ...command, kind: 'artifact.save', content, evidenceIds: [...evidenceIds, snapshot.id] }, now)
  return { ...change, detail: uri }
}

function addEvidence(project: Project, command: Extract<ProjectCommand, { kind: 'evidence.add' }>, actor: Actor, now: string): Change {
  if (project.evidence.length >= LIMITS.evidence) invalid('Evidence limit reached.')
  const item: Evidence = {
    id: randomUUID(), kind: command.evidenceKind, title: command.title, summary: command.summary,
    uri: command.uri, verification: 'reported', actor, createdAt: now,
  }
  if (item.kind === 'url') item.uri = evidenceUrl(item.uri)
  if (item.kind === 'file') {
    item.uri = workspaceFile(item.uri)
    item.digest = captureFile(project.workspacePath, item.uri)
    item.verification = 'snapshot'
  }
  project.evidence.push(item)
  return { label: item.title, targetId: item.id }
}

function applyCommand(project: Project, command: ProjectCommand, actor: Actor, now: string): Change {
  switch (command.kind) {
    case 'project.update': {
      const title = command.title ?? project.title
      const summary = command.summary ?? project.summary
      const scopeChanged = summary !== project.summary
      project.title = title
      project.summary = summary
      return { label: title, scopeChanged }
    }
    case 'artifact.save':
      return saveArtifact(project, command, now)
    case 'artifact.importFile':
      return importArtifact(project, command, actor, now)
    case 'evidence.add':
      return addEvidence(project, command, actor, now)
    case 'decision.add': {
      if (project.decisions.length >= LIMITS.decisions) invalid('Decision limit reached.')
      const decision: Decision = {
        id: randomUUID(), title: command.title, context: command.context, options: command.options,
        status: 'pending', evidenceIds: linkEvidence(project, command.evidenceIds), createdAt: now,
      }
      project.decisions.push(decision)
      return { label: decision.title, targetId: decision.id }
    }
    case 'decision.resolve': {
      const decision = find(project.decisions, command.id, 'Decision')
      if (decision.status === 'decided') throw new ProductError('conflict', 'Reopen this decision before changing its choice.')
      if (!decision.options.includes(command.choice)) invalid('Choose one of the recorded decision options.')
      decision.status = 'decided'
      decision.choice = command.choice
      decision.rationale = command.rationale
      decision.resolvedAt = now
      return { label: decision.title, targetId: decision.id, detail: `${command.choice}\n${command.rationale}`, scopeChanged: true }
    }
    case 'decision.reopen': {
      const decision = find(project.decisions, command.id, 'Decision')
      if (decision.status === 'pending') throw new ProductError('conflict', 'This decision is already open.')
      decision.status = 'pending'
      delete decision.choice
      delete decision.rationale
      delete decision.resolvedAt
      return { label: decision.title, targetId: decision.id, detail: command.reason, scopeChanged: true }
    }
    case 'check.set': {
      const check = find(project.checks, command.id, 'Check')
      const evidenceIds = linkEvidence(project, command.evidenceIds ?? check.evidenceIds)
      if (command.status === 'passed' && evidenceIds.length === 0) invalid('Link evidence before passing this check.')
      if (command.status === 'waived' && !command.note) invalid('Give a rationale to waive this check.')
      if (command.status === 'passed' || command.status === 'waived') {
        const selected = evidenceIds.map(id => find(project.evidence, id, 'Evidence'))
        if (evidenceViews(project.workspacePath, selected).some(item => item.freshness === 'stale')) {
          throw new ProductError('blocked', 'Capture a fresh snapshot or remove the outdated file evidence before recording this check.')
        }
      }
      check.status = command.status
      check.evidenceIds = evidenceIds
      check.note = command.note
      check.updatedAt = now
      check.reviewedRevision = command.status === 'passed' || command.status === 'waived' ? project.reviewRevision : undefined
      return { label: check.title, targetId: check.id, detail: [command.status, command.note].filter(Boolean).join('\n') }
    }
    case 'stage.move': {
      const error = stageAdvance(project, command.stage)
      if (error !== undefined) throw new ProductError('blocked', error.message, error.blockers)
      const previous = project.stage
      project.stage = command.stage
      return { label: `${previous} → ${command.stage}`, targetId: command.stage }
    }
  }
}

/** Shared owner and model workflow operations. Host adapters supply the authenticated actor. */
export class ProductEngine {
  private readonly store: ProjectStore
  private readonly defaultWorkspaceDirectory?: string
  private readonly loadCatalog: () => SkillCatalog
  private readonly allowOwnerWorkspace?: (path: string) => boolean

  constructor(options: EngineOptions) {
    this.defaultWorkspaceDirectory = options.defaultWorkspaceDirectory === undefined
      ? undefined : canonicalWorkspace(options.defaultWorkspaceDirectory)
    this.loadCatalog = options.loadCatalog
    this.allowOwnerWorkspace = options.allowOwnerWorkspace
    this.store = new ProjectStore(options.dataDirectory)
  }

  execute<Request extends ProductRequest>(request: Request, access: ProductAccess, signal?: AbortSignal): ProductResults[Request['op']]
  execute(request: ProductRequest, access: ProductAccess, signal?: AbortSignal): ProductResults[ProductRequest['op']] {
    signal?.throwIfAborted()
    const scopedPath = access.actor === 'agent' ? access.workspacePath : undefined
    switch (request.op) {
      case 'catalog':
        return this.loadCatalog()
      case 'list':
        return this.store.list(scopedPath)
      case 'get':
        return projectView(this.store.get(request.projectId, scopedPath))
      case 'create':
        return projectView(this.create(request, access))
      case 'mutate':
        admit(request.command, access.actor)
        return projectView(this.store.mutate(request.projectId, request.expectedRevision, scopedPath, project => {
          if (project.activity.length >= LIMITS.activity) invalid('Activity limit reached. Export the project before starting a new one.')
          const now = new Date().toISOString()
          const { scopeChanged, ...change } = applyCommand(project, request.command, access.actor, now)
          signal?.throwIfAborted()
          project.revision++
          if (scopeChanged) project.reviewRevision++
          project.updatedAt = now
          project.activity.push({ id: randomUUID(), kind: request.command.kind, actor: access.actor,
            createdAt: now, revision: project.revision, ...change })
        }))
      case 'export':
        return exportProject(projectView(this.store.get(request.projectId, scopedPath)), request.format)
    }
  }

  private create(request: Extract<ProductRequest, { op: 'create' }>, access: ProductAccess): Project {
    let workspacePath: string
    if (access.actor === 'agent') {
      if (request.workspacePath !== undefined) throw new ProductError('forbidden', 'Agent projects use their session workspace.')
      workspacePath = access.workspacePath
    } else {
      const chosen = request.workspacePath ?? this.defaultWorkspaceDirectory
      if (chosen === undefined) invalid('Provide the absolute path to an existing workspace folder.')
      workspacePath = canonicalWorkspace(chosen)
      if (workspacePath !== this.defaultWorkspaceDirectory && this.allowOwnerWorkspace?.(workspacePath) === false) {
        throw new ProductError('invalid-input', 'Add this folder to the DSH workspace list before creating a project.')
      }
    }
    const id = randomUUID()
    const now = new Date().toISOString()
    const project: Project = {
      schemaVersion: 1, id, title: request.title, summary: request.summary ?? '', workspacePath, stage: 'discover',
      revision: 1, reviewRevision: 1, createdAt: now, updatedAt: now,
      artifacts: [], evidence: [], decisions: [], checks: defaultChecks(),
      activity: [{ id: randomUUID(), kind: 'project.create', actor: access.actor, label: request.title, createdAt: now, revision: 1 }],
    }
    this.store.create(project)
    return project
  }

  close(): void {
    this.store.close()
  }
}
