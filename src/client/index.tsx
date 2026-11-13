import type { JSX } from 'react'
import { IconWorkspaceTreeOutlineMedium } from '@deepseek-ai/dsh-client-ui-primitives'
import { Workbench } from './Workbench.tsx'
import { createProductApi, type NativeRpc } from './api.ts'
import { en, namespace, zh, type Translate } from './locales.ts'
import styles from './workbench.css'

const panelId = 'dsh-product-engineering'

export interface Workspace {
  readonly workspaceId: string
  readonly title: string
  readonly path: string
}

export interface WorkspaceSource {
  subscribe(listener: () => void): () => void
  getSnapshot(): { readonly items: readonly Workspace[]; readonly phase: 'pending' | 'ready' }
}

interface ClientContext {
  readonly connection: { readonly rpc: NativeRpc }
  readonly workspaces: { readonly list: WorkspaceSource }
  readonly uiWorkspace: {
    openSession(id: string): void
  }
  readonly layout: { beginNavigation(): AbortSignal }
  readonly sessions: {
    create(options: { workspaceId: string }): Promise<string>
    retain(id: string, options: { source: 'mainView' }): { binding: object; release(): void }
  }
  readonly conversation: {
    readonly input: {
      requestDraftInitialization(binding: object, options: { prompt: string }): 'applied' | 'preserved' | 'blocked'
    }
  }
  readonly locale: {
    register(name: string, dictionaries: { en: typeof en; zh: typeof zh }): () => void
    bind(name: string): Translate
  }
  readonly slots: {
    inject(name: string, register: () => () => void): void
    register<Props>(options: {
      name: string
      key?: string
      id?: string
      order?: number
      locale?: string
      label?: () => string
      inject?: () => Omit<Props, 't'>
    }, component: (props: Props) => JSX.Element): () => void
  }
  effect(install: () => () => void, label?: string): void
}

export const inject = ['slots', 'locale', 'connection', 'workspaces', 'uiWorkspace', 'sessions', 'conversation', 'layout']

function WorkbenchIcon({ size }: { size: number }) {
  return <IconWorkspaceTreeOutlineMedium size={size} />
}

export function apply(ctx: ClientContext): void {
  const lifetime = new AbortController()
  ctx.effect(() => ctx.locale.register(namespace, { en, zh }), 'product-engineering: dictionaries')
  ctx.effect(() => {
    const style = document.createElement('style')
    style.dataset.plugin = panelId
    style.textContent = styles
    document.head.append(style)
    return () => {
      lifetime.abort()
      style.remove()
    }
  }, 'product-engineering: styles')

  const t = ctx.locale.bind(namespace)
  const navigation: { selectedId?: string } = {}
  const workspaceList = ctx.workspaces.list
  const dependencies = {
    request: createProductApi(ctx.connection.rpc),
    workspaceSource: {
      subscribe: (listener: () => void) => workspaceList.subscribe(listener),
      getSnapshot: () => workspaceList.getSnapshot(),
    },
    navigation,
    startDraft: async (workspaceId: string, prompt: string) => {
      const signal = AbortSignal.any([ctx.layout.beginNavigation(), lifetime.signal])
      const id = await ctx.sessions.create({ workspaceId })
      if (signal.aborted) return

      const reference = ctx.sessions.retain(id, { source: 'mainView' })
      try {
        const result = ctx.conversation.input.requestDraftInitialization(reference.binding, { prompt })
        if (result !== 'applied') throw new Error('DSH did not accept the skill draft')
        if (!signal.aborted) ctx.uiWorkspace.openSession(id)
      } finally {
        reference.release()
      }
    },
  }

  ctx.slots.inject('main', () => ctx.slots.register({
    name: 'main', key: panelId, locale: namespace, inject: () => dependencies,
  }, Workbench))
  ctx.slots.inject('sidebar.panellist', () => ctx.slots.register({
    name: 'sidebar.panellist', id: panelId, order: 15, locale: namespace, label: () => t('panel'),
  }, WorkbenchIcon))
}
