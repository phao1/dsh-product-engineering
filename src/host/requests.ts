import type { ProductEngine } from '../core/engine.ts'
import { ProductError } from '../core/errors.ts'
import type { ProductResponse } from '../core/types.ts'
import { parseRequest } from '../core/validation.ts'

export const PRODUCT_ENDPOINT = 'product-engineering/workspace'
export const PRODUCT_PATH = `/api/${PRODUCT_ENDPOINT}`
const MAX_REQUEST_BYTES = 256 * 1024

/** Admit the native Connection principal before inspecting the request payload. */
export function ownerRequest(
  engine: ProductEngine,
  endpoint: string,
  payload: unknown,
  signal: AbortSignal,
  principalKind: string | undefined,
  reportError: (error: unknown) => void,
): ProductResponse {
  if (principalKind !== 'owner') {
    return { ok: false, error: { code: 'forbidden', message: 'This operation requires the DSH owner.' } }
  }
  if (endpoint !== PRODUCT_ENDPOINT) {
    return { ok: false, error: { code: 'not-found', message: 'Product workspace endpoint was not found.' } }
  }
  try {
    return { ok: true, data: engine.execute(parseRequest(payload), { actor: 'human' }, signal) }
  } catch (error) {
    if (error instanceof ProductError) {
      const { code, message, blockers } = error
      if (code === 'unavailable' && error.cause !== undefined) reportError(error.cause)
      return { ok: false, error: { code, message, ...(blockers === undefined ? {} : { blockers }) } }
    }
    if (!signal.aborted) reportError(error)
    return { ok: false, error: { code: 'unavailable', message: 'Product workspace could not complete the request. Reload before retrying.' } }
  }
}

/** Serve a native unary Connection envelope from an authenticated exact Fetch route. */
export async function fetchOwnerRequest(
  engine: ProductEngine,
  request: Request,
  reportError: (error: unknown) => void,
): Promise<Response> {
  const mediaType = request.headers.get('content-type')?.split(';', 1)[0]?.trim().toLowerCase()
  const supportedMedia = mediaType === 'application/json'
  if (Number(request.headers.get('content-length')) > MAX_REQUEST_BYTES) {
    return new Response(null, { status: 413 })
  }
  const reader = request.body?.getReader()
  let payload: unknown
  try {
    const chunks: Uint8Array[] = []
    let size = 0
    while (reader !== undefined) {
      const next = await reader.read()
      if (next.done) break
      size += next.value.byteLength
      // The streaming carrier can close an unread request when the body exceeds this cap.
      if (size > MAX_REQUEST_BYTES) return new Response(null, { status: 413 })
      if (supportedMedia) chunks.push(next.value)
    }
    // Draining small invalid bodies lets the carrier deliver the rejection before closing.
    if (!supportedMedia) return new Response('Expected an application/json request.', { status: 415 })
    if (reader === undefined) return new Response('Expected a JSON request body.', { status: 400 })
    payload = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks, size)))
  } catch {
    return new Response('Invalid JSON request body.', { status: 400 })
  } finally {
    reader?.releaseLock()
  }
  if (typeof payload !== 'object' || payload === null || Array.isArray(payload)
    || !('type' in payload) || payload.type !== 'client-request'
    || !('method' in payload) || payload.method !== PRODUCT_ENDPOINT
    || !('rpcId' in payload) || typeof payload.rpcId !== 'string' || payload.rpcId.length < 1 || payload.rpcId.length > 128
    || !('payload' in payload)) {
    return new Response('Invalid Connection request envelope.', { status: 400 })
  }
  // Connection exact Fetch routes admit owner Peers only, before dispatch.
  const value = ownerRequest(engine, PRODUCT_ENDPOINT, payload.payload, request.signal, 'owner', reportError)
  return Response.json({ type: 'server-response', rpcId: payload.rpcId, result: { ok: true, value } },
    { headers: { 'cache-control': 'no-store' } })
}
