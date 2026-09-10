import {anything, instance, mock, verify, when} from 'ts-mockito'
import {GasLimitService, defaultGasLimitParams} from './gas-limit.service'
import {ProviderConnector} from './connector'
import {CHAIN_1_MULTICALL_ADDRESS, DEFAULT_GAS_LIMIT, selectors} from './multicall.const'

describe('GasLimitService', () => {
    const multiCallAddress = CHAIN_1_MULTICALL_ADDRESS
    let connector: ProviderConnector
    let service: GasLimitService

    beforeEach(() => {
        connector = mock<ProviderConnector>()
        service = new GasLimitService(instance(connector), multiCallAddress)
    })

    it('subtracts the gas buffer from an explicit gas limit', async () => {
        const gasLimit = await service.calculateGasLimit({
            gasLimit: 12_000_000,
            gasBuffer: 1_000_000
        })

        expect(gasLimit).toBe(11_000_000)
        verify(connector.ethCall(anything(), anything(), anything())).never()
    })

    it('caps an explicit gas limit at maxGasLimit before subtracting the buffer', async () => {
        const gasLimit = await service.calculateGasLimit({
            gasLimit: 200_000_000,
            maxGasLimit: 50_000_000,
            gasBuffer: 5_000_000
        })

        expect(gasLimit).toBe(45_000_000)
    })

    it('fetches the chain gas limit when none is provided', async () => {
        when(connector.ethCall(multiCallAddress, selectors.gaslimit)).thenResolve('0x1312d00')

        const gasLimit = await service.calculateGasLimit({
            gasBuffer: 1_000_000
        })

        expect(gasLimit).toBe(parseInt('0x1312d00', 16) - 1_000_000)
    })

    it('falls back to DEFAULT_GAS_LIMIT when the gaslimit call fails', async () => {
        const log = jest.spyOn(console, 'log').mockImplementation(() => undefined)
        when(connector.ethCall(multiCallAddress, selectors.gaslimit)).thenReject(undefined as unknown as Error)

        const gasLimit = await service.calculateGasLimit({})

        expect(gasLimit).toBe(DEFAULT_GAS_LIMIT - defaultGasLimitParams.gasBuffer)
        expect(log).toHaveBeenCalled()
        log.mockRestore()
    })

    it('uses the default gasBuffer and maxGasLimit when they are omitted', async () => {
        const gasLimit = await service.calculateGasLimit({
            gasLimit: defaultGasLimitParams.maxGasLimit + 10
        })

        expect(gasLimit).toBe(defaultGasLimitParams.maxGasLimit - defaultGasLimitParams.gasBuffer)
    })

    it('treats a zero gasBuffer as missing and uses the default', async () => {
        const gasLimit = await service.calculateGasLimit({
            gasLimit: 10_000_000,
            gasBuffer: 0
        })

        expect(gasLimit).toBe(10_000_000 - defaultGasLimitParams.gasBuffer)
    })
})
