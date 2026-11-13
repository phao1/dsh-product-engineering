import { useState, type FormEvent, type ReactNode } from 'react'
import {
  ARTIFACT_TYPES, CHECK_STATUSES, EVIDENCE_KINDS, LIMITS,
  type ArtifactType, type EvidenceKind, type EvidenceView, type ProjectCommand, type ProjectView,
  type SkillCatalog, type Stage,
} from '../core/types.ts'
import type { Workspace } from './index.tsx'
import type { Key, Translate } from './locales.ts'
import { Button, Dialog, Feedback, Field, checkLabel, localizedSkill, webHref } from './ui.tsx'
import { artifactCommand, checkEvidenceSelection, evidenceUri, lastImportPath, links, replacedImportEvidence, value } from './workflow.ts'

export type Modal =
  | { kind: 'create' }
  | { kind: 'project' }
  | { kind: 'artifact'; id?: string; artifactType?: ArtifactType; skillId?: string }
  | { kind: 'evidence'; recaptureId?: string }
  | { kind: 'decision' }
  | { kind: 'resolve'; id: string }
  | { kind: 'reopen'; id: string }
  | { kind: 'check'; id: string }
  | { kind: 'stage'; stage: Stage }

type CreateInput = { title: string; summary: string; workspacePath: string }

function EditorForm({ busy, conflict, submitLabel, onClose, onSubmit, children, t }: {
  busy: boolean; conflict: boolean; submitLabel: Key; onClose(): void; onSubmit(data: FormData): void; children: ReactNode; t: Translate
}) {
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!busy && !conflict) onSubmit(new FormData(event.currentTarget))
  }
  return (
    <form className="pe-form" onSubmit={submit}>
      <fieldset disabled={busy} className="pe-form-fields">
        {children}
      </fieldset>
      <div className="pe-form-actions">
        <Button onClick={onClose} disabled={busy}>{t('cancel')}</Button>
        <Button variant="primary" type="submit" disabled={busy || conflict}>{t(busy ? 'saving' : submitLabel)}</Button>
      </div>
    </form>
  )
}

function EvidencePicker({ evidence, initial = [], importPath, t }: {
  evidence: readonly EvidenceView[]; initial?: string[]; importPath?: string; t: Translate
}) {
  const [selected, setSelected] = useState(initial)
  const [search, setSearch] = useState('')
  const query = search.trim().toLocaleLowerCase()
  const picked = evidence.filter(item => selected.includes(item.id))
  const replaced = (item: EvidenceView) => importPath !== undefined && replacedImportEvidence(item, importPath)
  const remainingCount = picked.filter(item => !replaced(item)).length
  const limit = importPath === undefined ? LIMITS.evidenceLinks : LIMITS.evidenceLinks - 1
  const matches = evidence.filter(item => selected.includes(item.id)
    || `${item.title} ${item.uri ?? ''} ${item.summary}`.toLocaleLowerCase().includes(query))
  return (
    <fieldset className="pe-evidence-picker">
      <legend>{t('evidenceLinks')}</legend>
      {evidence.length === 0
        ? <p>{t('evidenceLinkEmpty')}</p>
        : <>
            {evidence.length > 6 && (
              <input
                type="search" value={search} onChange={event => setSearch(event.target.value)}
                placeholder={t('evidenceFind')} aria-label={t('evidenceFind')}
              />
            )}
            <div className="pe-evidence-options">
              {matches.length === 0 && <p>{t('evidenceNoMatches')}</p>}
              {matches.map(item => {
                const checked = selected.includes(item.id)
                return (
                  <label key={item.id}>
                    <input
                      type="checkbox" name="evidence" value={item.id} checked={checked}
                      disabled={!checked && (picked.length >= LIMITS.evidenceLinks || (!replaced(item) && remainingCount >= limit))}
                      onChange={(event) => setSelected(current => event.target.checked
                        ? [...current, item.id] : current.filter(id => id !== item.id))}
                    />
                    <span>{item.title}</span>
                    <small>{t(item.freshness === 'stale' ? 'evidenceStaleShort' : `evidence.${item.kind}`)}</small>
                  </label>
                )
              })}
            </div>
            <small>{t(importPath === undefined ? 'evidenceMax' : 'artifactImportEvidenceMax', { count: limit })}</small>
          </>}
    </fieldset>
  )
}

interface EditorProps {
  modal: Modal
  view?: ProjectView
  catalog?: SkillCatalog
  workspaces: readonly Workspace[]
  busy: boolean
  error?: Key
  conflict: boolean
  errorDetail?: string
  onClose(): void
  onCreate(input: CreateInput): void
  onMutate(command: ProjectCommand): void
  t: Translate
}

export function Editor({ modal, view, catalog, workspaces, busy, error, conflict, errorDetail, onClose, onCreate, onMutate, t }: EditorProps) {
  const [localError, setLocalError] = useState<Key>()
  const project = view?.project
  const evidence = view?.evidence ?? []
  const artifact = modal.kind === 'artifact' ? project?.artifacts.find(item => item.id === modal.id) : undefined
  const recapture = modal.kind === 'evidence' ? evidence.find(item => item.id === modal.recaptureId && item.kind === 'file') : undefined
  const decision = modal.kind === 'resolve' || modal.kind === 'reopen' ? project?.decisions.find(item => item.id === modal.id) : undefined
  const check = modal.kind === 'check' ? view?.checks.find(item => item.id === modal.id) : undefined
  const [artifactSource, setArtifactSource] = useState<'content' | 'file'>('content')
  const [artifactPath, setArtifactPath] = useState(() => artifact && project ? lastImportPath(project.activity, artifact.id) : '')
  const [evidenceKind, setEvidenceKind] = useState<EvidenceKind>(recapture ? 'file' : 'command')
  const [status, setStatus] = useState(check?.stale ? 'pending' : check?.status ?? 'pending')

  let title: Key
  let body: ReactNode
  let submitLabel: Key = 'save'
  let submit: (data: FormData) => void

  switch (modal.kind) {
    case 'create':
    case 'project': {
      const create = modal.kind === 'create'
      title = create ? 'newProject' : 'editProject'
      submitLabel = create ? 'create' : 'save'
      body = <>
        <Field label={t('projectName')}>
          <input name="title" required maxLength={LIMITS.title} placeholder={t('projectNameHint')} defaultValue={create ? '' : project?.title} />
        </Field>
        <Field label={t('summary')}>
          <textarea name="summary" rows={3} maxLength={LIMITS.summary} placeholder={t('summaryHint')} defaultValue={create ? '' : project?.summary} />
        </Field>
        {create && (
          <Field label={t('workspace')} hint={t('workspaceHint')}>
            <select name="workspace" required defaultValue={workspaces.length === 1 ? workspaces[0].workspaceId : ''}>
              <option value="" disabled>{t('workspaceChoose')}</option>
              {workspaces.map(item => <option key={item.workspaceId} value={item.workspaceId}>{item.title} — {item.path}</option>)}
            </select>
          </Field>
        )}
      </>
      submit = data => {
        const title = value(data, 'title')
        const summary = value(data, 'summary')
        if (!title) return setLocalError('required')
        if (create) {
          const workspace = workspaces.find(item => item.workspaceId === value(data, 'workspace'))
          if (!workspace) return setLocalError('workspaceRequired')
          onCreate({ title, summary, workspacePath: workspace.path })
        } else {
          onMutate({ kind: 'project.update', title, summary })
        }
      }
      break
    }
    case 'artifact':
      title = artifact ? 'editArtifact' : 'addArtifact'
      submitLabel = artifactSource === 'file' ? 'artifactImport' : 'save'
      body = <>
        <Field label={t('artifactType')}>
          <select name="type" defaultValue={artifact?.type ?? modal.artifactType ?? 'brief'}>
            {ARTIFACT_TYPES.map(type => <option key={type} value={type}>{t(`artifact.${type}`)}</option>)}
          </select>
        </Field>
        <Field label={t('artifactTitle')}>
          <input name="title" required maxLength={LIMITS.title} defaultValue={artifact?.title} />
        </Field>
        <Field label={t('artifactSource')}>
          <select name="source" value={artifactSource} onChange={event => {
            setArtifactSource(event.target.value === 'file' ? 'file' : 'content')
          }}>
            <option value="content">{t('artifactSourceContent')}</option>
            <option value="file">{t('artifactSourceFile')}</option>
          </select>
        </Field>
        <div hidden={artifactSource !== 'content'}>
          <Field label={t('artifactContent')}>
            <textarea name="content" rows={7} disabled={artifactSource !== 'content'} required maxLength={LIMITS.content}
              placeholder={t('artifactContentHint')} defaultValue={artifact?.content} />
          </Field>
        </div>
        <div hidden={artifactSource !== 'file'}>
          <Field label={t('artifactFilePath')} hint={t('artifactImportHelp')}>
            <input name="path" required disabled={artifactSource !== 'file'} maxLength={LIMITS.uri}
              value={artifactPath} onChange={event => setArtifactPath(event.target.value)}
              autoCapitalize="none" spellCheck={false} />
          </Field>
        </div>
        {catalog && (
          <Field label={t('artifactSkill')}>
            <select name="skillId" defaultValue={artifact?.skillId ?? modal.skillId ?? ''}>
              <option value="">{t('noSkill')}</option>
              {catalog.skills.map(skill => <option key={skill.name} value={skill.name}>{localizedSkill(skill, t)}</option>)}
              {artifact?.skillId && !catalog.skills.some(skill => skill.name === artifact.skillId)
                && <option value={artifact.skillId}>{artifact.skillId}</option>}
            </select>
          </Field>
        )}
        <EvidencePicker evidence={evidence} initial={artifact?.evidenceIds}
          importPath={artifactSource === 'file' ? artifactPath : undefined} t={t} />
      </>
      submit = data => {
        const command = artifactCommand(data, modal.id, artifact?.skillId ?? modal.skillId)
        if (!command) return setLocalError('required')
        if (command.kind === 'artifact.importFile' && command.evidenceIds?.length === LIMITS.evidenceLinks
          && !evidence.some(item => command.evidenceIds?.includes(item.id) && replacedImportEvidence(item, command.path))) {
          return setLocalError('artifactImportLinks')
        }
        onMutate(command)
      }
      break
    case 'evidence': {
      title = recapture ? 'evidenceRecapture' : 'addEvidence'
      if (recapture) submitLabel = 'evidenceRecapture'
      const uriLabel = { url: 'evidenceUrl', file: 'evidenceFile', command: 'evidenceCommand' } as const
      const kindHint = { url: undefined, file: 'evidenceFileHelp', command: 'evidenceCommandHelp' } as const
      body = <>
        {recapture ? <p className="pe-form-context">{t('evidenceRecaptureHelp')}</p> : <Field label={t('evidenceType')}>
          <select name="kind" value={evidenceKind} onChange={(event) => {
            const kind = EVIDENCE_KINDS.find(item => item === event.target.value)
            if (kind) setEvidenceKind(kind)
          }}>
            {EVIDENCE_KINDS.map(kind => <option key={kind} value={kind}>{t(`evidence.${kind}`)}</option>)}
          </select>
        </Field>}
        <Field label={t('evidenceTitle')}>
          <input name="title" required maxLength={LIMITS.title} defaultValue={recapture?.title} />
        </Field>
        {evidenceKind !== 'note' && (
          <Field label={t(uriLabel[evidenceKind])} hint={kindHint[evidenceKind] ? t(kindHint[evidenceKind]) : undefined}>
            <input key={evidenceKind} name="uri" required maxLength={LIMITS.uri} type={evidenceKind === 'url' ? 'url' : 'text'}
              defaultValue={recapture?.uri} autoCapitalize={evidenceKind === 'file' ? 'none' : undefined}
              spellCheck={evidenceKind === 'file' ? false : undefined} />
          </Field>
        )}
        <Field label={t('evidenceSummary')} hint={evidenceKind === 'note' ? t('evidenceNoteHelp') : undefined}>
          <textarea name="summary" rows={4} required maxLength={LIMITS.detail} defaultValue={recapture?.summary} />
        </Field>
      </>
      submit = data => {
        const title = value(data, 'title')
        const summary = value(data, 'summary')
        const uri = evidenceUri(data, evidenceKind)
        if (!title || !summary || (evidenceKind !== 'note' && !uri)) return setLocalError('required')
        if (evidenceKind === 'url' && !webHref(uri)) return setLocalError('evidenceSafeUrl')
        onMutate({ kind: 'evidence.add', evidenceKind, title, summary, ...(uri ? { uri } : {}) })
      }
      break
    }
    case 'decision':
      title = 'addDecision'
      body = <>
        <Field label={t('decisionTitle')}><input name="title" required maxLength={LIMITS.title} /></Field>
        <Field label={t('decisionContext')}><textarea name="context" rows={3} required maxLength={LIMITS.detail} /></Field>
        <Field label={t('decisionOptions')}>
          <textarea
            name="options" rows={4} required maxLength={LIMITS.options * (LIMITS.option + 1)}
            placeholder={t('decisionOptionsHint')}
          />
        </Field>
        <EvidencePicker evidence={evidence} t={t} />
      </>
      submit = data => {
        const title = value(data, 'title')
        const context = value(data, 'context')
        const options = value(data, 'options').split(/\r?\n/u).map(option => option.trim()).filter(Boolean)
        if (!title || !context) return setLocalError('required')
        if (options.length < 2 || options.length > LIMITS.options || new Set(options).size !== options.length
          || options.some(option => option.length > LIMITS.option)) return setLocalError('decisionOptionsError')
        onMutate({ kind: 'decision.add', title, context, options, evidenceIds: links(data) })
      }
      break
    case 'resolve':
      if (!decision) return null
      title = 'resolveDecision'
      body = <>
        <div className="pe-form-context"><strong>{decision.title}</strong><p>{decision.context}</p></div>
        <Field label={t('decisionChoice')}>
          <select name="choice" defaultValue="" required>
            <option value="" disabled>{t('chooseOption')}</option>
            {decision.options.map(option => <option key={option} value={option}>{option}</option>)}
          </select>
        </Field>
        <Field label={t('decisionRationale')}>
          <textarea name="rationale" rows={4} required maxLength={LIMITS.detail} />
        </Field>
      </>
      submit = data => {
        const choice = value(data, 'choice')
        const rationale = value(data, 'rationale')
        if (!choice || !rationale) return setLocalError('required')
        onMutate({ kind: 'decision.resolve', id: decision.id, choice, rationale })
      }
      break
    case 'reopen':
      if (!decision) return null
      title = 'reopenDecision'
      submitLabel = 'reopenDecision'
      body = <>
        <div className="pe-form-context"><strong>{decision.title}</strong><p>{decision.choice}</p></div>
        <Field label={t('reopenReason')}>
          <textarea name="reason" rows={4} required maxLength={LIMITS.detail} />
        </Field>
      </>
      submit = data => {
        const reason = value(data, 'reason')
        if (!reason) return setLocalError('required')
        onMutate({ kind: 'decision.reopen', id: decision.id, reason })
      }
      break
    case 'check': {
      if (!check) return null
      title = 'checkEdit'
      const { available, initial, stale } = checkEvidenceSelection(evidence, check.evidenceIds)
      body = <>
        <div className="pe-form-context"><strong>{checkLabel(check, t)}</strong><p>{t('checkHelp')}</p></div>
        {check.stale && <p className="pe-form-warning">{t('staleHelp')}</p>}
        <Field label={t('checkStatus')}>
          <select name="status" value={status} onChange={(event) => {
            const next = CHECK_STATUSES.find(item => item === event.target.value)
            if (next) setStatus(next)
          }}>
            {CHECK_STATUSES.map(item => <option key={item} value={item}>{t(`check.${item}`)}</option>)}
          </select>
        </Field>
        {stale.length > 0 && (
          <div className="pe-form-warning">
            <p>{t('checkStaleLinks')}</p>
            <ul className="pe-options">{stale.map(item => <li key={item.id}>{item.title}{item.uri && <> · <code>{item.uri}</code></>}</li>)}</ul>
          </div>
        )}
        <EvidencePicker evidence={available} initial={initial} t={t} />
        <Field label={t(status === 'waived' ? 'checkWaiver' : 'checkNote')}>
          <textarea name="note" rows={3} required={status === 'waived'} maxLength={LIMITS.detail} defaultValue={check.note} />
        </Field>
      </>
      submit = data => {
        const evidenceIds = links(data)
        const note = value(data, 'note')
        if (status === 'passed' && evidenceIds.length === 0) return setLocalError('evidenceRequired')
        if (status === 'waived' && !note) return setLocalError('checkWaiverRequired')
        onMutate({ kind: 'check.set', id: check.id, status, evidenceIds, note })
      }
      break
    }
    case 'stage':
      title = 'stageMove'
      submitLabel = 'stageMove'
      body = <p>{t('stageConfirm', { stage: t(`stage.${modal.stage}`) })}</p>
      submit = () => onMutate({ kind: 'stage.move', stage: modal.stage })
      break
  }

  return (
    <Dialog title={t(title)} busy={busy} error={error} onClose={onClose} t={t}>
      {errorDetail && <p className="pe-error-detail">{errorDetail}</p>}
      {localError === 'decisionOptionsError'
        ? <p className="pe-error-detail" role="alert">{t(localError, { count: LIMITS.options, length: LIMITS.option })}</p>
        : <Feedback error={localError} t={t} />}
      <EditorForm busy={busy} conflict={conflict} submitLabel={submitLabel} onClose={onClose} t={t} onSubmit={(data) => {
        setLocalError(undefined)
        submit(data)
      }}>
        {body}
      </EditorForm>
    </Dialog>
  )
}
