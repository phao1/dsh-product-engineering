import { closeSync, lstatSync, mkdirSync, openSync } from 'node:fs'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { ProductError } from './errors.ts'
import { fullyQualifiedPath } from './evidence.ts'
import { decodeProject } from './stored-project.ts'
import { LIMITS, STAGES, type Project, type ProjectSummary } from './types.ts'
import { integer, member, object, pathText, string, uuid } from './validation.ts'

const SCHEMA_VERSION = 1
const APPLICATION_ID = 0x44534850

function missing(error: unknown): boolean {
  return error instanceof Error && 'code' in error && error.code === 'ENOENT'
}

function initializeFile(directory: string): string {
  if (!fullyQualifiedPath(directory)) throw new ProductError('invalid-input', 'Data directory must be an absolute path.')
  mkdirSync(directory, { recursive: true, mode: 0o700 })
  if (!lstatSync(directory).isDirectory()) throw new Error('Data directory must be a real directory.')
  const file = join(directory, 'workspace.sqlite3')
  try {
    if (!lstatSync(file).isFile()) throw new Error('Project database must be a regular file.')
  } catch (error) {
    if (!missing(error)) throw error
    try {
      closeSync(openSync(file, 'wx', 0o600))
    } catch (createError) {
      // Another process can initialize the file between inspection and creation.
      if (!(createError instanceof Error && 'code' in createError && createError.code === 'EEXIST'
        && lstatSync(file).isFile())) throw createError
    }
  }
  return file
}

function encode(project: Project): string {
  const result = JSON.stringify(project)
  if (Buffer.byteLength(result) > LIMITS.projectBytes) {
    throw new ProductError('invalid-input', 'Project storage limit reached. Export the project before starting a new one.')
  }
  return result
}

export function summarize(project: Project): ProjectSummary {
  const { id, title, summary, workspacePath, stage, revision, createdAt, updatedAt } = project
  return { id, title, summary, workspacePath, stage, revision, createdAt, updatedAt }
}

function decodeSummary(raw: unknown): ProjectSummary {
  if (typeof raw !== 'string') throw new Error('Project summary must be JSON.')
  const { id, title, summary, workspacePath, stage, revision, createdAt, updatedAt } = object(JSON.parse(raw), 'Summary')
  return {
    id: uuid(id, 'Project ID'), title: string(title, 'Title', LIMITS.title),
    summary: string(summary, 'Summary', LIMITS.summary, true),
    workspacePath: pathText(workspacePath, 'Workspace folder', LIMITS.workspacePath),
    stage: member(stage, 'Stage', STAGES), revision: integer(revision, 'Revision'),
    createdAt: string(createdAt, 'Created at', 40), updatedAt: string(updatedAt, 'Updated at', 40),
  }
}

/** Profile-local store. Each write takes SQLite's process-wide writer lock before reading. */
export class ProjectStore {
  private readonly db: DatabaseSync

  constructor(dataDirectory: string) {
    this.db = new DatabaseSync(initializeFile(dataDirectory))
    try {
      this.db.exec('PRAGMA busy_timeout = 1000; PRAGMA synchronous = FULL')
      this.transaction(() => {
        const version = this.db.prepare('PRAGMA user_version').get()?.user_version
        const app = this.db.prepare('PRAGMA application_id').get()?.application_id
        if (version === SCHEMA_VERSION && app === APPLICATION_ID) return
        const tables = this.db.prepare('SELECT name FROM sqlite_schema LIMIT 1').get()
        if (version !== 0 || app !== 0 || tables !== undefined) {
          throw new ProductError('unavailable', 'Project database uses an unsupported format.')
        }
        this.db.exec(`
          CREATE TABLE projects (
            id TEXT PRIMARY KEY,
            workspace_path TEXT NOT NULL,
            revision INTEGER NOT NULL CHECK (revision > 0),
            updated_at TEXT NOT NULL,
            summary TEXT NOT NULL CHECK (json_valid(summary)),
            document TEXT NOT NULL CHECK (json_valid(document))
          ) STRICT;
          CREATE INDEX projects_workspace_order ON projects (workspace_path, updated_at DESC, id);
          CREATE INDEX projects_updated_order ON projects (updated_at DESC, id);
          PRAGMA application_id = ${APPLICATION_ID};
          PRAGMA user_version = ${SCHEMA_VERSION};
        `)
      })
    } catch (error) {
      this.db.close()
      throw error
    }
  }

  private transaction<T>(operation: () => T): T {
    this.db.exec('BEGIN IMMEDIATE')
    try {
      const result = operation()
      this.db.exec('COMMIT')
      return result
    } catch (error) {
      try {
        this.db.exec('ROLLBACK')
      } catch {
        // SQLite may already have rolled back after a storage fault.
      }
      throw error
    }
  }

  list(workspacePath?: string): ProjectSummary[] {
    const rows = workspacePath === undefined
      ? this.db.prepare('SELECT summary FROM projects ORDER BY updated_at DESC, id').all()
      : this.db.prepare('SELECT summary FROM projects WHERE workspace_path = ? ORDER BY updated_at DESC, id').all(workspacePath)
    try {
      return rows.map(row => decodeSummary(row.summary))
    } catch (error) {
      throw new ProductError('unavailable', 'Stored project index could not be read.', undefined, { cause: error })
    }
  }

  get(id: string, workspacePath?: string): Project {
    uuid(id, 'Project ID')
    const row = workspacePath === undefined
      ? this.db.prepare('SELECT workspace_path, revision, document FROM projects WHERE id = ?').get(id)
      : this.db.prepare('SELECT workspace_path, revision, document FROM projects WHERE id = ? AND workspace_path = ?').get(id, workspacePath)
    if (row === undefined) throw new ProductError('not-found', 'Project was not found in this workspace.')
    if (typeof row.workspace_path !== 'string' || typeof row.revision !== 'number') {
      throw new ProductError('unavailable', 'Stored project identity could not be read.')
    }
    return decodeProject(row.document, id, row.workspace_path, row.revision)
  }

  create(project: Project): void {
    this.db.prepare(`INSERT INTO projects (id, workspace_path, revision, updated_at, summary, document)
      VALUES (?, ?, ?, ?, ?, ?)`)
      .run(project.id, project.workspacePath, project.revision, project.updatedAt, JSON.stringify(summarize(project)), encode(project))
  }

  mutate(id: string, revision: number, workspacePath: string | undefined, apply: (project: Project) => void): Project {
    return this.transaction(() => {
      const project = this.get(id, workspacePath)
      if (project.revision !== revision) {
        throw new ProductError('conflict', 'Project changed. Reload the latest revision and retry.')
      }
      apply(project)
      this.db.prepare(`UPDATE projects SET revision = ?, updated_at = ?, summary = ?, document = ? WHERE id = ?`)
        .run(project.revision, project.updatedAt, JSON.stringify(summarize(project)), encode(project), project.id)
      return project
    })
  }

  close(): void {
    this.db.close()
  }
}
