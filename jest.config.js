module.exports = {
    testTimeout: 200000,
    moduleFileExtensions: ['js', 'json', 'ts'],
    rootDir: 'src',
    testRegex: '.*\\.(spec|test)\\.ts$',
    transform: {
        '^.+\\.(t|j)s$': '@swc/jest'
    },
    collectCoverageFrom: ['**/*.(t|j)s'],
    coverageDirectory: '../coverage',
    testEnvironment: 'node',
    forceExit: true // For close all ws connections.
}
