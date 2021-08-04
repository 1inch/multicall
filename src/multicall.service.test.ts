import { ProviderConnector } from './connector';
import { defaultParamsWithGas, MultiCallService } from './multicall.service';
import { anything, capture, instance, mock, when } from 'ts-mockito';
import { MultiCallRequest, MultiCallRequestWithGas } from './model';

describe('MultiCallService', () => {
    const multiCallAddress = '0x001';

    let multiCallService: MultiCallService;
    let connector: ProviderConnector;

    beforeEach(() => {
        connector = mock<ProviderConnector>();
        multiCallService = new MultiCallService(
            instance(connector),
            multiCallAddress
        );
    });

    beforeEach(() => {
        when(connector.contractEncodeABI(anything(), anything(), anything(), anything())).thenCall((
            _: unknown, __: string, methodName: string, params: unknown[],
        ) => {
            return {methodName, params};
        });

        when(connector.ethCall(anything(), anything(), anything())).thenCall((
            _: unknown, callData: {methodName: string, params: unknown[]}
        ) => {
            return callData;
        });
    });


    describe('callByGasLimit() full successful multicall', () => {
        beforeEach(() => {
            when(connector.decodeABIParameterList(anything(), anything())).thenCall((
                _: unknown, callData: {methodName: string, params: unknown[]}
            ) => {
                // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                // @ts-ignore
                return {results: callData.params[0], lastSuccessIndex: callData.params[0].length};
            });
        });

        it('test', async () => {
            const gasLimit = 410;
            const requests: MultiCallRequestWithGas[] = [
                {to: '01', data: '01', gas: 100},
                {to: '02', data: '02', gas: 100},
                {to: '03', data: '03', gas: 100},
                {to: '04', data: '04', gas: 100},
                {to: '05', data: '05', gas: 100},
                {to: '06', data: '06', gas: 100},
                {to: '07', data: '07', gas: 100},
                {to: '08', data: '08', gas: 100},
                {to: '09', data: '09', gas: 100},
                {to: '10', data: '10', gas: 100},
            ];

            const result = await multiCallService.callByGasLimit(requests, gasLimit, {
                ...defaultParamsWithGas,
                maxChunkSize: 3,
            });

            expect(result).toEqual(requests.map(r => ({to: r.to, data: r.data})));
        });
    });

    describe('callByGasLimit() multicall with errors', () => {
        function getLastSuccessIndex(requests: MultiCallRequest[]): number {
            // lastSuccessIndex = 1, it means that only 01, 02 responses were successful
            if (requests.map(i => i.data).join('') === '010203') {
                return 1;
            }

            // lastSuccessIndex = 1, it means that only 04, 05 responses were successful
            if (requests.map(i => i.data).join('') === '040506') {
                return 1;
            }

            // lastSuccessIndex = 0, it means that only 7 responses were successful
            if (requests.map(i => i.data).join('') === '070809') {
                return 0;
            }

            return requests.length - 1;
        }

        beforeEach(() => {
            when(connector.decodeABIParameterList(anything(), anything())).thenCall((
                _: unknown, callData: {methodName: string, params: unknown[]}
            ) => {
                const results = callData.params[0] as MultiCallRequest[];

                return {results, lastSuccessIndex: getLastSuccessIndex(results)};
            });
        });

        it('test', async () => {
            const gasLimit = 300;
            const requests: MultiCallRequestWithGas[] = [
                {to: '01', data: '01', gas: 100},
                {to: '02', data: '02', gas: 100},
                {to: '03', data: '03', gas: 100},
                {to: '04', data: '04', gas: 100},
                {to: '05', data: '05', gas: 100},
                {to: '06', data: '06', gas: 100},
                {to: '07', data: '07', gas: 100},
                {to: '08', data: '08', gas: 100},
                {to: '09', data: '09', gas: 100},
                {to: '10', data: '10', gas: 100},
            ];
            const expectedRequestsByChunks = [
                [
                    {to: '01', data: '01'},
                    {to: '02', data: '02'},
                    {to: '03', data: '03'},
                ],
                [
                    {to: '04', data: '04'},
                    {to: '05', data: '05'},
                    {to: '06', data: '06'},
                ],
                [
                    {to: '07', data: '07'},
                    {to: '08', data: '08'},
                    {to: '09', data: '09'},
                ],
                [
                    {to: '10', data: '10'},
                ],
                [
                    {to: '03', data: '03'},
                    {to: '06', data: '06'},
                ],
                [
                    {to: '08', data: '08'},
                    {to: '09', data: '09'},
                ],
            ];

            const result = await multiCallService.callByGasLimit(requests, gasLimit, {
                ...defaultParamsWithGas,
                maxChunkSize: 3,
            });

            const ethCalls = capture(connector.ethCall);

            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-ignore
            const ethCallArguments = [0,1,2,3,4,5].map(index => ethCalls.byCallIndex(index)[1]['params'][0]);

            expect(ethCallArguments).toEqual(expectedRequestsByChunks);
            expect(result).toEqual(requests.map(r => ({to: r.to, data: r.data})));
        });
    });
});
