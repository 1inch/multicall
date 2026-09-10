import {Web3ProviderConnector} from './web3-provider.connector'

describe('Web3ProviderConnector', () => {
    it('forwards ethCall to web3 with the latest block by default', async () => {
        const call = jest.fn().mockResolvedValue('0x01')
        const connector = new Web3ProviderConnector({eth: {call}})

        await expect(connector.ethCall('0xabc', '0xdead')).resolves.toBe('0x01')
        expect(call).toHaveBeenCalledWith({to: '0xabc', data: '0xdead'}, 'latest')
    })

    it('forwards an explicit block number', async () => {
        const call = jest.fn().mockResolvedValue('0x02')
        const connector = new Web3ProviderConnector({eth: {call}})

        await expect(connector.ethCall('0xabc', '0xbeef', '0x10')).resolves.toBe('0x02')
        expect(call).toHaveBeenCalledWith({to: '0xabc', data: '0xbeef'}, '0x10')
    })
})
