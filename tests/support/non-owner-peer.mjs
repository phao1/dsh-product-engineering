export const name = 'product-engineering-non-owner-acceptance'
export const inject = ['connection']

export function apply(ctx) {
  const connection = ctx.connection
  connection.fetch.register({
    path: '/api/product-engineering-acceptance/non-owner',
    methods: ['GET'],
    requestBody: 'buffered',
    async fetch() {
      const peer = connection.createPeer({ principal: { kind: 'acceptance-test-guest' } })
      try {
        const endpoint = 'product-engineering/workspace'
        const response = await connection.createSharedFetchHandler('/api').fetch(
          new Request(`http://dsh-acceptance.invalid/api/${endpoint}`, {
            method: 'POST', headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ type: 'client-request', rpcId: 'test-guest-list', method: endpoint, payload: { op: 'list' } }),
          }), peer,
        )
        return Response.json({ status: response.status })
      } finally {
        await peer.dispose()
      }
    },
  })
}
