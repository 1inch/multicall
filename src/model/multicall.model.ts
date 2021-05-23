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
    maxChunkSize: number;
    retryCount: number;
    gasBuffer?: number;
    blockNumber?: string;
    maxGasLimit?: number;
    gasLimit?: number | undefined;
};

export const buildMultiCallParams = (
    params: Partial<MultiCallWithGasLimitationParams>
): MultiCallWithGasLimitationParams => {
    return {
        blockNumber: params?.blockNumber || DEFAULT_MULTICALL_PARAMS.blockNumber,
        gasBuffer: params?.gasBuffer || DEFAULT_MULTICALL_PARAMS.gasBuffer,
        maxChunkSize: params?.maxChunkSize || DEFAULT_MULTICALL_PARAMS.maxChunkSize,
        maxGasLimit: params?.maxGasLimit || DEFAULT_MULTICALL_PARAMS.maxGasLimit,
        retryCount: params?.retryCount || DEFAULT_MULTICALL_PARAMS.retryCount
    };
}
