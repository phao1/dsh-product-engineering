import type { Context } from '@deepseek-ai/cordis'
import { defineTool, type ToolRunContext } from '@deepseek-ai/dsh-tools'
import { sessionWorkspace } from '../core/evidence.ts'
import type { ProductEngine } from '../core/engine.ts'
import type { ProductRequest } from '../core/types.ts'
import { parseRequest } from '../core/validation.ts'

const PROJECT_ID = { type: 'string', required: true, description: 'Project UUID returned by product_list or product_create.' } as const
const OUTPUT = {
  schema: { type: 'json' },
  render: (_args: unknown, value: unknown) => [{ type: 'text' as const, text: JSON.stringify(value, null, 2) }],
} as const

function run(engine: ProductEngine, request: unknown, exec: ToolRunContext) {
  // Changing the working directory does not change the Session's workspace access.
  const workspacePath = sessionWorkspace(exec.agent?.session.header.cwd)
  const parsed = parseRequest(request)
  const value = engine.execute(parsed, { actor: 'agent', workspacePath }, exec.signal)
  // The public document uses optional fields. Canonical tool results require lossless JSON.
  return JSON.parse(JSON.stringify(value))
}

/** Register product tools on DSH's native tool registry. */
export function registerProductTools(ctx: Context, engine: ProductEngine): void {
  const execute = (request: ProductRequest['op'], exec: ToolRunContext, args: Record<string, unknown> = {}) =>
    run(engine, { ...args, op: request }, exec)

  ctx.tools.register(defineTool({
    name: 'product_list',
    description: 'List Product Engineering projects in the workspace that owns this session. Use this to find project IDs and revisions.',
    parameters: {},
    output: OUTPUT,
    async execute(args, exec) {
      return execute('list', exec, args)
    },
  }))

  ctx.tools.register(defineTool({
    name: 'product_get',
    description: 'Read the latest project, stage, next action, release blockers, artifacts, decisions, and evidence in this session workspace.',
    parameters: { projectId: PROJECT_ID },
    output: OUTPUT,
    async execute(args, exec) {
      return execute('get', exec, args)
    },
  }))

  ctx.tools.register(defineTool({
    name: 'product_create',
    description: 'Start a Product Engineering project in this session workspace, when requested by the user.',
    parameters: {
      title: { type: 'string', required: true, description: 'A concise project title.' },
      summary: { type: 'string', description: 'The initial problem or objective.' },
    },
    output: OUTPUT,
    async execute(args, exec) {
      return execute('create', exec, args)
    },
  }))

  ctx.tools.register(defineTool({
    name: 'product_record',
    description: 'Record one project draft, source, or proposed decision. Obtain the latest revision with product_get. '
      + 'Humans resolve decisions, attest to checks, and move stages in the workbench.',
    parameters: {
      projectId: PROJECT_ID,
      expectedRevision: { type: 'integer', required: true, description: 'The current project revision. Reload after conflicts.' },
      command: {
        type: 'object', required: true, additionalProperties: true,
        properties: { kind: { type: 'string', required: true } },
        description: 'Use {kind:"artifact.save",id?,type,title,content,skillId?,evidenceIds?} or '
          + '{kind:"artifact.importFile",id?,type,title,path,skillId?,evidenceIds?} to record a workspace-relative UTF-8 file '
          + 'as an artifact with a file snapshot. Artifact type is brief, research, prd, design, architecture, plan, review, experiment, '
          + 'launch, or note. Other commands: {kind:"evidence.add",evidenceKind,title,uri?,summary} '
          + '(evidenceKind is url, file, command, or note; file paths are workspace-relative and command evidence is a reported '
          + 'observation); {kind:"decision.add",title,context,options,evidenceIds?}; or {kind:"project.update",title?,summary?}.',
      },
    },
    output: OUTPUT,
    async execute(args, exec) {
      return execute('mutate', exec, args)
    },
  }))

  ctx.tools.register(defineTool({
    name: 'product_export',
    description: 'Prepare an export with the current project, checks, and release blockers. The result contains the filename and export content.',
    parameters: { projectId: PROJECT_ID, format: { type: 'string', required: true, enum: ['json', 'markdown'] } },
    output: OUTPUT,
    async execute(args, exec) {
      return execute('export', exec, args)
    },
  }))
}
