export interface ProviderConnector {
    ethCall(contractAddress: string, callData: string, blockNumber?: string): Promise<string>
}
