import { isAbsolute, join } from 'node:path'
import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-app-boot'
import type {} from '@deepseek-ai/dsh-client-connection'
import type {} from '@deepseek-ai/dsh-workspace'
import z from '@deepseek-ai/schemastery'
import rawCatalog from '../../upstream/catalog.json' with { type: 'json' }
import { ProductEngine } from '../core/engine.ts'
import { STAGES, type SkillCatalog } from '../core/types.ts'
import { member } from '../core/validation.ts'
import { fetchOwnerRequest, PRODUCT_PATH } from './requests.ts'
import { registerProductTools } from './tools.ts'

export const name = 'product-engineering'
export const inject = ['tools']

export interface Config {
  dataDirectory?: string
  defaultWorkspaceDirectory?: string
}

export const Config: z<Config> = z.object({
  dataDirectory: z.string(),
  defaultWorkspaceDirectory: z.string(),
})

const catalog: SkillCatalog = {
  ...rawCatalog, schemaVersion: 1,
  skills: rawCatalog.skills.map(skill => ({ ...skill, stage: member(skill.stage, 'Catalog stage', STAGES) })),
}

/** Wire the profile-local Product Engineering service, tools, and owner RPC. */
export function apply(ctx: Context, config: Config = {}): void {
  const profileDirectory = ctx.get('profileContext')?.dir
  const dataDirectory = config.dataDirectory ?? (profileDirectory === undefined ? undefined : join(profileDirectory, name))
  if (dataDirectory === undefined || !isAbsolute(dataDirectory)) {
    throw new Error(`${name}: dataDirectory must be absolute when no DSH profile directory is available`)
  }
  const engine = new ProductEngine({
    dataDirectory,
    defaultWorkspaceDirectory: config.defaultWorkspaceDirectory,
    loadCatalog: () => structuredClone(catalog),
    allowOwnerWorkspace(path) {
      const registry = ctx.get('workspaceRegistry')
      return registry?.list().some(workspace => workspace.path === path) === true
    },
  })
  ctx.effect(() => () => engine.close(), 'product-engineering: close project database')
  registerProductTools(ctx, engine)

  ctx.inject(['connection'], connectionCtx => {
    connectionCtx.connection.fetch.register({
      path: PRODUCT_PATH,
      methods: ['POST'],
      requestBody: 'streaming',
      fetch: request => fetchOwnerRequest(engine, request, error => {
        connectionCtx.logger.warn('Product workspace request failed', error)
      }),
    })
  })
}
