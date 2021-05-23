import MultiCallABI from './abi/MultiCall.abi.json';
import {ProviderConnector} from './connector/provider.connector';
import {BigNumber} from '@ethersproject/bignumber';
import {DEFAULT_GAS_LIMIT} from './multicall.const';
import {
    MultiCallData,
    MultiCallDataWithGasLimit,
    MultiCallWithGasLimitationResult,
} from './model/multicall.model';

type ChunkCallPosition = {
    chunkNum: number;
    index: number;
};

type NotExecutedCall = ChunkCallPosition & MultiCallDataWithGasLimit;

export class MultiCall {
    constructor(
        public readonly providerConnector: ProviderConnector,
        public readonly multiCallAddress: string
    ) {}

    async multiCallWithGasLimitation(
        requests: MultiCallDataWithGasLimit[],
        gasBuffer = 3000000,
        maxChunkSize = 500,
        retryCount = 3,
        gasLimit?: number | undefined
    ): Promise<string[]> {
        const {chunks, results} =
            await this.multiCallWithGasLimitationExtended<MultiCallDataWithGasLimit>(
                requests,
                gasBuffer,
                maxChunkSize,
                retryCount,
                gasLimit
            );

        const res = await this.processNotExecutedCallsIfNeeded(
            chunks,
            results,
            gasBuffer,
            maxChunkSize,
            retryCount,
            gasLimit
        );

        return res.reduce(
            (acc, val) => acc.concat(val.results),
            [] as string[]
        );
    }

    async multiCallWithGasLimitationExtended<
        ChunkType extends MultiCallDataWithGasLimit
    >(
        requests: ChunkType[],
        gasBuffer = 3000000,
        maxChunkSize = 500,
        retryCount = 3,
        maxGasLimit = 150000000,
        gasLimit?: number | undefined
    ): Promise<{
        results: MultiCallWithGasLimitationResult[];
        chunks: ChunkType[][];
    }> {
        if (!gasLimit) {
            gasLimit = await this.getOnChainCallGasLimit();
        }

        if (gasLimit > maxGasLimit) {
            gasLimit = maxGasLimit;
        }

        const promises: Promise<MultiCallWithGasLimitationResult>[] = [];
        const chunks = chunkArrayTakingIntoGas<ChunkType>(
            requests,
            gasLimit,
            gasBuffer,
            maxChunkSize
        );

        for (let i = 0; i < chunks.length; i++) {
            promises.push(
                this.singleGasLimitationCallWithRetry(
                    chunks[i],
                    gasBuffer,
                    retryCount
                )
            );
        }

        const results = await Promise.all(promises);
        return {results, chunks};
    }

    async callWithBatchRetry(
        requests: MultiCallData[],
        chunk = 100,
        retryCount = 3
    ): Promise<string[]> {
        const promises = [];
        const chunks = chunkArray(requests, chunk);

        for (let i = 0; i < chunks.length; i++) {
            promises.push(this.singleCallWithRetry(chunks[i], retryCount));
        }

        const results = await Promise.all(promises);
        return results.flat();
    }

    async call(requests: MultiCallData[], chunk = 100): Promise<string[]> {
        const promises = [];
        const chunks = chunkArray(requests, chunk);

        for (let i = 0; i < chunks.length; i++) {
            promises.push(this.singleCall(chunks[i]));
        }

        const results = await Promise.all(promises);
        return results.flat();
    }

    async getOnChainCallGasLimit(): Promise<number> {
        try {
            const callData = this.providerConnector.contractEncodeABI(
                MultiCallABI,
                this.multiCallAddress,
                'gasLeft',
                []
            );
            const res = await this.providerConnector.ethCall(
                this.multiCallAddress,
                callData
            );
            return +this.providerConnector
                .decodeABIParameter<BigNumber>('uint256', res)
                .toString();
        } catch (e) {
            console.log('cannot get gas left: ', e.toString());
            return DEFAULT_GAS_LIMIT;
        }
    }

    private async processNotExecutedCallsIfNeeded(
        processedChunks: MultiCallDataWithGasLimit[][],
        processedResults: MultiCallWithGasLimitationResult[],
        gasBuffer: number,
        maxChunkSize: number,
        retryCount: number,
        gasLimit: number | undefined
    ): Promise<MultiCallWithGasLimitationResult[]> {
        const notExecutedCalls: NotExecutedCall[] = [];
        for (let i = 0; i < processedResults.length; i++) {
            const firstUnprocessedCallIndex =
                +processedResults[i].lastSuccessIndex + 1;
            if (firstUnprocessedCallIndex === processedChunks[i].length) {
                continue;
            }
            for (
                let j = firstUnprocessedCallIndex;
                j < processedResults[i].results.length;
                j++
            ) {
                notExecutedCalls.push({
                    to: processedChunks[i][j].to,
                    data: processedChunks[i][j].data,
                    gas: processedChunks[i][j].gas,
                    chunkNum: i,
                    index: j,
                });
            }
        }

        if (notExecutedCalls.length === 0) {
            return processedResults;
        }

        const decreasedMaxChunkSize = Math.floor(maxChunkSize / 2);
        if (decreasedMaxChunkSize === 0) {
            throw new Error('multicall: exceeded chunks split');
        }

        const {chunks, results} =
            await this.multiCallWithGasLimitationExtended<NotExecutedCall>(
                notExecutedCalls,
                gasBuffer,
                decreasedMaxChunkSize,
                retryCount,
                gasLimit
            );

        const res = await this.processNotExecutedCallsIfNeeded(
            chunks,
            results,
            gasBuffer,
            decreasedMaxChunkSize,
            retryCount,
            gasLimit
        );

        for (let i = 0; i < chunks.length; i++) {
            for (let j = 0; j < chunks[i].length; j++) {
                const chunk = chunks[i][j];
                const tmp = [...processedResults[chunk.chunkNum].results];
                tmp[chunk.index] = res[i].results[j];
                processedResults[chunk.chunkNum].results = tmp;
            }
        }

        return processedResults;
    }

    private async singleCallWithRetry(
        chunk: MultiCallData[],
        retries: number
    ): Promise<string[]> {
        while (retries > 0) {
            const result = await this.singleCall(chunk).catch((e) => {
                console.log(
                    `Retry multicall. Remaing: ${retries}. Error: ${e.toString()}`
                );
                return null;
            });

            if (result) {
                return result;
            }

            retries -= 1;
        }

        throw new Error('multicall: retries exceeded');
    }

    private async singleGasLimitationCallWithRetry(
        chunk: MultiCallData[],
        gasBuffer: number,
        retries: number
    ): Promise<MultiCallWithGasLimitationResult> {
        while (retries > 0) {
            const result = await this.singleCallWithGasLimitation(
                chunk,
                String(gasBuffer)
            ).catch((e) => {
                console.log(
                    `Retry multicall. Remaing: ${retries}. Error: ${e.toString()}`
                );
                return null;
            });

            if (result) {
                return result;
            }

            retries -= 1;
        }

        throw new Error('multicall: retries exceeded');
    }

    private async singleCall(chunk: MultiCallData[]): Promise<string[]> {
        const callData = this.providerConnector.contractEncodeABI(
            MultiCallABI,
            this.multiCallAddress,
            'multicall',
            [chunk]
        );
        const res = await this.providerConnector.ethCall(
            this.multiCallAddress,
            callData
        );
        return this.providerConnector.decodeABIParameter<string[]>(
            'string[]',
            res
        );
    }

    private async singleCallWithGasLimitation<T extends MultiCallData>(
        chunk: T[],
        gasBuffer: string
    ): Promise<MultiCallWithGasLimitationResult> {
        const callData = this.providerConnector.contractEncodeABI(
            MultiCallABI,
            this.multiCallAddress,
            'multicallWithGasLimitation',
            [chunk, gasBuffer]
        );
        const res = await this.providerConnector.ethCall(
            this.multiCallAddress,
            callData
        );
        const [results, lastSuccessIndex] =
            this.providerConnector.decodeABIParameterList<
                [string[], BigNumber]
            >(['string[]', 'uint256'], res);
        return {results, lastSuccessIndex: lastSuccessIndex.toString()};
    }
}

export function chunkArrayTakingIntoGas<T extends MultiCallDataWithGasLimit>(
    array: T[],
    gasLimit: number,
    gasBuffer: number,
    maxSize: number
): T[][] {
    const maxGasLimitPerCall = gasLimit - gasBuffer;
    const result: T[][] = [[]];
    let indexToFill = 0;
    let gasUsed = 0;
    for (const [i, x] of array.entries()) {
        if (
            gasUsed + x.gas >= maxGasLimitPerCall ||
            result[indexToFill].length === maxSize
        ) {
            result.push([]);
            indexToFill += 1;
            gasUsed = 0;
        }

        gasUsed += array[i].gas;
        result[indexToFill].push(array[i]);
    }
    return result;
}

export function chunkArray<T extends MultiCallData>(
    array: T[],
    size: number
): T[][] {
    const result = [];
    const arrayCopy = [...array];
    while (arrayCopy.length > 0) {
        result.push(arrayCopy.splice(0, size));
    }
    return result;
}
