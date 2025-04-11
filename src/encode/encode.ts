// Encoding written by hand for specific ABI because all general libs are too slow for big calls
// Check https://gist.github.com/vbrvk/f9faf997966a553f2cc746213b5b6304 for more details on comparison

// Helper function to pad a hex string to 64 characters (32 bytes)
function padTo32Bytes(hexStr: string): string {
    const hex = hexStr.startsWith('0x') ? hexStr.slice(2) : hexStr

    return hex.padStart(64, '0')
}

const _0x40 = padTo32Bytes('0x40')
const _0x20 = padTo32Bytes('0x20')

// Helper function to encode a uint256
function encodeUint256(value: number | bigint): string {
    return value.toString(16).padStart(64, '0')
}

// Helper function to encode an address
function encodeAddress(address: string): string {
    return address.slice(2).padStart(64, '0')
}

// Helper function to calculate the padded length of bytes
function getPaddedLength(bytesData: string): number {
    const length = bytesData.length / 2 // Convert hex length to byte length

    return 32 * Math.ceil(length / 32) // Round up to nearest 32 bytes
}

type Call = {to: string; data: string}

export function encodeCalls(calls: Array<Call> | ReadonlyArray<Call>, limit?: number | bigint): string {
    const withLimit = limit != undefined
    // 1. First parameter is a dynamic array, so we start with its offset (32 bytes)
    let result = padTo32Bytes(withLimit ? _0x40 : _0x20) // Offset to the array (64 bytes = 0x40)

    if (withLimit) {
        // 2. Second parameter is the limit (uint256)
        result += encodeUint256(limit)
    }

    // 3. Length of the array
    result += encodeUint256(calls.length)

    // 4. Calculate offsets for each tuple in the array
    // The first tuple starts at offset 0x60 (96 bytes)
    let currentOffset = 32 * calls.length

    for (let i = 0; i < calls.length; i++) {
        result += encodeUint256(currentOffset)

        // Calculate the size of this tuple for the next offset
        // Each tuple has: address (32) + offset (32) + length (32) + data (padded)
        if (i < calls.length - 1) {
            const bytesData = calls[i].data.slice(2)
            const paddedDataLength = getPaddedLength(bytesData)

            // Move to the next tuple
            currentOffset += 32 + 32 + 32 + paddedDataLength
        }
    }

    // 5. Encode each tuple
    for (const call of calls) {
        // 5.1. Encode the address
        result += encodeAddress(call.to)

        // 5.2. Encode the offset to the bytes data (always 0x40 = 64 bytes from the start of the tuple)
        result += _0x40

        // 5.3. Encode the bytes data length
        const bytesData = call.data.slice(2)
        const bytesLength = bytesData.length / 2
        result += encodeUint256(bytesLength)

        // 5.4. Add the actual bytes data
        result += bytesData

        // 5.5. Add padding to align to 32 bytes
        const padding = (32 - (bytesLength % 32)) % 32
        result += '00'.repeat(padding)
    }

    return result
}
