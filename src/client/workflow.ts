import { createRemediationPlan, type RemediationStep } from '../core/remediation.ts'
import { ARTIFACT_TYPES, type Activity, type EvidenceKind, type EvidenceView, type ProjectCommand, type ProjectView } from '../core/types.ts'
import type { ProductApi } from './api.ts'
import type { Translate } from './locales.ts'

export function rawValue(data: FormData, name: string): string {
  const field = data.get(name)
  return typeof field === 'string' ? field : ''
}

export function value(data: FormData, name: string): string {
  return rawValue(data, name).trim()
}

export function links(data: FormData): string[] {
  return data.getAll('evidence').filter((id): id is string => typeof id === 'string')
}

type ArtifactCommand = Extract<ProjectCommand, { kind: 'artifact.save' | 'artifact.importFile' }>

export function artifactCommand(data: FormData, id?: string, fallbackSkill?: string): ArtifactCommand | undefined {
  const title = value(data, 'title')
  const type = ARTIFACT_TYPES.find(item => item === value(data, 'type'))
  if (!title || !type) return undefined

  const skillId = data.has('skillId') ? value(data, 'skillId') : fallbackSkill
  const fields = { ...(id ? { id } : {}), type, title, ...(skillId ? { skillId } : {}), evidenceIds: links(data) }
  if (value(data, 'source') === 'file') {
    const path = rawValue(data, 'path')
    return path ? { kind: 'artifact.importFile', ...fields, path } : undefined
  }
  const content = rawValue(data, 'content')
  return content.trim() ? { kind: 'artifact.save', ...fields, content } : undefined
}

export function evidenceUri(data: FormData, kind: EvidenceKind): string {
  return kind === 'file' ? rawValue(data, 'uri') : value(data, 'uri')
}

export function replacedImportEvidence(item: EvidenceView, path: string): boolean {
  return item.kind === 'file' && item.verification === 'snapshot' && item.uri === path
}

export function lastImportPath(activity: readonly Activity[], artifactId: string): string {
  return activity.findLast(item => item.kind === 'artifact.importFile' && item.targetId === artifactId)?.detail ?? ''
}

export function checkEvidenceSelection(evidence: readonly EvidenceView[], linkedIds: readonly string[]) {
  const available = evidence.filter(item => item.freshness !== 'stale')
  const byId = new Map(evidence.map(item => [item.id, item]))
  const stale = linkedIds.flatMap(id => {
    const item = byId.get(id)
    return item?.freshness === 'stale' ? [item] : []
  })
  const initial = linkedIds.filter(id => byId.has(id) && byId.get(id)?.freshness !== 'stale')
  return { available, initial, stale }
}

export function remediationLocale(t: Translate): 'zh-CN' | 'en' {
  return t('locale') === 'zh-CN' ? 'zh-CN' : 'en'
}

export async function readRemediationStep(request: ProductApi, projectId: string, checkId: string, t: Translate):
  Promise<{ latest: ProjectView; step?: RemediationStep }> {
  const latest = await request({ op: 'get', projectId })
  const plan = createRemediationPlan(latest, remediationLocale(t))
  const step = plan.steps.find(item => item.kind === 'check' && item.id === checkId)
  return { latest, step }
}
