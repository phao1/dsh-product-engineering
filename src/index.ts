/** DSH-native product delivery workspace and adapted Product Engineering skills. */
import type { Context } from '@deepseek-ai/cordis'
import { apply as applyHost } from './host/index.ts'
import { registerSkills } from './skills-provider.ts'

export { Config, inject, name } from './host/index.ts'

/** Attach the profile's workspace and skills with Cordis-owned disposal. */
export function apply(ctx: Context, config: Parameters<typeof applyHost>[1]): void {
  applyHost(ctx, config)
  ctx.inject(['skills'], (skillContext) => registerSkills(skillContext))
}
