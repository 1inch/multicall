import {AbiItem} from '../model/abi.model';

export interface ProviderConnector {
    contractEncodeABI(
        abi: AbiItem[],
        address: string | null,
        methodName: string,
        methodParams: unknown[]
    ): string;

    ethCall(
        contractAddress: string,
        callData: string,
        blockNumber?: string
    ): Promise<string>;

    decodeABIParameter<T>(type: string, hex: string): T;

    decodeABIParameterList<T>(type: string[], hex: string): T;
}
