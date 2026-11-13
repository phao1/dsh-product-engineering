import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'

const root = fileURLToPath(new URL('../', import.meta.url))
const { name } = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'))

await build({
  absWorkingDir: root,
  entryPoints: ['src/client/index.tsx'],
  outfile: 'dist/client.js',
  bundle: true,
  format: 'cjs',
  platform: 'browser',
  target: 'chrome120',
  jsx: 'automatic',
  external: ['react', '@deepseek-ai/dsh-client-ui-primitives'],
  loader: { '.css': 'text' },
  banner: {
    js: `window.__ModuleLoader__.load({ id: ${JSON.stringify(name)}, factory(require) { const module = { exports: {} };`,
  },
  footer: { js: 'return module.exports; } });' },
})
