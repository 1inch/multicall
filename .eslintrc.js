module.exports = {
    root: true,
    parser: '@typescript-eslint/parser',
    plugins: ['@typescript-eslint', 'unused-imports'],
    extends: [
        'eslint:recommended',
        'plugin:@typescript-eslint/recommended',
        'prettier',
    ],
    rules: {
        '@typescript-eslint/member-ordering': 'error',
        'lines-between-class-members': 'error',
        'padding-line-between-statements': 'error',
        'no-unused-vars': 'off',
        'max-len': ['error', {code: 120}],
        'max-depth': ['error', 3],
        'max-lines-per-function': ['error', 70],
        'max-params': ['error', 7],
        '@typescript-eslint/no-explicit-any': 'error',
        '@typescript-eslint/no-unused-vars': 'error',
        'unused-imports/no-unused-imports': 'error',
        'unused-imports/no-unused-vars': 0,
    },
    overrides: [
        {
            files: ['src/**/*.test.ts'],
            rules: {
                'max-lines-per-function': ['error', 400],
                'max-len': ['error', {code: 130}],
            },
        },
    ],
};
