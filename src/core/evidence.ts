import { createHash } from 'node:crypto'
import { closeSync, constants, fstatSync, lstatSync, openSync, readSync, realpathSync, statSync } from 'node:fs'
import { isAbsolute, relative, resolve, sep, win32 } from 'node:path'
import { ProductError } from './errors.ts'
import { LIMITS, type Evidence, type EvidenceView } from './types.ts'
import { artifactContent, invalid, pathText } from './validation.ts'

export function fullyQualifiedPath(path: string): boolean {
  if (!isAbsolute(path)) return false
  const root = win32.parse(path).root
  return process.platform !== 'win32' || (root !== '\\' && root !== '/')
}

/** Resolve an existing workspace directory to the path used for model scope. */
export function canonicalWorkspace(value: unknown): string {
  const path = pathText(value, 'Workspace folder', LIMITS.workspacePath)
  if (!fullyQualifiedPath(path)) invalid('Workspace folder must be a fully qualified absolute path.')
  try {
    const canonical = realpathSync.native(path)
    if (statSync(canonical).isDirectory()) return pathText(canonical, 'Workspace folder', LIMITS.workspacePath)
  } catch {
    // A missing or unreadable path is not an admissible workspace.
  }
  return invalid('Workspace folder must be an existing readable directory.')
}

/** A mutable filesystem alias cannot grant a session a different workspace. */
export function sessionWorkspace(path: string | undefined): string {
  if (path !== undefined) {
    try {
      if (canonicalWorkspace(path) === path) return path
    } catch (error) {
      if (!(error instanceof ProductError)) throw error
    }
  }
  throw new ProductError('forbidden', 'Open a session in the registered workspace folder to access its project records.')
}

/** Normalize a workspace-relative file reference without granting absolute path access. */
export function workspaceFile(value: string | undefined): string {
  if (value === undefined || isAbsolute(value) || win32.isAbsolute(value) || value.includes('\\') || value.includes(':')) {
    return invalid('File evidence requires a workspace-relative path using forward slashes.')
  }
  const parts = pathText(value, 'File path', LIMITS.uri).split('/')
  if (parts.some(part => part === '' || part === '..' || part === '.')) {
    return invalid('File evidence path cannot contain empty, current, or parent directory components.')
  }
  return parts.join('/')
}

/** Preserve links as references without contacting their destinations. */
export function evidenceUrl(value: string | undefined): string {
  if (value !== undefined) {
    try {
      const url = new URL(value)
      if (['http:', 'https:'].includes(url.protocol) && url.hostname && !url.username && !url.password
        && url.href.length <= LIMITS.uri) return url.href
    } catch {
      // Invalid URL syntax is reported by the shared validation error below.
    }
  }
  return invalid('URL evidence requires an HTTP or HTTPS URL without credentials.')
}

/** Read a bounded, unchanged regular file under the canonical workspace. */
function readWorkspaceFile(workspacePath: string, uri: string): Buffer {
  const path = resolve(workspacePath, ...workspaceFile(uri).split('/'))
  const within = relative(workspacePath, path)
  if (within === '' || within === '..' || within.startsWith(`..${sep}`) || isAbsolute(within)) {
    return invalid('File evidence must be inside the project workspace.')
  }
  try {
    // A moved or replaced workspace, or any symlink in the path, changes the snapshot's identity.
    if (realpathSync(path) !== path) throw new Error('noncanonical file')
    const fd = openSync(path, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0) | (constants.O_NONBLOCK ?? 0))
    try {
      const before = fstatSync(fd, { bigint: true })
      const entry = lstatSync(path, { bigint: true })
      if (!before.isFile() || !entry.isFile() || before.dev !== entry.dev || before.ino !== entry.ino
        || realpathSync(path) !== path || before.size > BigInt(LIMITS.evidenceFileBytes)) {
        throw new Error('unusable file')
      }
      const size = Number(before.size)
      const buffer = Buffer.allocUnsafe(size + 1)
      let bytes = 0
      while (bytes <= size) {
        const count = readSync(fd, buffer, bytes, buffer.length - bytes, null)
        if (count === 0) break
        bytes += count
      }
      const after = fstatSync(fd, { bigint: true })
      const finalEntry = lstatSync(path, { bigint: true })
      if (bytes !== size || before.mtimeNs !== after.mtimeNs || before.ctimeNs !== after.ctimeNs
        || before.dev !== finalEntry.dev || before.ino !== finalEntry.ino || realpathSync(path) !== path) {
        throw new Error('file changed while being read')
      }
      return buffer.subarray(0, bytes)
    } finally {
      closeSync(fd)
    }
  } catch {
    throw new ProductError('invalid-input', 'File evidence requires a readable, unchanged regular file up to 2 MiB in the workspace, with no symlinks.')
  }
}

function sha256(bytes: Buffer): string {
  return createHash('sha256').update(bytes).digest('hex')
}

export function captureFile(workspacePath: string, uri: string): string {
  return sha256(readWorkspaceFile(workspacePath, uri))
}

export function captureTextFile(workspacePath: string, uri: string): { content: string; digest: string } {
  const bytes = readWorkspaceFile(workspacePath, uri)
  let content: string
  try {
    content = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes)
  } catch {
    return invalid('Artifact file must contain valid UTF-8 text.')
  }
  return { content: artifactContent(content), digest: sha256(bytes) }
}

/** Compare all snapshots for each path with the same current file digest. */
export function evidenceViews(workspacePath: string, evidence: readonly Evidence[]): EvidenceView[] {
  const digests = new Map<string, string | undefined>()
  return evidence.map(item => {
    if (item.verification === 'reported') return { ...item, freshness: 'reported' }
    if (item.uri === undefined || item.digest === undefined) return { ...item, freshness: 'stale' }
    if (!digests.has(item.uri)) {
      let digest: string | undefined
      try {
        digest = captureFile(workspacePath, item.uri)
      } catch (error) {
        if (!(error instanceof ProductError) || error.code !== 'invalid-input') throw error
      }
      digests.set(item.uri, digest)
    }
    return { ...item, freshness: digests.get(item.uri) === item.digest ? 'current' : 'stale' }
  })
}
