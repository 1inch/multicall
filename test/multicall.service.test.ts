import {CHAIN_1_MULTICALL_ADDRESS, Web3ProviderConnector} from '../src';
import Web3 from 'web3';
import ERC20ABI from './ERC20.abi.json';
import {BigNumber} from '@ethersproject/bignumber';
import {ProviderConnector} from '../dist';
import { GasLimitService } from '../src/gas-limit.service';
import { MultiCallService } from '../src/multicall.service';
import { CALL_BY_GAS_LIMIT_SNAPSHOT } from './call-by-gas-limit.snapshot';
import { CALL_BY_CHUNKS_SNAPSHOT } from './call-by-chunks.snapshot';

const expectedBalances = [
    '0',
    '31730000',
    '110000000',
    '208333330993600000000000000',
    '981142252358335672999197543',
    '110000000',
    '666193700000',
    '362005984341861619925',
    '984820985004527106895',
    '2000000000000000000000000',
    '9790020000000000',
    '57000000000000000000000000'
];

describe('MultiCallService', () => {
    let web3: Web3;
    let provider: ProviderConnector;
    let gasLimitService: GasLimitService;
    let multiCallService: MultiCallService;

    const user = '0x1111111111111111111111111111111111111111';
    const multiCallAddress = CHAIN_1_MULTICALL_ADDRESS;

    const tokens = [
        '0x6b175474e89094c44da98b954eedeac495271d0f',
        '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
        '0xdac17f958d2ee523a2206206994597c13d831ec7',
        '0xb62132e35a6c13ee1ee0f84dc5d40bad8d815206',
        '0x1b793e49237758dbd8b752afc9eb4b329d5da016',
        '0xdac17f958d2ee523a2206206994597c13d831ec7',
        '0xa4fb385820a9eef842a419e08f8540fd7d1bf6e8',
        '0x77fba179c79de5b7653f68b5039af940ada60ce0',
        '0xbb0a009ba1eb20c5062c790432f080f6597662af',
        '0xdD0020B1D5Ba47A54E2EB16800D73Beb6546f91A',
        '0xf14922001a2fb8541a433905437ae954419c2439',
        '0x264dc2dedcdcbb897561a57cba5085ca416fb7b4'
    ];

    beforeEach(() => {
        web3 = new Web3(new Web3.providers.HttpProvider(''));
        provider = new Web3ProviderConnector(web3);

        gasLimitService = new GasLimitService(provider, multiCallAddress);
        multiCallService = new MultiCallService(provider, multiCallAddress);
    });

    describe('callByGasLimit()', () => {
        it('Should load balances for the address', async () => {
            jest.spyOn(provider, 'ethCall').mockImplementation(() => {
                return Promise.resolve(CALL_BY_GAS_LIMIT_SNAPSHOT);
            });

            const callData = tokens.map((address) => ({
                to: address,
                data: provider.contractEncodeABI(ERC20ABI, address, 'balanceOf', [user]),
                gas: 30000
            }));

            const gasLimit = await gasLimitService.calculateGasLimit({
                gasLimit: 12_000_000
            });

            const res = await multiCallService.callByGasLimit(
                callData,
                gasLimit
            );

            const balances = res.map((x) => {
                return provider.decodeABIParameter<BigNumber>('uint256', x).toString()
            });

            expect(balances).toEqual(expectedBalances);
        });
    });

    describe('callByChunks()', () => {
        it('Should load balances for the address', async () => {
            jest.spyOn(provider, 'ethCall').mockImplementation(() => {
                return Promise.resolve(CALL_BY_CHUNKS_SNAPSHOT);
            });

            const callData = tokens.map((address) => ({
                to: address,
                data: provider.contractEncodeABI(ERC20ABI, address, 'balanceOf', [user])
            }));

            const res = await multiCallService.callByChunks(
                callData
            );

            const balances = res.map((x) => {
                return provider.decodeABIParameter<BigNumber>('uint256', x).toString()
            });

            expect(balances).toEqual(expectedBalances);
        });
    });
});
