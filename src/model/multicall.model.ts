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
