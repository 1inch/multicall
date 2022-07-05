import {ProviderConnector, SolStructType} from './provider.connector';
import Web3 from 'web3';
import {AbiItem} from '../model/abi.model';
import {AbiItem as Web3AbiItem} from 'web3-utils';
import Contract from 'web3-eth-contract'

export class Web3ProviderConnector implements ProviderConnector {

    constructor(protected readonly web3Provider: Web3) {
        // eslint-disable-next-line
        // @ts-ignore
        Contract.setProvider(web3Provider.currentProvider)
    }

    contractEncodeABI(
        abi: AbiItem[],
        address: string | null,
        methodName: string,
        methodParams: unknown[]
    ): string {
        // eslint-disable-next-line
        // @ts-ignore
        const contract = new Contract(
            abi as Web3AbiItem[],
            address === null ? undefined : address
        );
        return contract.methods[methodName](...methodParams).encodeABI();
    }

    ethCall(
        contractAddress: string,
        callData: string,
        blockNumber = 'latest'
    ): Promise<string> {
        return this.web3Provider.eth.call(
            {
                to: contractAddress,
                data: callData,
            },
            blockNumber
        );
    }

    decodeABIParameter<T>(type: string | SolStructType, hex: string): T {
        return this.web3Provider.eth.abi.decodeParameter(type, hex) as T;
    }

    decodeABIParameterList<T>(type: string[] | SolStructType[], hex: string): T {
        return this.web3Provider.eth.abi.decodeParameters(type, hex) as T;
    }
}
