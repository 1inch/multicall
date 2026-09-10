import {Interface} from 'ethers'
import {
    decodeOutputForMulticall,
    decodeOutputForMulticallWithGas,
    decodeOutputForMulticallWithGasLimitation
} from './decode'
import ABI from '../abi/MultiCall.abi.json'

const iface = new Interface(ABI)

describe('decode edge cases', () => {
    it('returns 0x for empty bytes elements in all three decoders', () => {
        const emptyAndValue = ['0x', '0x1234']

        expect(decodeOutputForMulticall(iface.encodeFunctionResult('multicall', [emptyAndValue]))).toEqual(
            emptyAndValue
        )
        expect(
            decodeOutputForMulticallWithGasLimitation(
                iface.encodeFunctionResult('multicallWithGasLimitation', [emptyAndValue, 1])
            )
        ).toEqual({results: emptyAndValue, lastSuccessIndex: 1n})
        expect(
            decodeOutputForMulticallWithGas(iface.encodeFunctionResult('multicallWithGas', [emptyAndValue, [11, 22]]))
        ).toEqual({results: emptyAndValue, gasUsed: [11n, 22n]})
    })

    it('rejects input that is shorter than the ABI header', () => {
        expect(() => decodeOutputForMulticall('0x')).toThrow('input too short')
        expect(() => decodeOutputForMulticallWithGasLimitation('0x00')).toThrow('input too short')
        expect(() => decodeOutputForMulticallWithGas('0x' + '00'.repeat(30))).toThrow('input too short')
    })

    it('throws on an out-of-bounds word read', () => {
        const offsetPastEnd = '0x' + (0x40).toString(16).padStart(64, '0')

        expect(() => decodeOutputForMulticall(offsetPastEnd)).toThrow('out of bounds read at index 2')
        expect(() => decodeOutputForMulticallWithGasLimitation(offsetPastEnd + '00'.repeat(32))).toThrow(
            'out of bounds read'
        )
        expect(() => decodeOutputForMulticallWithGas(offsetPastEnd + '00'.repeat(32))).toThrow('out of bounds read')
    })

    it('throws buffer overrun when a bytes payload is shorter than its length', () => {
        const encoded = iface.encodeFunctionResult('multicall', [['0x12345678']])
        const withLimit = iface.encodeFunctionResult('multicallWithGasLimitation', [['0x12345678'], 0])
        const word = (value: number): string => value.toString(16).padStart(64, '0')
        const withGas = '0x' + word(0x40) + word(0xc0) + word(1) + word(0x20) + word(100) + word(0) + word(0)

        expect(() => decodeOutputForMulticall(encoded.slice(0, encoded.length - 60))).toThrow('buffer overrun')
        expect(() => decodeOutputForMulticallWithGasLimitation(withLimit.slice(0, withLimit.length - 60))).toThrow(
            'buffer overrun'
        )
        expect(() => decodeOutputForMulticallWithGas(withGas)).toThrow('buffer overrun')
    })
})
