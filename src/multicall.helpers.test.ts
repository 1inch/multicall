import {
    callWithRetries,
    concatExecutionResults,
    requestsToMulticallItems,
    splitRequestsByChunks,
    splitRequestsByChunksWithGas
} from './multicall.helpers'
import {MultiCallRequest, MultiCallRequestWithGas} from './model'

describe('multicall.helpers', () => {
    const requests: MultiCallRequest[] = [
        {to: '0x0000000000000000000000000000000000000001', data: '0x01'},
        {to: '0x0000000000000000000000000000000000000002', data: '0x02'},
        {to: '0x0000000000000000000000000000000000000003', data: '0x03'},
        {to: '0x0000000000000000000000000000000000000004', data: '0x04'}
    ]

    describe('requestsToMulticallItems', () => {
        it('attaches the request index to each item', () => {
            const withGas: MultiCallRequestWithGas[] = requests.map((request) => ({...request, gas: 10}))

            expect(requestsToMulticallItems(withGas)).toEqual([
                {...withGas[0], index: 0},
                {...withGas[1], index: 1},
                {...withGas[2], index: 2},
                {...withGas[3], index: 3}
            ])
        })
    })

    describe('splitRequestsByChunks', () => {
        it('places every request into a single chunk while the index stays below chunkSize', () => {
            const chunks = splitRequestsByChunks(requests, 100)

            expect(chunks).toHaveLength(1)
            expect(chunks[0]).toEqual(requests)
        })

        it('starts at chunk index 1 when chunkSize is 0', () => {
            const chunks = splitRequestsByChunks(requests, 0)

            expect(chunks[0]).toBeUndefined()
            expect(chunks[1]).toEqual(requests)
        })
    })

    describe('splitRequestsByChunksWithGas', () => {
        it('keeps calls in one chunk when gas and size both fit', () => {
            const items = requestsToMulticallItems(requests.map((request) => ({...request, gas: 50})))

            const chunks = splitRequestsByChunksWithGas(items, 1000, 10)

            expect(chunks).toHaveLength(1)
            expect(chunks[0]).toEqual(items)
        })

        it('throws when the first call does not fit the gas limit', () => {
            const items = requestsToMulticallItems([{...requests[0], gas: 200}])

            expect(() => splitRequestsByChunksWithGas(items, 100, 10)).toThrow(
                'one of the first calls in a chunk not fit into gas limit'
            )
        })

        it('opens a new chunk after maxChunkSize and still appends the overflow call to the previous chunk', () => {
            const items = requestsToMulticallItems(requests.map((request) => ({...request, gas: 10})))

            const chunks = splitRequestsByChunksWithGas(items, 1000, 2)

            expect(chunks[0]).toHaveLength(3)
            expect(chunks[1]).toEqual([items[3]])
        })
    })

    describe('concatExecutionResults', () => {
        it('concatenates responses and leftover chunks in order', () => {
            const first = {
                responses: [{...requests[0], gas: 1, index: 0, result: '0xaa'}],
                notExecutedChunks: [{...requests[1], gas: 1, index: 1}]
            }
            const second = {
                responses: [{...requests[2], gas: 1, index: 2, result: '0xbb'}],
                notExecutedChunks: [{...requests[3], gas: 1, index: 3}]
            }

            expect(concatExecutionResults([first, second])).toEqual({
                responses: [first.responses[0], second.responses[0]],
                notExecutedChunks: [first.notExecutedChunks[0], second.notExecutedChunks[0]]
            })
        })
    })

    describe('callWithRetries', () => {
        it('returns the first successful attempt', async () => {
            const fn = jest.fn().mockRejectedValueOnce(new Error('transient')).mockResolvedValueOnce('ok')

            await expect(callWithRetries(3, fn)).resolves.toBe('ok')
            expect(fn).toHaveBeenCalledTimes(2)
        })

        it('throws when every attempt fails', async () => {
            const cause = new Error('rpc down')
            const fn = jest.fn().mockRejectedValue(cause)

            await expect(callWithRetries(2, fn)).rejects.toMatchObject({
                message: 'multicall: retries exceeded',
                cause
            })
            expect(fn).toHaveBeenCalledTimes(2)
        })
    })
})
