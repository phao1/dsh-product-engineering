import {
  ARTIFACT_TYPES, CHECK_STATUSES, EVIDENCE_KINDS, LIMITS, STAGES,
  type ProductRequest, type ProjectCommand,
} from './types.ts'
import { ProductError } from './errors.ts'

const ID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
const KEY = /^[a-z][a-z0-9-]{0,95}$/

export function invalid(message: string): never {
  throw new ProductError('invalid-input', message)
}

export function object(value: unknown, field: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    invalid(`${field} must be an object.`)
  }
  return value as Record<string, unknown>
}

function only(record: Record<string, unknown>, fields: readonly string[]): void {
  if (Object.keys(record).some(field => !fields.includes(field))) {
    invalid('The request contains an unrecognized field.')
  }
}

export function string(value: unknown, field: string, limit: number, allowEmpty = false): string {
  if (typeof value !== 'string' || value.length > limit || value.includes('\0')) {
    invalid(`${field} must be text up to ${limit} characters.`)
  }
  const trimmed = value.trim()
  if (!allowEmpty && trimmed.length === 0) invalid(`${field} is required.`)
  return trimmed
}

export function pathText(value: unknown, field: string, limit: number): string {
  if (typeof value !== 'string' || value.length === 0 || value.length > limit || value.includes('\0')) {
    invalid(`${field} must be a path up to ${limit} characters.`)
  }
  return value
}

export function artifactContent(value: unknown): string {
  string(value, 'Artifact content', LIMITS.content)
  return value as string
}

function optionalText(value: unknown, field: string, limit: number, allowEmpty = false): string | undefined {
  return value === undefined ? undefined : string(value, field, limit, allowEmpty)
}

export function uuid(value: unknown, field: string): string {
  if (typeof value !== 'string' || !ID.test(value)) invalid(`${field} is invalid.`)
  return value
}

export function key(value: unknown, field: string): string {
  if (typeof value !== 'string' || !KEY.test(value)) invalid(`${field} is invalid.`)
  return value
}

export function integer(value: unknown, field: string, minimum = 1): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < minimum) {
    invalid(`${field} must be an integer of at least ${minimum}.`)
  }
  return value
}

export function member<const T extends readonly string[]>(value: unknown, field: string, choices: T): T[number] {
  if (typeof value !== 'string' || !choices.includes(value)) invalid(`${field} is invalid.`)
  return value as T[number]
}

export function array(value: unknown, field: string, min: number, max: number): unknown[] {
  if (!Array.isArray(value) || value.length < min || value.length > max) {
    invalid(`${field} must contain between ${min} and ${max} entries.`)
  }
  return value
}

export function unique(values: string[], field: string): string[] {
  if (new Set(values).size !== values.length) invalid(`${field} must contain distinct entries.`)
  return values
}

function evidenceIds(value: unknown): string[] | undefined {
  if (value === undefined) return undefined
  return unique(array(value, 'Evidence links', 0, LIMITS.evidenceLinks).map(id => uuid(id, 'Evidence ID')), 'Evidence links')
}

export function parseCommand(input: unknown): ProjectCommand {
  const data = object(input, 'Command')
  switch (data.kind) {
    case 'project.update': {
      only(data, ['kind', 'title', 'summary'])
      const title = optionalText(data.title, 'Title', LIMITS.title)
      const summary = optionalText(data.summary, 'Summary', LIMITS.summary, true)
      if (title === undefined && summary === undefined) invalid('Provide a title or summary to update.')
      return { kind: data.kind, title, summary }
    }
    case 'artifact.save':
    case 'artifact.importFile': {
      const kind = data.kind
      only(data, ['kind', 'id', 'type', 'title', 'skillId', 'evidenceIds', kind === 'artifact.save' ? 'content' : 'path'])
      const metadata = {
        id: data.id === undefined ? undefined : uuid(data.id, 'Artifact ID'),
        type: member(data.type, 'Artifact type', ARTIFACT_TYPES),
        title: string(data.title, 'Title', LIMITS.title),
        skillId: data.skillId === undefined ? undefined : key(data.skillId, 'Skill ID'),
        evidenceIds: evidenceIds(data.evidenceIds),
      }
      return kind === 'artifact.save'
        ? { kind, ...metadata, content: artifactContent(data.content) }
        : { kind, ...metadata, path: pathText(data.path, 'File path', LIMITS.uri) }
    }
    case 'evidence.add': {
      only(data, ['kind', 'evidenceKind', 'title', 'uri', 'summary'])
      const evidenceKind = member(data.evidenceKind, 'Evidence type', EVIDENCE_KINDS)
      const uri = data.uri !== undefined && evidenceKind === 'file'
        ? pathText(data.uri, 'File path', LIMITS.uri) : optionalText(data.uri, 'Evidence reference', LIMITS.uri)
      return {
        kind: data.kind,
        evidenceKind,
        title: string(data.title, 'Title', LIMITS.title),
        uri,
        summary: string(data.summary, 'Evidence summary', LIMITS.detail),
      }
    }
    case 'decision.add':
      only(data, ['kind', 'title', 'context', 'options', 'evidenceIds'])
      return {
        kind: data.kind,
        title: string(data.title, 'Title', LIMITS.title),
        context: string(data.context, 'Decision context', LIMITS.detail),
        options: unique(array(data.options, 'Decision options', 2, LIMITS.options)
          .map(option => string(option, 'Decision option', LIMITS.option)), 'Decision options'),
        evidenceIds: evidenceIds(data.evidenceIds),
      }
    case 'decision.resolve':
      only(data, ['kind', 'id', 'choice', 'rationale'])
      return {
        kind: data.kind,
        id: uuid(data.id, 'Decision ID'),
        choice: string(data.choice, 'Choice', LIMITS.option),
        rationale: string(data.rationale, 'Rationale', LIMITS.detail),
      }
    case 'decision.reopen':
      only(data, ['kind', 'id', 'reason'])
      return {
        kind: data.kind,
        id: uuid(data.id, 'Decision ID'),
        reason: string(data.reason, 'Reopening reason', LIMITS.detail),
      }
    case 'check.set':
      only(data, ['kind', 'id', 'status', 'evidenceIds', 'note'])
      return {
        kind: data.kind,
        id: key(data.id, 'Check ID'),
        status: member(data.status, 'Check status', CHECK_STATUSES),
        evidenceIds: evidenceIds(data.evidenceIds),
        note: optionalText(data.note, 'Check note', LIMITS.detail, true),
      }
    case 'stage.move':
      only(data, ['kind', 'stage'])
      return { kind: data.kind, stage: member(data.stage, 'Stage', STAGES) }
    default:
      return invalid('Unknown workspace command.')
  }
}

export function parseRequest(input: unknown): ProductRequest {
  const data = object(input, 'Request')
  switch (data.op) {
    case 'list':
    case 'catalog':
      only(data, ['op'])
      return { op: data.op }
    case 'get':
      only(data, ['op', 'projectId'])
      return { op: data.op, projectId: uuid(data.projectId, 'Project ID') }
    case 'create':
      only(data, ['op', 'title', 'summary', 'workspacePath'])
      return {
        op: data.op,
        title: string(data.title, 'Title', LIMITS.title),
        summary: optionalText(data.summary, 'Summary', LIMITS.summary, true),
        workspacePath: data.workspacePath === undefined ? undefined : pathText(data.workspacePath, 'Workspace folder', LIMITS.workspacePath),
      }
    case 'mutate':
      only(data, ['op', 'projectId', 'expectedRevision', 'command'])
      return {
        op: data.op,
        projectId: uuid(data.projectId, 'Project ID'),
        expectedRevision: integer(data.expectedRevision, 'Expected revision'),
        command: parseCommand(data.command),
      }
    case 'export':
      only(data, ['op', 'projectId', 'format'])
      return {
        op: data.op,
        projectId: uuid(data.projectId, 'Project ID'),
        format: member(data.format, 'Export format', ['json', 'markdown']),
      }
    default:
      return invalid('Unknown workspace operation.')
  }
}
