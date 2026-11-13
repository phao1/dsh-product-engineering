import { defaultChecks } from './checks.ts'
import { evidenceUrl, fullyQualifiedPath, workspaceFile } from './evidence.ts'
import { ProductError } from './errors.ts'
import { LIMITS, STAGES, type Activity, type Artifact, type Check, type Decision, type Evidence, type Project } from './types.ts'
import { array, integer, invalid, member, object, parseCommand, pathText, string, unique, uuid } from './validation.ts'

const ACTIVITY_KINDS = [
  'project.create', 'project.update', 'artifact.save', 'artifact.importFile', 'evidence.add', 'decision.add', 'decision.resolve',
  'decision.reopen', 'check.set', 'stage.move',
] as const

function timestamp(value: unknown): string {
  const date = typeof value === 'string' ? Date.parse(value) : NaN
  if (!Number.isFinite(date) || new Date(date).toISOString() !== value) invalid('Invalid record timestamp.')
  return value as string
}

function artifactOf(input: unknown): Artifact {
  const value = object(input, 'Artifact')
  const { id, type, title, content, skillId, evidenceIds } = value
  const saved = parseCommand({ kind: 'artifact.save', id, type, title, content, skillId, evidenceIds })
  if (saved.kind !== 'artifact.save' || saved.id === undefined || saved.evidenceIds === undefined) {
    return invalid('Invalid artifact record.')
  }
  return {
    id: saved.id, type: saved.type, title: saved.title, content: saved.content, skillId: saved.skillId,
    evidenceIds: saved.evidenceIds, createdAt: timestamp(value.createdAt), updatedAt: timestamp(value.updatedAt),
  }
}

function evidenceOf(input: unknown): Evidence {
  const value = object(input, 'Evidence')
  const saved = parseCommand({ kind: 'evidence.add', evidenceKind: value.kind, title: value.title, uri: value.uri, summary: value.summary })
  if (saved.kind !== 'evidence.add') return invalid('Invalid evidence record.')
  const verification = member(value.verification, 'Verification', ['reported', 'snapshot'])
  const actor = member(value.actor, 'Actor', ['human', 'agent'])
  let uri = saved.uri
  let digest: string | undefined
  if (saved.evidenceKind === 'file') {
    uri = workspaceFile(uri)
    if (verification !== 'snapshot' || typeof value.digest !== 'string' || !/^[0-9a-f]{64}$/.test(value.digest)) {
      return invalid('Invalid file evidence snapshot.')
    }
    digest = value.digest
  } else if (verification !== 'reported' || value.digest !== undefined) {
    return invalid('Invalid reported evidence record.')
  }
  if (saved.evidenceKind === 'url') uri = evidenceUrl(uri)
  return {
    id: uuid(value.id, 'Evidence ID'), kind: saved.evidenceKind, title: saved.title, summary: saved.summary,
    uri, digest, verification, actor, createdAt: timestamp(value.createdAt),
  }
}

function decisionOf(input: unknown): Decision {
  const value = object(input, 'Decision')
  const { title, context, options, evidenceIds } = value
  const saved = parseCommand({ kind: 'decision.add', title, context, options, evidenceIds })
  if (saved.kind !== 'decision.add' || saved.evidenceIds === undefined) return invalid('Invalid decision record.')
  const id = uuid(value.id, 'Decision ID')
  const status = member(value.status, 'Decision status', ['pending', 'decided'])
  const decision: Decision = {
    id, title: saved.title, context: saved.context, options: saved.options, evidenceIds: saved.evidenceIds,
    status, createdAt: timestamp(value.createdAt),
  }
  if (status === 'decided') {
    const choice = string(value.choice, 'Choice', LIMITS.option)
    if (!decision.options.includes(choice)) return invalid('Decision choice is missing from its options.')
    decision.choice = choice
    decision.rationale = string(value.rationale, 'Rationale', LIMITS.detail)
    decision.resolvedAt = timestamp(value.resolvedAt)
  } else if (value.choice !== undefined || value.rationale !== undefined || value.resolvedAt !== undefined) {
    return invalid('Pending decisions cannot have a recorded resolution.')
  }
  return decision
}

function checksOf(input: unknown, reviewRevision: number): Check[] {
  const defaults = defaultChecks()
  const records = array(input, 'Checks', defaults.length, defaults.length)
  return records.map((record, index) => {
    const value = object(record, 'Check')
    const base = defaults[index]!
    if (value.id !== base.id || value.category !== base.category || value.title !== base.title || value.required !== true) {
      return invalid('Invalid required check record.')
    }
    const { id, status, evidenceIds, note } = value
    const saved = parseCommand({ kind: 'check.set', id, status, evidenceIds, note })
    if (saved.kind !== 'check.set' || saved.evidenceIds === undefined) return invalid('Invalid check record.')
    const checked: Check = { ...base, status: saved.status, evidenceIds: saved.evidenceIds, note: saved.note }
    if (value.updatedAt !== undefined) checked.updatedAt = timestamp(value.updatedAt)
    if (saved.status === 'passed' || saved.status === 'waived') {
      checked.reviewedRevision = integer(value.reviewedRevision, 'Reviewed revision')
      if (checked.reviewedRevision > reviewRevision || checked.updatedAt === undefined
        || (saved.status === 'passed' && checked.evidenceIds.length === 0)) {
        return invalid('Check is missing its evidence or review record.')
      }
    } else if (value.reviewedRevision !== undefined) {
      return invalid('Check has an unexpected reviewed revision.')
    }
    if (saved.status === 'waived' && (!checked.note || checked.updatedAt === undefined)) {
      return invalid('Waiver is missing its rationale or date.')
    }
    return checked
  })
}

function activityOf(input: unknown, index: number): Activity {
  const value = object(input, 'Activity')
  const kind = member(value.kind, 'Activity type', ACTIVITY_KINDS)
  if (value.revision !== index + 1 || (index === 0) !== (kind === 'project.create')) {
    return invalid('Activity revisions must match the project history.')
  }
  let detail: string | undefined
  if (kind === 'artifact.importFile') detail = workspaceFile(pathText(value.detail, 'File path', LIMITS.uri))
  else if (value.detail !== undefined) detail = string(value.detail, 'Activity detail', LIMITS.detail + LIMITS.option + 2)
  return {
    id: uuid(value.id, 'Activity ID'), kind, actor: member(value.actor, 'Actor', ['human', 'agent']),
    label: string(value.label, 'Activity label', LIMITS.title), createdAt: timestamp(value.createdAt), revision: index + 1,
    targetId: value.targetId === undefined ? undefined : string(value.targetId, 'Target ID', 96),
    detail,
  }
}

/** Decode a durable aggregate and validate its schema, identities, and evidence links. */
export function decodeProject(raw: unknown, rowId: string, rowWorkspace: string, rowRevision: number): Project {
  try {
    if (typeof raw !== 'string' || Buffer.byteLength(raw) > LIMITS.projectBytes) return invalid('Invalid project data.')
    const value = object(JSON.parse(raw), 'Project')
    const id = uuid(value.id, 'Project ID')
    const workspacePath = pathText(value.workspacePath, 'Workspace folder', LIMITS.workspacePath)
    const revision = integer(value.revision, 'Project revision')
    const reviewRevision = integer(value.reviewRevision, 'Review revision')
    if (value.schemaVersion !== 1 || id !== rowId || workspacePath !== rowWorkspace || !fullyQualifiedPath(workspacePath)
      || revision !== rowRevision || reviewRevision > revision) return invalid('Invalid project identity or schema.')
    const artifacts = array(value.artifacts, 'Artifacts', 0, LIMITS.artifacts).map(artifactOf)
    const evidence = array(value.evidence, 'Evidence', 0, LIMITS.evidence).map(evidenceOf)
    const decisions = array(value.decisions, 'Decisions', 0, LIMITS.decisions).map(decisionOf)
    const checks = checksOf(value.checks, reviewRevision)
    const activity = array(value.activity, 'Activity', revision, Math.min(revision, LIMITS.activity)).map(activityOf)
    for (const [field, items] of [['Artifacts', artifacts], ['Evidence', evidence], ['Decisions', decisions], ['Activity', activity]] as const) {
      unique(items.map(item => item.id), field)
    }
    const evidenceIds = new Set(evidence.map(item => item.id))
    for (const { evidenceIds: links } of [...artifacts, ...decisions, ...checks]) {
      if (links.some(id => !evidenceIds.has(id))) return invalid('A stored evidence link is missing.')
    }
    return {
      schemaVersion: 1, id, title: string(value.title, 'Title', LIMITS.title),
      summary: string(value.summary, 'Summary', LIMITS.summary, true), workspacePath,
      stage: member(value.stage, 'Stage', STAGES), revision, reviewRevision,
      createdAt: timestamp(value.createdAt), updatedAt: timestamp(value.updatedAt),
      artifacts, evidence, decisions, checks, activity,
    }
  } catch (error) {
    throw new ProductError('unavailable', 'Stored project data could not be read. Review the local database before retrying.', undefined, { cause: error })
  }
}
