import MultiCallABI from './abi/MultiCall.abi.json';
import {ProviderConnector} from './connector/provider.connector';
import {BigNumber} from '@ethersproject/bignumber';
import {DEFAULT_GAS_LIMIT} from './multicall.const';
import {
    buildMultiCallParams,
    MultiCallData,
    MultiCallDataWithGasLimit, MultiCallWithGasLimitationParams,
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
    ) {
    }

    async multiCallWithGasLimitation(
        requests: MultiCallDataWithGasLimit[],
        params: Partial<MultiCallWithGasLimitationParams>
    ): Promise<string[]> {

        const {chunks, results} =
            await this.multiCallWithGasLimitationExtended<MultiCallDataWithGasLimit>(
                requests,
                params
            );

        const res = await this.processNotExecutedCallsIfNeeded(
            chunks,
            results,
            params
        );

        return res.reduce(
            (acc, val) => acc.concat(val.results),
            [] as string[]
        );
    }

    async multiCallWithGasLimitationExtended<ChunkType extends MultiCallDataWithGasLimit,
        >(
        requests: ChunkType[],
        params: Partial<MultiCallWithGasLimitationParams>
    ): Promise<{
        results: MultiCallWithGasLimitationResult[];
        chunks: ChunkType[][];
    }> {

        const {
            gasBuffer,
            gasLimit,
            maxGasLimit,
            maxChunkSize,
            retryCount,
            blockNumber
        } = buildMultiCallParams(params);

        const optimalGasLimit = await this.getGasLimit(gasLimit, maxGasLimit);

        const promises: Promise<MultiCallWithGasLimitationResult>[] = [];
        const chunks = chunkArrayTakingIntoGas<ChunkType>(
            requests,
            optimalGasLimit,
            gasBuffer,
            maxChunkSize
        );

        for (let i = 0; i < chunks.length; i++) {
            promises.push(
                this.singleGasLimitationCallWithRetry(
                    chunks[i],
                    gasBuffer,
                    retryCount,
                    blockNumber,
                )
            );
        }

        const results = await Promise.all(promises);
        return {results, chunks};
    }

    async callWithBatchRetry(
        requests: MultiCallData[],
        chunk = 100,
        retryCount = 3,
        blockNumber = 'latest'
    ): Promise<string[]> {
        const promises = [];
        const chunks = chunkArray(requests, chunk);

        for (let i = 0; i < chunks.length; i++) {
            promises.push(this.singleCallWithRetry(chunks[i], retryCount, blockNumber));
        }

        const results = await Promise.all(promises);
        return results.flat();
    }

    async call(requests: MultiCallData[], chunk = 100, blockNumber = 'latest'): Promise<string[]> {
        const promises = [];
        const chunks = chunkArray(requests, chunk);

        for (let i = 0; i < chunks.length; i++) {
            promises.push(this.singleCall(chunks[i], blockNumber));
        }

        const results = await Promise.all(promises);
        return results.flat();
    }

    async fetchOnChainCallGasLimit(): Promise<number> {
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

    private async getGasLimit(gasLimit: number | undefined, maxGasLimit: number | undefined): Promise<number> {
        if (!gasLimit) {
            gasLimit = await this.fetchOnChainCallGasLimit();
        }

        if (maxGasLimit && gasLimit > maxGasLimit) {
            gasLimit = maxGasLimit;
        }
        return gasLimit;
    }

    private async processNotExecutedCallsIfNeeded(
        processedChunks: MultiCallDataWithGasLimit[][],
        processedResults: MultiCallWithGasLimitationResult[],
        params: Partial<MultiCallWithGasLimitationParams>
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

        // @ts-ignore
        const decreasedMaxChunkSize = Math.floor(params.maxChunkSize / 2);
        if (decreasedMaxChunkSize === 0) {
            throw new Error('multicall: exceeded chunks split');
        }

        const {chunks, results} =
            await this.multiCallWithGasLimitationExtended<NotExecutedCall>(
                notExecutedCalls,
                params,
            );

        const res = await this.processNotExecutedCallsIfNeeded(
            chunks,
            results,
            params
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
        retries: number,
        blockNumber: string
    ): Promise<string[]> {
        while (retries > 0) {
            const result = await this.singleCall(chunk, blockNumber).catch((e) => {
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
        gasBuffer: number | undefined,
        retries: number,
        blockNumber: string | undefined
    ): Promise<MultiCallWithGasLimitationResult> {
        while (retries > 0) {
            const result = await this.singleCallWithGasLimitation(
                chunk,
                String(gasBuffer || 0),
                blockNumber || 'latest'
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

    private async singleCall(chunk: MultiCallData[], blockNumber: string): Promise<string[]> {
        const callData = this.providerConnector.contractEncodeABI(
            MultiCallABI,
            this.multiCallAddress,
            'multicall',
            [chunk]
        );
        const res = await this.providerConnector.ethCall(
            this.multiCallAddress,
            callData,
            blockNumber
        );
        return this.providerConnector.decodeABIParameter<string[]>(
            'string[]',
            res
        );
    }

    private async singleCallWithGasLimitation<T extends MultiCallData>(
        chunk: T[],
        gasBuffer: string,
        blockNumber: string
    ): Promise<MultiCallWithGasLimitationResult> {
        const callData = this.providerConnector.contractEncodeABI(
            MultiCallABI,
            this.multiCallAddress,
            'multicallWithGasLimitation',
            [chunk.map((x) => ({to: x.to, data: x.data})), gasBuffer]
        );
        const res = await this.providerConnector.ethCall(
            this.multiCallAddress,
            callData,
            blockNumber
        );

        const types = [{
            name: 'results',
            type: 'bytes[]'
        }, {
            name: 'lastSuccessIndex',
            type: 'uint256'
        }];

        const {results, lastSuccessIndex} =
            this.providerConnector.decodeABIParameterList<MultiCallWithGasLimitationResult>(types, res);
        return {results, lastSuccessIndex: lastSuccessIndex.toString()};
    }
}

function chunkArrayTakingIntoGas<T extends MultiCallDataWithGasLimit>(
    array: T[],
    gasLimit: number,
    gasBuffer: number | undefined,
    maxSize: number
): T[][] {
    const maxGasLimitPerCall = gasLimit - (gasBuffer || 0);
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

function chunkArray<T extends MultiCallData>(
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
