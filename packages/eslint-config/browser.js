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
    browser: true,
    es6: true
  },
  rules: {
    // TODO: turn these on
    'ember/new-module-imports': 'off',
    'ember/closure-actions': 'off',
    'ember/no-old-shims': 'off',
    'no-restricted-globals': [2, 'find']
  },
  overrides: [
    // This loads our node rules
    Object.assign({}, require('./-node'), {
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
