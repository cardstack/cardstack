// eslint-disable-next-line no-undef
module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/eslint-recommended',
    'plugin:@typescript-eslint/recommended',
  ],
  parserOptions: {
    ecmaVersion: 2020,
    sourceType: 'module',
    ecmaFeatures: {},
  },

  // === General rules =========================================================

  rules: {
    // Omitted semicolons are hugely popular, yet within the compiler it makes
    // sense to be better safe than sorry.
    semi: 'error',

    // Our code bases uses 2 spaces for indentation, and we enforce it here so
    // files don't mix spaces, tabs or different indentation levels.
    indent: [
      'error',
      2,
      {
        SwitchCase: 1,
        VariableDeclarator: 'first',
        offsetTernaryExpressions: true,
        ignoredNodes: [
          // FIXME: something's odd here
          'ConditionalExpression > *',
          'ConditionalExpression > * > *',
          'ConditionalExpression > * > * > *',
        ],
      },
    ],

    // Sometimes it can't be avoided to add a @ts-ignore
    '@typescript-eslint/ban-ts-comment': 'off',

    // This is mostly visual style, making comments look uniform.
    'spaced-comment': [
      'error',
      'always',
      {
        markers: ['/'], // triple-slash
        exceptions: ['/'], // all slashes
      },
    ],

    // This tends to be annoying as it encourages developers to make everything
    // that is never reassigned a 'const', sometimes semantically incorrect so,
    // typically leading to huge diffs in follow-up PRs modifying affected code.
    'prefer-const': 'off',

    // It is perfectly fine to declare top-level variables with `var`, yet this
    // rule doesn't provide configuration options that would help.
    'no-var': 'off',

    // Quite often, dealing with multiple related cases at once or otherwise
    // falling through is exactly the point of using a switch.
    'no-fallthrough': 'off',

    // Typical false-positives here are `do { ... } while (true)` statements or
    // similar, but the only option provided here is not checking any loops.
    'no-constant-condition': ['error', { checkLoops: false }],

    // Functions are nested in blocks occasionally, and there haven't been any
    // problems with this so far, so turning the check off.
    'no-inner-declarations': 'off',

    // Quite common in scenarios where an iteration starts at `current = this`.
    '@typescript-eslint/no-this-alias': 'off',

    // Disabled here, but enabled again for JavaScript files.
    'no-unused-vars': 'off',

    // Disabled here, but enabled again for TypeScript files.
    '@typescript-eslint/no-unused-vars': 'off',
  },
  overrides: [
    // === TypeScript rules ====================================================
    {
      files: ['**/assembly/**/*.ts'],
      rules: {
        // Enforcing to remove function parameters on stubs makes code less
        // maintainable, so we instead allow unused function parameters.
        '@typescript-eslint/no-unused-vars': [
          'warn',
          {
            vars: 'local',
            varsIgnorePattern: '^_|^[A-Z](?:From|To)?$', // ignore type params
            args: 'none',
            ignoreRestSiblings: false,
          },
        ],

        // Namespaces are quite useful in AssemblyScript
        '@typescript-eslint/no-namespace': 'off',

        // There is actually codegen difference here
        '@typescript-eslint/no-array-constructor': 'off',

        // Utilized to achieve portability in some cases
        '@typescript-eslint/no-non-null-assertion': 'off',
      },
    },

    // === Compiler rules (extends AssemblyScript rules) =======================

    {
      files: ['**/assembly/**/*.ts'],
      rules: {
        // There is an actual codegen difference here - TODO: revisit
        'no-cond-assign': 'off',

        // Not all types can be omitted in AS yet - TODO: revisit
        '@typescript-eslint/no-inferrable-types': 'off',

        // Used rarely to reference internals that are not user-visible
        '@typescript-eslint/triple-slash-reference': 'off',

        // The compiler has its own `Function` class for example
        'no-shadow-restricted-names': 'off',
        '@typescript-eslint/ban-types': 'off',
      },
    },

    // === Standard Library rules (extends AssemblyScript rules) ===============

    {
      files: ['**/assembly/**/*.ts'],
      rules: {
        // We are implementing with --noLib, so we shadow all the time
        'no-shadow-restricted-names': 'off',

        // Similarly, sometimes we need the return type to be String, not string
        '@typescript-eslint/ban-types': 'off',
      },
    },

    // === Standard Definition rules (extends TypeScript rules) ================

    {
      files: ['**/assembly/**/*.d.ts'],
      rules: {
        // Often required to achieve compatibility with TypeScript
        '@typescript-eslint/no-explicit-any': 'off',

        // Interfaces can be stubs here, i.e. not yet fully implemented
        '@typescript-eslint/no-empty-interface': 'off',

        // Definitions make use of `object` to model rather unusual constraints
        '@typescript-eslint/ban-types': 'off',
      },
    },

    // === Test rules (extends TypeScript rules) ===============================

    {
      files: ['**/assembly/__tests__/**/*.ts'],
      rules: {
        // Tests typically include unusual code patterns on purpose. This is
        // very likely not an extensive list, but covers what's there so far.
        'no-empty': 'off',
        'no-cond-assign': 'off',
        'no-compare-neg-zero': 'off',
        'no-inner-declarations': 'off',
        'no-constant-condition': 'off',
        'use-isnan': 'off',
        '@typescript-eslint/no-namespace': 'off',
        '@typescript-eslint/no-unused-vars': 'off',
        '@typescript-eslint/no-empty-function': 'off',
        '@typescript-eslint/no-non-null-assertion': 'off',
        '@typescript-eslint/no-extra-semi': 'off',
        '@typescript-eslint/no-inferrable-types': 'off',
        '@typescript-eslint/ban-types': 'off',
        '@typescript-eslint/triple-slash-reference': 'off',
        '@typescript-eslint/ban-ts-comment': 'off',
        '@typescript-eslint/no-extra-non-null-assertion': 'off',
        '@typescript-eslint/no-empty-interface': 'off',
      },
    },
  ],
};
