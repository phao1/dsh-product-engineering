import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import {
  IconFolderCloseMedium, IconPlusOutlineRegular, IconRefreshOutlineRegular, IconSearchOutlineRegular,
  IconWorkspaceTreeOutlineMedium,
} from '@deepseek-ai/dsh-client-ui-primitives'
import type {
  ExportFormat, ProductRequest, ProjectCommand, ProjectSummary, ProjectView, SkillCatalog,
} from '../core/types.ts'
import { ProductClientError, errorKey, projectSummary, type ProductApi } from './api.ts'
import { Editor, type Modal } from './Forms.tsx'
import type { WorkspaceSource } from './index.tsx'
import type { Key, Translate } from './locales.ts'
import { ProjectPanel, type Section } from './ProjectPanel.tsx'
import { SkillLibrary } from './SkillLibrary.tsx'
import { Button, Dialog, Feedback, Field, download, type Skill } from './ui.tsx'
import { readRemediationStep } from './workflow.ts'

type Load<T> =
  | { status: 'loading'; data?: T }
  | { status: 'ready'; data: T }
  | { status: 'error'; data?: T; error: Key }

type OperationError = { key: Key; detail?: string }
type ActiveEditor = {
  modal: Modal
  base?: { projectId: string; revision: number }
}

interface WorkbenchProps {
  request: ProductApi
  workspaceSource: WorkspaceSource
  navigation: { selectedId?: string }
  startDraft(workspaceId: string, prompt: string): Promise<void>
  t: Translate
}

function useLoad<T>(read: (signal: AbortSignal) => Promise<T>, changes: readonly unknown[]): Load<T> {
  const [load, setLoad] = useState<Load<T>>({ status: 'loading' })
  useEffect(() => {
    const controller = new AbortController()
    setLoad(current => ({ status: 'loading', data: current.data }))
    read(controller.signal).then(
      data => { if (!controller.signal.aborted) setLoad({ status: 'ready', data }) },
      error => {
        if (!controller.signal.aborted) setLoad(current => ({ status: 'error', data: current.data, error: errorKey(error) }))
      },
    )
    return () => controller.abort()
  }, changes)
  return load
}

function EmptyProject({ canCreate, workspacePending, onCreate, onLibrary, t }: {
  canCreate: boolean; workspacePending: boolean; onCreate(): void; onLibrary(): void; t: Translate
}) {
  return (
    <div className="pe-empty-project">
      <div className="pe-empty-mark"><IconWorkspaceTreeOutlineMedium size={29} /></div>
      <h2>{t('projectEmptyTitle')}</h2>
      <p>{t(canCreate ? 'projectEmptyBody' : workspacePending ? 'loading' : 'workspaceRequired')}</p>
      <div className="pe-actions">
        <Button variant="primary" onClick={onCreate} disabled={!canCreate}><IconPlusOutlineRegular size={15} />{t('newProject')}</Button>
        <Button onClick={onLibrary}>{t('projectEmptySecondary')}<span aria-hidden="true">→</span></Button>
      </div>
    </div>
  )
}

function ProjectList({ projects, selected, disabled, onSelect, t }: {
  projects: ProjectSummary[]; selected?: string; disabled: boolean; onSelect(id: string): void; t: Translate
}) {
  const [search, setSearch] = useState('')
  const query = search.trim().toLocaleLowerCase()
  const matches = projects.filter(project => `${project.title} ${project.summary} ${project.workspacePath}`.toLocaleLowerCase().includes(query))
  return (
    <nav className="pe-project-list" aria-label={t('projects')}>
      <div className="pe-section-heading"><h2>{t('projects')}</h2><span className="pe-list-count">{projects.length}</span></div>
      {projects.length > 5 && (
        <div className="pe-search">
          <IconSearchOutlineRegular size={15} />
          <input type="search" value={search} onChange={event => setSearch(event.target.value)} aria-label={t('searchProjects')} placeholder={t('searchProjects')} />
        </div>
      )}
      {matches.length === 0 && <p className="pe-muted">{t('noProjectMatches')}</p>}
      <ul>
        {matches.map(item => (
          <li key={item.id}>
            <button type="button" disabled={disabled} aria-current={item.id === selected ? 'page' : undefined} onClick={() => onSelect(item.id)}>
              <IconFolderCloseMedium size={16} />
              <span><strong>{item.title}</strong><small>{t(`stage.${item.stage}`)}</small></span>
            </button>
          </li>
        ))}
      </ul>
    </nav>
  )
}

export function Workbench({ request, workspaceSource, navigation, startDraft, t }: WorkbenchProps) {
  const { items: workspaces, phase: workspacePhase } = useSyncExternalStore(workspaceSource.subscribe, workspaceSource.getSnapshot)
  const [tab, setTab] = useState<'projects' | 'library'>('projects')
  const [section, setSection] = useState<Section>('overview')
  const [selectedId, setSelectedId] = useState(navigation.selectedId)
  const [focusEvidence, setFocusEvidence] = useState<string>()
  const [refresh, setRefresh] = useState(0)
  const [refreshCatalog, setRefreshCatalog] = useState(0)
  const [editor, setEditor] = useState<ActiveEditor>()
  const [launchSkill, setLaunchSkill] = useState<Skill>()
  const [error, setError] = useState<OperationError>()
  const [modalError, setModalError] = useState<OperationError>()
  const [notice, setNotice] = useState<Key>()
  const [working, setWorking] = useState(false)
  const busyRef = useRef(false)
  const live = useRef(false)

  const list = useLoad<ProjectSummary[]>(signal => request({ op: 'list' }, signal), [request, refresh])
  const catalog = useLoad<SkillCatalog>(signal => request({ op: 'catalog' }, signal), [request, refreshCatalog])
  const detail = useLoad<ProjectView | undefined>(
    signal => selectedId ? request({ op: 'get', projectId: selectedId }, signal) : Promise.resolve(undefined),
    [request, selectedId, refresh],
  )
  const [writtenView, setWrittenView] = useState<{ view: ProjectView; previousRead?: ProjectView }>()
  const [writtenSummaries, setWrittenSummaries] = useState<Record<string, ProjectSummary>>({})

  useEffect(() => {
    live.current = true
    return () => { live.current = false }
  }, [])

  useEffect(() => {
    if (list.status !== 'ready') return
    if (!selectedId || (!list.data.some(item => item.id === selectedId) && !writtenSummaries[selectedId])) {
      const next = list.data[0]?.id
      navigation.selectedId = next
      setSelectedId(next)
    }
  }, [list, selectedId, writtenSummaries, navigation])

  const projects = (list.data ?? []).map(item => {
    const written = writtenSummaries[item.id]
    return written && written.revision >= item.revision ? written : item
  })
  for (const item of Object.values(writtenSummaries)) {
    if (!projects.some(project => project.id === item.id)) projects.push(item)
  }
  projects.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))

  const loaded = detail.data?.project.id === selectedId ? detail.data : undefined
  const written = writtenView?.view.project.id === selectedId ? writtenView : undefined
  const view = written && (!loaded || written.view.project.revision > loaded.project.revision
    || (loaded === written.previousRead && written.view.project.revision === loaded.project.revision)) ? written.view : loaded
  const context = view?.project ?? projects.find(project => project.id === selectedId)
  const projectBusy = working || detail.status === 'loading'
  const canCreate = workspaces.length > 0
  const refreshAll = () => { setError(undefined); setRefresh(value => value + 1) }

  function select(id: string) {
    navigation.selectedId = id
    setSelectedId(id)
    setFocusEvidence(undefined)
    setSection('overview')
    setNotice(undefined)
    setError(undefined)
  }

  function showSection(section: Section) {
    setFocusEvidence(undefined)
    setSection(section)
  }

  function open(next: Modal) {
    if (busyRef.current) return
    setNotice(undefined)
    setError(undefined)
    setModalError(undefined)
    const base = next.kind === 'create' || !view
      ? undefined
      : { projectId: view.project.id, revision: view.project.revision }
    setEditor({ modal: next, base })
  }

  function close() {
    if (busyRef.current) return
    setEditor(undefined)
    setModalError(undefined)
  }

  function accept(next: ProjectView) {
    setWrittenView({ view: next, previousRead: loaded })
    setWrittenSummaries(current => ({ ...current, [next.project.id]: projectSummary(next.project) }))
  }

  async function run(action: () => Promise<void>, inEditor: boolean) {
    if (busyRef.current) return
    busyRef.current = true
    setWorking(true)
    setNotice(undefined)
    setError(undefined)
    setModalError(undefined)
    try {
      await action()
    } catch (cause) {
      if (!live.current) return
      let key = errorKey(cause)
      if (key === 'conflict' && selectedId) {
        try {
          const latest = await request({ op: 'get', projectId: selectedId })
          if (live.current) accept(latest)
        } catch {
          key = 'conflictReload'
        }
      }
      if (!live.current) return
      const detail = cause instanceof ProductClientError && (cause.code === 'invalid-input' || cause.code === 'blocked')
        ? cause.message : undefined
      const problem = { key, detail }
      if (inEditor) setModalError(problem)
      else setError(problem)
    } finally {
      busyRef.current = false
      if (live.current) setWorking(false)
    }
  }

  function create(input: Omit<Extract<ProductRequest, { op: 'create' }>, 'op'>) {
    void run(async () => {
      const next = await request({ op: 'create', ...input })
      if (!live.current) return
      accept(next)
      select(next.project.id)
      setTab('projects')
      setEditor(undefined)
      setNotice('saved')
    }, true)
  }

  function mutate(command: ProjectCommand) {
    const base = editor?.base
    if (!base || modalError?.key === 'conflict' || modalError?.key === 'conflictReload') return
    void run(async () => {
      const next = await request({
        op: 'mutate', projectId: base.projectId, expectedRevision: base.revision, command,
      })
      if (!live.current) return
      accept(next)
      setEditor(undefined)
      setNotice('saved')
    }, true)
  }

  function exportProject(format: ExportFormat) {
    if (!view) return
    void run(async () => {
      const file = await request({ op: 'export', projectId: view.project.id, format })
      if (!live.current) return
      download(file)
      setNotice('exportReady')
    }, false)
  }

  function launch(skill: Skill, chosenWorkspace?: string) {
    if (!skill.userInvocable || busyRef.current) return
    const workspaceId = chosenWorkspace ?? (context
      ? workspaces.find(item => item.path === context.workspacePath)?.workspaceId
      : workspaces.length === 1 ? workspaces[0].workspaceId : undefined)
    if (!workspaceId && !context && workspaces.length > 1) {
      setLaunchSkill(skill)
      return
    }
    if (!workspaceId) {
      setError({ key: 'workspaceMissing' })
      return
    }
    const prompt = [`/${skill.name}`]
    if (context) {
      prompt.push(
        t('skillDraftContext', { project: context.title, stage: t(`stage.${context.stage}`), id: context.id, revision: context.revision }),
        t('skillDraftRead'),
      )
    }
    prompt.push(t('skillDraftRequest'))
    setLaunchSkill(undefined)
    void run(async () => {
      try {
        await startDraft(workspaceId, prompt.join('\n\n'))
      } catch {
        if (live.current) setError({ key: 'skillDraftFailed' })
      }
    }, false)
  }

  function launchRemediation(checkId: string) {
    if (!view) return
    const projectId = view.project.id
    void run(async () => {
      const { latest, step } = await readRemediationStep(request, projectId, checkId, t)
      if (!live.current) return
      accept(latest)
      if (!step) {
        setNotice('remediationCleared')
        return
      }
      const workspaceId = workspaces.find(item => item.path === latest.project.workspacePath)?.workspaceId
      if (!workspaceId) {
        setError({ key: 'workspaceMissing' })
        return
      }
      try {
        await startDraft(workspaceId, step.prompt)
      } catch {
        if (live.current) setError({ key: 'remediationDraftFailed' })
      }
    }, false)
  }

  async function copySkill(skill: Skill) {
    setError(undefined)
    setNotice(undefined)
    try {
      await navigator.clipboard.writeText(`/${skill.name}`)
      if (live.current) setNotice('skillCopied')
    } catch {
      if (live.current) setError({ key: 'copyFailed' })
    }
  }

  function changeTab(next: 'projects' | 'library') {
    setTab(next)
    setNotice(undefined)
    setError(undefined)
  }

  const listError = list.status === 'error' ? list.error : undefined
  const detailError = detail.status === 'error' ? detail.error : undefined
  const catalogError = catalog.status === 'error' ? catalog.error : undefined
  return (
    <section className="pe-workbench" data-dsh-pe="" aria-label={t('panel')}>
      <header className="pe-top">
        <div className="pe-brand">
          <span className="pe-brand-mark" aria-hidden="true"><IconWorkspaceTreeOutlineMedium size={19} /></span>
          <h1>{t('panel')}</h1>
        </div>
        <nav className="pe-top-tabs" aria-label={t('panel')}>
          <button type="button" aria-current={tab === 'projects' ? 'page' : undefined} disabled={working} onClick={() => changeTab('projects')}>{t('projects')}</button>
          <button type="button" aria-current={tab === 'library' ? 'page' : undefined} disabled={working} onClick={() => changeTab('library')}>{t('library')}</button>
        </nav>
        <div className="pe-top-actions">
          <Button variant="quiet" className="pe-icon-button" disabled={working || list.status === 'loading'} onClick={refreshAll} title={t('refresh')} aria-label={t('refresh')}>
            <IconRefreshOutlineRegular size={17} />
          </Button>
          <Button
            variant="primary" disabled={working || list.status === 'loading' || !canCreate}
            title={!canCreate && workspacePhase === 'ready' ? t('workspaceRequired') : undefined}
            onClick={() => open({ kind: 'create' })}
          >
            <IconPlusOutlineRegular size={15} />{t('newProject')}
          </Button>
        </div>
      </header>
      <div className="pe-scroll">
        <div className="pe-page">
          {(error || notice) && (
            <div className="pe-global-feedback">
              {error && <><Feedback error={error.key} t={t} />{error.detail && <p className="pe-error-detail">{error.detail}</p>}</>}
              {notice && <p className="pe-success" role="status">{t(notice)}</p>}
            </div>
          )}
          {tab === 'library' ? (
            <>
              <Feedback error={catalogError} loading={!catalog.data && catalog.status === 'loading'} t={t}
                onRetry={() => setRefreshCatalog(value => value + 1)}
              />
              {catalog.data && <SkillLibrary catalog={catalog.data} project={context} busy={working} onSkill={launch} onCopy={copySkill} t={t} />}
            </>
          ) : (
            <>
              <Feedback loading={!list.data && list.status === 'loading'} error={listError} onRetry={refreshAll} t={t} />
              {list.status === 'ready' && projects.length === 0 && (
                <EmptyProject canCreate={canCreate} workspacePending={workspacePhase === 'pending'}
                  onCreate={() => open({ kind: 'create' })} onLibrary={() => changeTab('library')} t={t}
                />
              )}
              {projects.length > 0 && (
                <div className="pe-project-grid">
                  <ProjectList projects={projects} selected={selectedId} disabled={working} onSelect={select} t={t} />
                  <div className="pe-project-main">
                    <Feedback loading={!view && detail.status === 'loading'} error={detailError} onRetry={refreshAll} t={t} />
                    {view && (
                      <ProjectPanel
                        view={view} catalog={catalog.data} section={section} focusEvidence={focusEvidence} busy={projectBusy}
                        onSection={showSection} onEvidence={id => { setSection('evidence'); setFocusEvidence(id) }}
                        onOpen={open} onLibrary={() => changeTab('library')} onSkill={launch}
                        onRemediate={launchRemediation} onExport={exportProject} t={t}
                      />
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
      {launchSkill && (
        <Dialog title={t('skillDraftWorkspace')} busy={false} onClose={() => setLaunchSkill(undefined)} t={t}>
          <form onSubmit={event => {
            event.preventDefault()
            const chosen = new FormData(event.currentTarget).get('workspaceId')
            if (typeof chosen === 'string' && workspaces.some(item => item.workspaceId === chosen)) launch(launchSkill, chosen)
          }}>
            <Field label={t('workspace')}>
              <select name="workspaceId" required defaultValue="">
                <option value="" disabled>{t('workspaceChoose')}</option>
                {workspaces.map(item => <option key={item.workspaceId} value={item.workspaceId}>{item.title} — {item.path}</option>)}
              </select>
            </Field>
            <div className="pe-form-actions">
              <Button onClick={() => setLaunchSkill(undefined)}>{t('cancel')}</Button>
              <Button variant="primary" type="submit">{t('skillOpen')}</Button>
            </div>
          </form>
        </Dialog>
      )}
      {editor && (
        <Editor
          modal={editor.modal} view={view} catalog={catalog.data} workspaces={workspaces} busy={working}
          error={modalError?.key} errorDetail={modalError?.detail}
          conflict={modalError?.key === 'conflict' || modalError?.key === 'conflictReload'}
          onClose={close} onCreate={create} onMutate={mutate} t={t}
        />
      )}
    </section>
  )
}
