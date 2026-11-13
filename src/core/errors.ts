import type { ProductErrorCode, ReleaseBlocker } from './types.ts'

/** Expected product-workspace failure that can safely be reported to a caller. */
export class ProductError extends Error {
  readonly code: ProductErrorCode
  readonly blockers?: ReleaseBlocker[]

  constructor(code: ProductErrorCode, message: string, blockers?: ReleaseBlocker[], options?: ErrorOptions) {
    super(message, options)
    this.name = 'ProductError'
    this.code = code
    this.blockers = blockers
  }
}
