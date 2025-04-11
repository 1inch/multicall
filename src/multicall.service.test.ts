import {anything, capture, instance, mock, when, verify} from 'ts-mockito'
import {Interface} from 'ethers'
import {ProviderConnector} from './connector'
import {defaultParamsWithGas, MultiCallService} from './multicall.service'
import {MultiCallRequest, MultiCallRequestWithGas} from './model'

import ABI from './abi/MultiCall.abi.json'
import {CHAIN_1_MULTICALL_ADDRESS} from './multicall.const'

const iface = new Interface(ABI)
describe('MultiCallService', () => {
    const multiCallAddress = CHAIN_1_MULTICALL_ADDRESS

    let multiCallService: MultiCallService
    let connector: ProviderConnector

    beforeEach(() => {
        connector = mock<ProviderConnector>()
        multiCallService = new MultiCallService(instance(connector), multiCallAddress)
    })

    describe('callByGasLimit() full successful multicall', () => {
        it('test', async () => {
            const gasLimit = 410
            const requests: MultiCallRequestWithGas[] = [
                {to: '0x0000000000000000000000000000000000000001', data: '0x01', gas: 100},
                {to: '0x0000000000000000000000000000000000000002', data: '0x02', gas: 100},
                {to: '0x0000000000000000000000000000000000000003', data: '0x03', gas: 100},
                {to: '0x0000000000000000000000000000000000000004', data: '0x04', gas: 100},
                {to: '0x0000000000000000000000000000000000000005', data: '0x05', gas: 100},
                {to: '0x0000000000000000000000000000000000000006', data: '0x06', gas: 100},
                {to: '0x0000000000000000000000000000000000000007', data: '0x07', gas: 100},
                {to: '0x0000000000000000000000000000000000000008', data: '0x08', gas: 100},
                {to: '0x0000000000000000000000000000000000000009', data: '0x09', gas: 100},
                {to: '0x0000000000000000000000000000000000000010', data: '0x10', gas: 100}
            ]

            const maxChunkSize = 3
            when(connector.ethCall(anything(), anything(), anything())).thenCall((_to: unknown, callData: string) => {
                const {calls} = iface.decodeFunctionData('multicallWithGasLimitation', callData)

                return iface.encodeFunctionResult('multicallWithGasLimitation', [
                    requests.filter((r) => calls.find((c: MultiCallRequest) => r.to === c.to)).map((r) => r.to),
                    requests.length
                ])
            })

            const result = await multiCallService.callByGasLimit(requests, gasLimit, {
                ...defaultParamsWithGas,
                maxChunkSize
            })

            const ethCalls = capture(connector.ethCall)

            expect(result).toEqual(requests.map((r) => r.to))
            verify(connector.ethCall(CHAIN_1_MULTICALL_ADDRESS, anything(), anything())).times(3)
            expect(ethCalls.first()).toMatchSnapshot()
            expect(ethCalls.second()).toMatchSnapshot()
            expect(ethCalls.third()).toMatchSnapshot()
        })
    })

    describe('callByGasLimit() multicall with errors', () => {
        function getLastSuccessIndex(requests: MultiCallRequest[]): number {
            // lastSuccessIndex = 1, it means that only 01, 02 responses were successful
            if (requests.map((i) => i.data).join('') === '0x010x020x03') {
                return 1
            }

            // lastSuccessIndex = 1, it means that only 04, 05 responses were successful
            if (requests.map((i) => i.data).join('') === '0x040x050x06') {
                return 1
            }

            // lastSuccessIndex = 0, it means that only 7 responses were successful
            if (requests.map((i) => i.data).join('') === '0x070x080x09') {
                return 0
            }

            return requests.length - 1
        }

        it('test', async () => {
            const gasLimit = 300
            const requests: MultiCallRequestWithGas[] = [
                {to: '0x0000000000000000000000000000000000000001', data: '0x01', gas: 100},
                {to: '0x0000000000000000000000000000000000000002', data: '0x02', gas: 100},
                {to: '0x0000000000000000000000000000000000000003', data: '0x03', gas: 100},
                {to: '0x0000000000000000000000000000000000000004', data: '0x04', gas: 100},
                {to: '0x0000000000000000000000000000000000000005', data: '0x05', gas: 100},
                {to: '0x0000000000000000000000000000000000000006', data: '0x06', gas: 100},
                {to: '0x0000000000000000000000000000000000000007', data: '0x07', gas: 100},
                {to: '0x0000000000000000000000000000000000000008', data: '0x08', gas: 100},
                {to: '0x0000000000000000000000000000000000000009', data: '0x09', gas: 100},
                {to: '0x0000000000000000000000000000000000000010', data: '0x10', gas: 100}
            ]
            const expectedRequestsByChunks = [
                [
                    {to: '0x0000000000000000000000000000000000000001', data: '0x01'},
                    {to: '0x0000000000000000000000000000000000000002', data: '0x02'},
                    {to: '0x0000000000000000000000000000000000000003', data: '0x03'}
                ],
                [
                    {to: '0x0000000000000000000000000000000000000004', data: '0x04'},
                    {to: '0x0000000000000000000000000000000000000005', data: '0x05'},
                    {to: '0x0000000000000000000000000000000000000006', data: '0x06'}
                ],
                [
                    {to: '0x0000000000000000000000000000000000000007', data: '0x07'},
                    {to: '0x0000000000000000000000000000000000000008', data: '0x08'},
                    {to: '0x0000000000000000000000000000000000000009', data: '0x09'}
                ],
                [{to: '0x0000000000000000000000000000000000000010', data: '0x10'}],
                [
                    {to: '0x0000000000000000000000000000000000000003', data: '0x03'},
                    {to: '0x0000000000000000000000000000000000000006', data: '0x06'}
                ],
                [
                    {to: '0x0000000000000000000000000000000000000008', data: '0x08'},
                    {to: '0x0000000000000000000000000000000000000009', data: '0x09'}
                ]
            ]

            const maxChunkSize = 3
            when(connector.ethCall(anything(), anything(), anything())).thenCall((_to: unknown, callData: string) => {
                const {calls} = iface.decodeFunctionData('multicallWithGasLimitation', callData)

                return iface.encodeFunctionResult('multicallWithGasLimitation', [
                    requests.filter((r) => calls.find((c: MultiCallRequest) => r.to === c.to)).map((r) => r.to),
                    getLastSuccessIndex(calls)
                ])
            })

            const result = await multiCallService.callByGasLimit(requests, gasLimit, {
                ...defaultParamsWithGas,
                maxChunkSize
            })

            const decodeInput = (i: number): MultiCallRequest[] => {
                const [res] = iface.decodeFunctionData('multicallWithGasLimitation', ethCalls.byCallIndex(i)[1])

                return res.map(([to, data]: [string, string]) => ({to, data}))
            }

            const ethCalls = capture(connector.ethCall)

            expect(result).toEqual(requests.map((r) => r.to))
            verify(connector.ethCall(CHAIN_1_MULTICALL_ADDRESS, anything(), anything())).times(6)
            expect(decodeInput(0)).toEqual(expectedRequestsByChunks[0])
            expect(decodeInput(1)).toEqual(expectedRequestsByChunks[1])
            expect(decodeInput(2)).toEqual(expectedRequestsByChunks[2])
            expect(decodeInput(3)).toEqual(expectedRequestsByChunks[3])
            expect(decodeInput(4)).toEqual(expectedRequestsByChunks[4])
            expect(decodeInput(5)).toEqual(expectedRequestsByChunks[5])
        })
    })
})
