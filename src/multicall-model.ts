export interface MultiCallRequest {
    to: string;
    data: string;
    gas: number;
}

export interface MultiCallItem extends MultiCallRequest {
    index: number;
}

export interface MultiCallItemWithResponse extends MultiCallItem {
    result: string;
}

export type MultiCallChunk = MultiCallItem[];

export type MultiCallChunks = MultiCallChunk[];

export interface MultiCallContractResponse {
    results: string[];
    lastSuccessIndex: string;
}

export interface MultiCallExecutionResult {
    responses: MultiCallItemWithResponse[];
    notExecutedChunks: MultiCallItem[];
}

export interface MultiCallParams {
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
