import {CHAIN_1_MULTICALL_ADDRESS, Web3ProviderConnector} from "../src";
import Web3 from "web3";
import ERC20ABI from './ERC20.abi.json';
import {BigNumber} from "@ethersproject/bignumber";
import {ProviderConnector} from "../dist";
import { GasLimitService } from "../src/gas-limit.service";
import { MultiCallService } from "../src/multicall.service";

const rpcUrl = process.env.NODE_URL as string;
if (!rpcUrl) {
    throw new Error('please, set NODE_URL env');
}

describe('MultiCall', () => {
    let web3: Web3;
    let provider: ProviderConnector;
    let gasLimitService: GasLimitService;
    let multiCallService: MultiCallService;

    const user = '0x1111111111111111111111111111111111111111';
    const multiCallAddress = CHAIN_1_MULTICALL_ADDRESS;

    const tokens = [
        '0x6b175474e89094c44da98b954eedeac495271d0f',
        '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
        '0xdac17f958d2ee523a2206206994597c13d831ec7'
    ];


    beforeEach(() => {
        web3 = new Web3(new Web3.providers.HttpProvider(rpcUrl));
        provider = new Web3ProviderConnector(web3);

        gasLimitService = new GasLimitService(provider, multiCallAddress);
        multiCallService = new MultiCallService(provider, multiCallAddress);
    });

    it('Should get user balances', async () => {
        const callData = tokens.map((address) => ({
            to: address,
            data: provider.contractEncodeABI(ERC20ABI, address, 'balanceOf', [user]),
            gas: 30000
        }));

        const gasLimit = await gasLimitService.calculateGasLimit();

        const res = await multiCallService.callByGasLimit(
            callData,
            gasLimit
        );

        const balances = res.map((x) => {
            return provider.decodeABIParameter<BigNumber>('uint256', x).toString()
        });

        expect(balances.length).toBe(tokens.length);
    });
});
