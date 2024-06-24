import {
    MultiCallWithGasChunk,
    MultiCallWithGasChunks,
    MultiCallExecutionResult,
    MultiCallItemWithGas,
    MultiCallItemWithGasResult,
    MultiCallWithGasParams,
    MultiCallRequestWithGas,
    MultiCallWithGasContractResponse,
    MultiCallParams,
    MultiCallRequest
} from './model/multicall.model'
import MultiCallABI from './abi/MultiCall.abi.json'
import {
    callWithRetries,
    concatExecutionResults,
    requestsToMulticallItems,
    splitRequestsByChunks,
    splitRequestsByChunksWithGas
} from './multicall.helpers'
import {defaultGasLimitParams} from './gas-limit.service'
import {ProviderConnector} from './connector'

const multicallResultTypes = [
    {
        name: 'results',
        type: 'bytes[]'
    },
    {
        name: 'lastSuccessIndex',
        type: 'uint256'
    }
]

export const defaultParamsWithGas: MultiCallWithGasParams = {
    maxChunkSize: 500,
    retriesLimit: 3,
    blockNumber: 'latest',
    gasBuffer: defaultGasLimitParams.gasBuffer
}

export const defaultParamsByChunkSize: MultiCallParams = {
    chunkSize: 100,
    retriesLimit: 3,
    blockNumber: 'latest'
}

export class MultiCallService {
    constructor(
        private connector: ProviderConnector,
        private multiCallAddress: string
    ) {}

    async callByGasLimit(
        requests: MultiCallRequestWithGas[],
        gasLimit: number,
        params: MultiCallWithGasParams = defaultParamsWithGas
    ): Promise<string[]> {
        const multiCallItems = await requestsToMulticallItems(requests)

        const results = await this.doMultiCall(
            [],
            multiCallItems,
            params,
            gasLimit
        )

        return results
            .sort((a, b) => {
                return a.index - b.index
            })
            .map((item) => item.result)
    }

    async callByChunks(
        requests: MultiCallRequest[],
        params: MultiCallParams = defaultParamsByChunkSize
    ): Promise<string[]> {
        const chunks = splitRequestsByChunks(requests, params.chunkSize)

        const contractCalls = chunks.map((chunk) => {
            return callWithRetries<string[]>(params.retriesLimit, () =>
                this.callSimpleMultiCall(chunk, params)
            )
        })

        const results = await Promise.all(contractCalls)

        return results.flat()
    }

    private async doMultiCall(
        previousResponses: MultiCallItemWithGasResult[],
        requests: MultiCallItemWithGas[],
        params: MultiCallWithGasParams,
        gasLimit: number
    ): Promise<MultiCallItemWithGasResult[]> {
        const chunks = splitRequestsByChunksWithGas(
            requests,
            gasLimit,
            params.maxChunkSize
        )

        const {responses, notExecutedChunks} = await this.executeRequests(
            chunks,
            params
        )

        const newMaxChunkSize = Math.floor(params.maxChunkSize / 2)

        const newResults = previousResponses.concat(responses)

        if (notExecutedChunks.length === 0) {
            return newResults
        }

        params.maxChunkSize = newMaxChunkSize

        if (newMaxChunkSize === 0) {
            throw new Error('multicall: exceeded chunks split')
        }

        return this.doMultiCall(newResults, notExecutedChunks, params, gasLimit)
    }

    private async executeRequests(
        chunks: MultiCallWithGasChunks,
        params: MultiCallWithGasParams
    ): Promise<MultiCallExecutionResult> {
        const chunksResults = await Promise.all(
            chunks.map((chunk) => {
                return callWithRetries<MultiCallWithGasContractResponse>(
                    params.retriesLimit,
                    () => this.callWithGasLimitationMultiCall(chunk, params)
                )
            })
        )

        const results: MultiCallExecutionResult[] = chunksResults.map(
            (result, index) => {
                const chunk = chunks[index]
                const lastSuccessIndex = +result.lastSuccessIndex + 1

                const responses = chunk.map((item, i) => {
                    return {
                        ...item,
                        result: result.results[i]
                    }
                })

                return {
                    responses: responses.slice(0, lastSuccessIndex),
                    notExecutedChunks: chunk.slice(
                        lastSuccessIndex,
                        chunk.length
                    )
                }
            }
        )

        return concatExecutionResults(results)
    }

    private async callWithGasLimitationMultiCall(
        chunk: MultiCallWithGasChunk,
        params: MultiCallWithGasParams
    ): Promise<MultiCallWithGasContractResponse> {
        const multiCallChunk = chunk.map((x) => ({to: x.to, data: x.data}))

        const response = await this.callContractMultiCall(
            'multicallWithGasLimitation',
            [multiCallChunk, params.gasBuffer],
            params.blockNumber
        )

        const {results, lastSuccessIndex} =
            this.connector.decodeABIParameterList<MultiCallWithGasContractResponse>(
                multicallResultTypes,
                response
            )

        return {results, lastSuccessIndex: lastSuccessIndex.toString()}
    }

    private async callSimpleMultiCall(
        chunk: MultiCallRequest[],
        params: MultiCallParams
    ): Promise<string[]> {
        const response = await this.callContractMultiCall(
            'multicall',
            [chunk],
            params.blockNumber
        )

        return this.connector.decodeABIParameter<string[]>('bytes[]', response)
    }

    private async callContractMultiCall(
        methodName: string,
        params: unknown[],
        blockNumber: string | number
    ): Promise<string> {
        const callData = this.connector.contractEncodeABI(
            MultiCallABI,
            this.multiCallAddress,
            methodName,
            params
        )

        return await this.connector.ethCall(
            this.multiCallAddress,
            callData,
            blockNumber.toString()
        )
    }
}
