export type MultiCallData = {
    to: string;
    data: string;
};

export type MultiCallDataWithGasLimit = {
    to: string;
    data: string;
    gas: number;
};

export type MultiCallWithGasLimitationResult = {
    results: string[];
    lastSuccessIndex: string;
};

export const DEFAULT_MULTICALL_PARAMS: MultiCallWithGasLimitationParams = {
    gasBuffer: 3000000,
    maxChunkSize: 500,
    retryCount: 3,
    blockNumber: 'latest',
    maxGasLimit: 150000000,
};

export type MultiCallWithGasLimitationParams = {
    maxChunkSize: number; // max contract calls per one node call
    retryCount: number; // max retries on network fail
    gasBuffer?: number; // safe amount of gas before node call gas limit
    blockNumber?: string;
    maxGasLimit?: number; // max gas limit per one multiCall (to avoid 5s node timeout)
    gasLimit?: number | undefined; // gas limit for the multiCall (default: max node view call gas limit)
};

export const buildMultiCallParams = (
    params: Partial<MultiCallWithGasLimitationParams>
): MultiCallWithGasLimitationParams => {
    return {
        blockNumber: params?.blockNumber || DEFAULT_MULTICALL_PARAMS.blockNumber,
        gasBuffer: params?.gasBuffer || DEFAULT_MULTICALL_PARAMS.gasBuffer,
        maxChunkSize: params?.maxChunkSize || DEFAULT_MULTICALL_PARAMS.maxChunkSize,
        maxGasLimit: params?.maxGasLimit || DEFAULT_MULTICALL_PARAMS.maxGasLimit,
        retryCount: params?.retryCount || DEFAULT_MULTICALL_PARAMS.retryCount,
        gasLimit: params?.gasLimit
    };
}