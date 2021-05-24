import {
    MultiCallChunk,
    MultiCallChunks, MultiCallExecutionResult,
    MultiCallItem,
    MultiCallItemWithResponse,
    MultiCallParams,
    MultiCallRequest, MultiCallContractResponse
} from './multicall-model';
import MultiCallABI from './abi/MultiCall.abi.json';
import { concatExecutionResults, requestsToMulticallItems, splitRequestsByChunks } from './multicall.helpers';
import { ProviderConnector } from '../dist';
import { defaultGasLimitParams } from './gas-limit.service';

const multicallResultTypes = [{
    name: 'results',
    type: 'bytes[]'
}, {
    name: 'lastSuccessIndex',
    type: 'uint256'
}];

const defaultParams: MultiCallParams = {
    maxChunkSize: 500,
    retriesLimit: 3,
    blockNumber: 'latest',
    gasBuffer: defaultGasLimitParams.gasBuffer
};

export class MultiCallService {
    constructor(
        private connector: ProviderConnector,
        private multiCallAddress: string,
        private params: MultiCallParams = defaultParams
    ) {
    }

    async callByGasLimit(
        requests: MultiCallRequest[],
        gasLimit: number
    ): Promise<string[]> {
        const multiCallItems = await requestsToMulticallItems(requests);

        const results = await this.doMultiCall(
            [],
            multiCallItems,
            gasLimit
        );

        return results
            .sort((a, b) => {
                return a.index - b.index;
            })
            .map(item => item.result);
    }

    private async doMultiCall(
        previousResponses: MultiCallItemWithResponse[],
        requests: MultiCallItem[],
        gasLimit: number
    ): Promise<MultiCallItemWithResponse[]> {
        const chunks = splitRequestsByChunks(requests, gasLimit, this.params.maxChunkSize);

        const { responses, notExecutedChunks } = await this.executeRequests(chunks);

        const newMaxChunkSize = Math.floor(this.params.maxChunkSize / 2);

        const newResults = previousResponses.concat(responses);

        if (notExecutedChunks.length === 0) {
            return newResults;
        }

        if (newMaxChunkSize === 0) {
            throw new Error('multicall: exceeded chunks split');
        }

        return this.doMultiCall(
            newResults,
            notExecutedChunks,
            gasLimit
        );
    }

    private async executeRequests(
        chunks: MultiCallChunks
    ): Promise<MultiCallExecutionResult> {
        const chunksResults = await Promise.all(
            chunks.map(chunk => this.callContractWithRetries(chunk))
        );

        const results: MultiCallExecutionResult[] = chunksResults.map((result, index) => {
            const chunk = chunks[index];

            const responses = chunk.map((item, i) => {
                return {
                    ...item,
                    result: result.results[i]
                }
            });

            return {
                responses,
                notExecutedChunks: chunk.slice(+result.lastSuccessIndex + 1, chunk.length)
            }
        });

        return concatExecutionResults(results);
    }

    private async callContractWithRetries(
        chunk: MultiCallChunk,
    ): Promise<MultiCallContractResponse> {
        let retriesLeft = this.params.retriesLimit;

        while (retriesLeft > 0) {
            try {
                return await this.callContract(chunk);
            } catch (error) {
                retriesLeft -= 1;
            }
        }

        throw new Error('multicall: retries exceeded');
    }

    private async callContract(
        chunk: MultiCallChunk
    ): Promise<MultiCallContractResponse> {
        const connector = this.connector;

        const callData = connector.contractEncodeABI(
            MultiCallABI,
            this.multiCallAddress,
            'multicallWithGasLimitation',
            // TODO: why we send gasBuffer to contract?
            [chunk.map((x) => ({ to: x.to, data: x.data })), this.params.gasBuffer]
        );
        const response = await connector.ethCall(
            this.multiCallAddress,
            callData,
            this.params.blockNumber.toString()
        );

        const {
            results,
            lastSuccessIndex
        } = connector.decodeABIParameterList<MultiCallContractResponse>(multicallResultTypes, response);

        return { results, lastSuccessIndex: lastSuccessIndex.toString() };
    }
}
