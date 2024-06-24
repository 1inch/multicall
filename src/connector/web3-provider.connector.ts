import {AbiCoder, Interface, ParamType} from 'ethers'
import {ProviderConnector, SolStructType} from './provider.connector'
import {AbiItem} from '../model'

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
    private readonly coder = AbiCoder.defaultAbiCoder()

    constructor(protected readonly web3Provider: IWeb3) {}

    contractEncodeABI(abi: AbiItem[], _address: string | null, methodName: string, methodParams: unknown[]): string {
        return new Interface(abi).encodeFunctionData(methodName, methodParams)
    }

    ethCall(contractAddress: string, callData: string, blockNumber = 'latest'): Promise<string> {
        return this.web3Provider.eth.call(
            {
                to: contractAddress,
                data: callData
            },
            blockNumber
        )
    }

    decodeABIParameter<T>(type: string | SolStructType, hex: string): T {
        return this.decodeABIParameterList<[T]>([type], hex)[0]
    }

    decodeABIParameterList<T>(type: (string | SolStructType)[], hex: string): T {
        const types = type.map((t) => {
            return typeof t === 'string'
                ? t
                : ParamType.from(
                      t as {
                          readonly name?: string
                          readonly type?: string
                      }
                  )
        })

        return this.coder.decode(types, hex) as unknown as T
    }
}
