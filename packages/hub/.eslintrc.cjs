module.exports = {
  root: true,
  extends: '@cardstack/eslint-config',
  parserOptions: {
    tsconfigRootDir: __dirname,
  },
  globals: {
    __non_webpack_require__: 'readable',
  },
};
