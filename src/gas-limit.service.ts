import {GasLimitParams} from './model/multicall.model'
import MultiCallABI from './abi/MultiCall.abi.json'
import {DEFAULT_GAS_LIMIT} from './multicall.const'
import {ProviderConnector} from './connector'

export const defaultGasLimitParams: Pick<
    GasLimitParams,
    'gasBuffer' | 'maxGasLimit'
> = {
    gasBuffer: 3000000,
    maxGasLimit: 150000000
}

export class GasLimitService {
    constructor(
        private connector: ProviderConnector,
        private multiCallAddress: string
    ) {}

    async calculateGasLimit(
        gasLimitParams: Partial<GasLimitParams> = defaultGasLimitParams
    ): Promise<number> {
        const gasBuffer =
            gasLimitParams.gasBuffer || defaultGasLimitParams.gasBuffer

        const gasLimit = await (gasLimitParams.gasLimit
            ? Promise.resolve(gasLimitParams.gasLimit)
            : this.fetchGasLimit())

        const maxGasLimit =
            gasLimitParams.maxGasLimit || defaultGasLimitParams.maxGasLimit

        const minGasLimit = Math.min(gasLimit, maxGasLimit)

        return minGasLimit - gasBuffer
    }

    private async fetchGasLimit(): Promise<number> {
        try {
            const callData = this.connector.contractEncodeABI(
                MultiCallABI,
                this.multiCallAddress,
                'gasLeft',
                []
            )
            const res = await this.connector.ethCall(
                this.multiCallAddress,
                callData
            )

            return +this.connector
                .decodeABIParameter<string>('uint256', res)
                .toString()
        } catch (e) {
            // eslint-disable-next-line no-console
            console.log('cannot get gas left: ', e?.toString())

            return DEFAULT_GAS_LIMIT
        }
    }
}
