import {
    MultiCallWithGasChunks,
    MultiCallExecutionResult,
    MultiCallItemWithGas,
    MultiCallRequestWithGas,
    MultiCallRequest,
    MultiCallChunks
} from './model/multicall.model'

export function requestsToMulticallItems(requests: MultiCallRequestWithGas[]): MultiCallItemWithGas[] {
    return requests.map((request, index) => {
        return {
            ...request,
            index
        }
    })
}

export function splitRequestsByChunksWithGas(
    requests: MultiCallItemWithGas[],
    gasLimit: number,
    maxChunkSize: number
): MultiCallWithGasChunks {
    let currentChunkIndex = 0
    let gasUsedByCurrentChunk = 0

    return requests.reduce((chunks, val) => {
        if (!chunks[currentChunkIndex]) {
            chunks[currentChunkIndex] = []
        }

        const currentChunk = chunks[currentChunkIndex]

        const notFitIntoCurrentChunkGasLimit = gasUsedByCurrentChunk + val.gas >= gasLimit
        const isChunkSizeExceeded = currentChunk.length === maxChunkSize
        const shouldSwitchToNextChunk = notFitIntoCurrentChunkGasLimit || isChunkSizeExceeded

        if (shouldSwitchToNextChunk) {
            if (chunks[currentChunkIndex].length === 0) {
                throw new Error('one of the first calls in a chunk not fit into gas limit')
            }

            currentChunkIndex++
            gasUsedByCurrentChunk = 0
        } else {
            gasUsedByCurrentChunk += val.gas
        }

        currentChunk.push(val)

        return chunks
    }, [] as MultiCallWithGasChunks)
}

export function splitRequestsByChunks(requests: MultiCallRequest[], chunkSize: number): MultiCallChunks {
    let currentChunkIndex = 0

    return requests.reduce((chunks, request) => {
        if (currentChunkIndex === chunkSize) {
            currentChunkIndex++
        }

        if (!chunks[currentChunkIndex]) {
            chunks[currentChunkIndex] = []
        }

        chunks[currentChunkIndex].push(request)

        return chunks
    }, [] as MultiCallChunks)
}

export function concatExecutionResults(results: MultiCallExecutionResult[]): MultiCallExecutionResult {
    return results.reduce(
        (acc, val) => {
            return {
                responses: acc.responses.concat(val.responses),
                notExecutedChunks: acc.notExecutedChunks.concat(val.notExecutedChunks)
            }
        },
        {
            responses: [],
            notExecutedChunks: []
        }
    )
}

export async function callWithRetries<T>(retriesLimit: number, fn: () => Promise<T>): Promise<T> {
    let retriesLeft = retriesLimit

    while (retriesLeft > 0) {
        try {
            return await fn()
        } catch (error) {
            // eslint-disable-next-line no-console
            console.warn(`multicall chunck failed: ${error?.toString()}`)
            retriesLeft -= 1
        }
    }

    throw new Error('multicall: retries exceeded')
}
