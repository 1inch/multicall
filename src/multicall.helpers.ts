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

        currentChunk.push({
            ...val,
            index
        });

        const shouldSwitchToNextChunk = gasUsedByCurrentChunk >= gasLimit
            || currentChunk.length === maxChunkSize;

        if (shouldSwitchToNextChunk) {
            currentChunkIndex++;
            gasUsedByCurrentChunk = 0;
        }

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
