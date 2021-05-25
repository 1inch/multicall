import { MultiCallChunks, MultiCallExecutionResult, MultiCallItem, MultiCallRequest } from './multicall-model';

export function requestsToMulticallItems(requests: MultiCallRequest[]): MultiCallItem[] {
    return requests.map((request, index) => {
        return {
            ...request,
            index
        }
    });
}

export function splitRequestsByChunks(
    requests: MultiCallRequest[],
    gasLimit: number,
    maxChunkSize: number
): MultiCallChunks {
    let currentChunkIndex = 0;
    let gasUsedByCurrentChunk = 0;

    return requests.reduce((chunks, val, index) => {
        if (!chunks[currentChunkIndex]) {
            chunks[currentChunkIndex] = [];
        }

        const currentChunk = chunks[currentChunkIndex];

        const notFitIntoCurrentChunkGasLimit = gasUsedByCurrentChunk + val.gas >= gasLimit;
        const isChunkSizeExceeded = currentChunk.length === maxChunkSize;

        const shouldSwitchToNextChunk = notFitIntoCurrentChunkGasLimit || isChunkSizeExceeded;
        if (shouldSwitchToNextChunk) {
            if (chunks[currentChunkIndex].length === 0) {
                throw new Error('one of the first calls in a chunk not fit into gas limit');
            }
            currentChunkIndex++;
            gasUsedByCurrentChunk = 0;
        }

        currentChunk.push({
            ...val,
            index
        });

        gasUsedByCurrentChunk += val.gas;

        return chunks;

    }, [] as MultiCallChunks);
}

export function concatExecutionResults(results: MultiCallExecutionResult[]): MultiCallExecutionResult {
    return results.reduce((acc, val) => {
        return {
            responses: acc.responses.concat(val.responses),
            notExecutedChunks: acc.notExecutedChunks.concat(val.notExecutedChunks),
        };
    }, {
        responses: [],
        notExecutedChunks: []
    });
}
