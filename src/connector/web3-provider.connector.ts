import {ProviderConnector} from './provider.connector'

export interface IWeb3CallInfo {
    data: string
    to: string
}

export interface IWeb3 {
    eth: {
        call(callInfo: IWeb3CallInfo, blockNumber: number | string): Promise<string>
    }
}

export class Web3ProviderConnector implements ProviderConnector {
    constructor(protected readonly web3Provider: IWeb3) {}

    ethCall(contractAddress: string, callData: string, blockNumber = 'latest'): Promise<string> {
        return this.web3Provider.eth.call(
            {
                to: contractAddress,
                data: callData
            },
            blockNumber
        )
    }
}
