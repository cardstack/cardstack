module.exports = {
  root: true,
  parserOptions: {
    ecmaVersion: 2017,
    sourceType: 'module'
  },
  plugins: ['ember'],
  extends: [
    'eslint:recommended',
    'plugin:ember/recommended'
  ],
  env: {
    browser: true
  },
  rules: {
    // TODO: turn these on
    'ember/new-module-imports': 'off',
    'ember/closure-actions': 'off',
    'ember/no-old-shims': 'off'
  },
  // TODO: get rid of all these once we port the tests
  globals: {
    visit: false,
    andThen: false,
    currentURL: false,
    findWithAssert: false,
    setResolver: false,
    resolver: false,
    fillIn: false,
    click: false,
    assertTrimmedText: false
  },
  overrides: [
    // This loads our node rules
    Object.assign({}, require('./index'), {
      // And applies them to all the paths that are node paths in a
      // standard ember-addon
      files: [
        'index.js',
        'testem.js',
        'ember-cli-build.js',
        'cardstack/**/*.js',
        'config/**/*.js',
        'tests/dummy/config/**/*.js',
        'tests/dummy/cardstack/**/*.js'
      ],
      excludedFiles: [
        'app/**',
        'addon/**',
        'tests/dummy/app/**'
      ]
    }),

    // And this loads our node tests rules
    Object.assign({}, require('./test'), {
      files: [
        'node-tests/**/*.js'
      ]
    })
  ]
};
