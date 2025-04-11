// Decoding written by hand for specific ABI because all general libs are too slow for big calls
// Check https://gist.github.com/vbrvk/f9faf997966a553f2cc746213b5b6304 for more details on comparison

import assert from 'node:assert'

// Helper function to convert a hex word to a number
function wordToNumber(word: string): number {
    return parseInt(word, 16)
}

// Helper function to read a 32-byte word at a given index
function readWord(index: number, data: string): string {
    const start = index * 64
    const end = start + 64

    if (end > data.length) {
        throw new Error(`out of bounds read at index ${index}`)
    }

    return data.slice(start, end)
}

export function decodeOutputForMulticall(hexData: string): string[] {
    assert(hexData.length >= 2 + 0x40, 'input too short') // 0x20 offset + 0x20 len for `results`
    const data = hexData.slice(2)

    // Read the offset to the bytes[] array (first parameter)
    const bytesArrayOffset = wordToNumber(readWord(0, data)) / 32

    // Read the length of the bytes[] array
    const bytesArrayLength = wordToNumber(readWord(bytesArrayOffset, data))

    const results: string[] = []

    // Parse results
    for (let i = 0; i < bytesArrayLength; i++) {
        // Get the offset to this bytes element (relative to the start of the array)
        const elementOffsetIndex = bytesArrayOffset + 1 + i
        const elementOffsetRelative = wordToNumber(readWord(elementOffsetIndex, data))

        // Calculate the absolute position
        const elementLengthPosition = bytesArrayOffset + 1 + elementOffsetRelative / 32

        // Read the length of this bytes element
        const elementLength = wordToNumber(readWord(elementLengthPosition, data))

        const elementPosition = elementLengthPosition + 1

        // If the length is 0, add an empty bytes value
        if (elementLength === 0) {
            results.push('0x')
            continue
        }

        const startPosition = elementPosition * 64
        const endPosition = startPosition + elementLength * 2

        if (data.length < endPosition) {
            throw new Error('buffer overrun')
        }

        // Add to results
        results.push('0x' + data.slice(startPosition, endPosition))
    }

    return results
}

export function decodeOutputForMulticallWithGasLimitation(hexData: string): {
    results: string[]
    lastSuccessIndex: bigint
} {
    assert(hexData.length >= 2 + 0x60, 'input too short') // 0x20 offset + 0x20 len for `results` + 0x20 for `lastSuccessIndex`
    const data = hexData.slice(2)

    // 1. Read the offset to the bytes[] array (first parameter)
    const bytesArrayOffsetHex = readWord(0, data)
    const bytesArrayOffset = wordToNumber(bytesArrayOffsetHex) / 32

    // 2. Read the lastSuccessIndex (second parameter)
    const lastSuccessIndexHex = readWord(1, data)
    const lastSuccessIndex = BigInt(wordToNumber(lastSuccessIndexHex))

    // 3. Read the length of the bytes[] array
    const bytesArrayLengthHex = readWord(bytesArrayOffset, data)
    const bytesArrayLength = wordToNumber(bytesArrayLengthHex)

    // 4. Initialize the results array
    const results: string[] = []

    // 5. For each element in the array, read its offset and then its data
    for (let i = 0; i < bytesArrayLength; i++) {
        // Get the offset to this bytes element (relative to the start of the array)
        const elementOffsetIndex = bytesArrayOffset + 1 + i
        const elementOffsetHex = readWord(elementOffsetIndex, data)
        const elementOffsetRelative = wordToNumber(elementOffsetHex)

        // Calculate the absolute position
        const elementLengthPosition = bytesArrayOffset + 1 + elementOffsetRelative / 32

        // Read the length of this bytes element
        const elementLengthHex = readWord(elementLengthPosition, data)
        const elementLength = wordToNumber(elementLengthHex)

        const elementPosition = elementLengthPosition + 1

        // If the length is 0, add an empty bytes value
        if (elementLength === 0) {
            results.push('0x')
            continue
        }

        const startPosition = elementPosition * 64
        const endPosition = startPosition + elementLength * 2

        if (data.length < endPosition) {
            throw new Error('buffer overrun')
        }

        // Add to results
        results.push('0x' + data.slice(startPosition, endPosition))
    }

    return {
        results,
        lastSuccessIndex
    }
}

export function decodeOutputForMulticallWithGas(hexData: string): {
    results: string[]
    gasUsed: bigint[]
} {
    assert(hexData.length >= 2 + 0x40 * 2, 'input too short') // 0x20 for offset + 0x20 for len for each array
    const data = hexData.slice(2)

    // Read the offset to the bytes[] (first parameter)
    const bytesArrayOffset = wordToNumber(readWord(0, data)) / 32

    // Read the offset to the uint256[] (second parameter)
    const gasUsedArrayOffset = wordToNumber(readWord(1, data)) / 32

    // Read the length of the bytes[] array
    const bytesArrayLength = wordToNumber(readWord(bytesArrayOffset, data))

    // Read the length of the uint256[] array
    const gasUsedArrayLength = wordToNumber(readWord(gasUsedArrayOffset, data))

    // Initialize the results array
    const results: string[] = []
    const gasUsed: bigint[] = []

    // Parse results
    for (let i = 0; i < bytesArrayLength; i++) {
        // Get the offset to this bytes element (relative to the start of the array)
        const elementOffsetIndex = bytesArrayOffset + 1 + i
        const elementOffsetHex = readWord(elementOffsetIndex, data)
        const elementOffsetRelative = wordToNumber(elementOffsetHex)

        // Calculate the absolute position
        const elementLengthPosition = bytesArrayOffset + 1 + elementOffsetRelative / 32

        // Read the length of this bytes element
        const elementLength = wordToNumber(readWord(elementLengthPosition, data))

        const elementPosition = elementLengthPosition + 1

        // If the length is 0, add an empty bytes value
        if (elementLength === 0) {
            results.push('0x')
            continue
        }

        const startPosition = elementPosition * 64
        const endPosition = startPosition + elementLength * 2

        if (data.length < endPosition) {
            throw new Error('buffer overrun')
        }

        // Add to results
        results.push('0x' + data.slice(startPosition, endPosition))
    }

    // Parse gasUsed
    for (let i = 0; i < gasUsedArrayLength; i++) {
        const elementPosition = gasUsedArrayOffset + 1 + i
        const elementHex = readWord(elementPosition, data)
        const element = BigInt('0x' + elementHex)

        gasUsed.push(element)
    }

    return {
        results,
        gasUsed
    }
}
