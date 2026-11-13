import type {
  ProductErrorCode, ProductRequest, ProductResponse, ProductResults, ProjectSummary,
} from '../core/types.ts'
import type { Key } from './locales.ts'

export interface NativeRpc {
  call(channel: string, endpoint: string, payload: ProductRequest, signal?: AbortSignal): Promise<
    { readonly ok: true; readonly value: unknown }
    | { readonly ok: false; readonly error: { readonly code: string; readonly message: string } }
  >
}

export type ProductApi = <Request extends ProductRequest>(
  request: Request,
  signal?: AbortSignal,
) => Promise<ProductResults[Request['op']]>

const errorLabels: Record<ProductErrorCode, Key> = {
  'invalid-input': 'errorInvalid',
  'not-found': 'errorNotFound',
  conflict: 'conflict',
  blocked: 'errorGate',
  forbidden: 'errorForbidden',
  unavailable: 'errorUnavailable',
}

export class ProductClientError extends Error {
  constructor(readonly code: ProductErrorCode, message?: string) {
    super(message)
  }
}

export function errorKey(error: unknown): Key {
  return error instanceof ProductClientError ? errorLabels[error.code] : 'error'
}

export function createProductApi(rpc: NativeRpc): ProductApi {
  return async <Request extends ProductRequest>(request: Request, signal?: AbortSignal) => {
    const result = await rpc.call('/api', 'product-engineering/workspace', request, signal)
    if (!result.ok) throw new ProductClientError('unavailable')
    const value = result.value
    if (typeof value !== 'object' || value === null || !('ok' in value)) {
      throw new ProductClientError('unavailable')
    }
    // The installed Host and browser entry come from the same plugin package.
    const response = value as ProductResponse<Request['op']>
    if (response.ok === true && 'data' in response) return response.data
    if (response.ok === false && Object.hasOwn(errorLabels, response.error?.code)) {
      throw new ProductClientError(response.error.code, response.error.message)
    }
    throw new ProductClientError('unavailable')
  }
}

export function projectSummary(project: ProjectSummary): ProjectSummary {
  const { id, title, summary, workspacePath, stage, revision, createdAt, updatedAt } = project
  return { id, title, summary, workspacePath, stage, revision, createdAt, updatedAt }
}
