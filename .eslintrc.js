module.exports = {
  root: true,
  env: {
    node: true,
  },
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/eslint-recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:prettier/recommended',
  ],
  parserOptions: {
    ecmaVersion: 2020,
    parser: '@typescript-eslint/parser',
  },
  overrides: [
    {
      files: [
        '**/__tests__/*.{j,t}s?(x)',
        '**/tests/unit/**/*.spec.{j,t}s?(x)',
      ],
      env: {
        jest: true,
      },
    },
    {
      files: ['*.js', '*.jsx'],
      rules: {
        '@typescript-eslint/no-var-requires': 'off',
      },
    },
  ],
  rules: {
    indent: [
      'error',
      2,
      {
        // 0 would be nicer but somehow eslint is not working with that
        SwitchCase: 1,
      },
    ],
    'no-multiple-empty-lines': [
      'error',
      {
        max: 3,
        maxEOF: 3, // due to vue sfc
        maxBOF: 0,
      },
    ],
    'no-multi-spaces': [
      'error',
      {
        exceptions: {
          VariableDeclarator: true,
          ImportDeclaration: true,
        },
      },
    ],
    'comma-dangle': ['error', 'always-multiline'],
    'key-spacing': [
      'error',
      {
        mode: 'minimum',
      },
    ],
    'object-curly-spacing': ['off'],
    'space-in-brackets': ['off'],
    'object-property-newline': [
      'error',
      {
        allowAllPropertiesOnSameLine: true,
      },
    ],
    // 'arrow-parens': ['error', 'as-needed', { requireForBlockBody: false }],
    '@typescript-eslint/no-explicit-any': 'off',
    '@typescript-eslint/array-type': 'off',
    '@typescript-eslint/explicit-function-return-type': 'off',
    '@typescript-eslint/explicit-member-accessibility': 'off',
    '@typescript-eslint/no-use-before-define': 'off',
    '@typescript-eslint/no-inferrable-types': [
      'error',
      {
        ignoreParameters: true,
      },
    ],
  },
};
