export interface MultiCallRequest {
    to: string;
    data: string;
}

export interface MultiCallRequestWithGas extends MultiCallRequest {
    gas: number;
}

export interface MultiCallItemWithGas extends MultiCallRequestWithGas {
    index: number;
}

export interface MultiCallItemWithGasResult extends MultiCallItemWithGas {
    result: string;
}

export type MultiCallChunk = MultiCallRequest[];

export type MultiCallChunks = MultiCallChunk[];

export type MultiCallWithGasChunk = MultiCallItemWithGas[];

export type MultiCallWithGasChunks = MultiCallWithGasChunk[];

export interface MultiCallWithGasContractResponse {
    results: string[];
    lastSuccessIndex: string;
}

export interface MultiCallExecutionResult {
    responses: MultiCallItemWithGasResult[];
    notExecutedChunks: MultiCallItemWithGas[];
}

export interface MultiCallParams {
    chunkSize: number;
    retriesLimit: number;
    blockNumber: string | number;
}

export interface MultiCallWithGasParams {
    maxChunkSize: number;
    retriesLimit: number;
    blockNumber: string | number;
    gasBuffer: number;
}

export interface GasLimitParams {
    gasBuffer: number;
    gasLimit: number;
    maxGasLimit: number;
}
