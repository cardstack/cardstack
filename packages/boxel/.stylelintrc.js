module.exports = {
  extends: 'stylelint-config-standard',
  ignoreFiles: ['dist/**/*.css', 'node_modules/**/*.css'],
  rules: {
    'property-no-vendor-prefix': null,
    'selector-class-pattern':
      '^[a-z]([a-z0-9-]+)?(__([a-z0-9]+-?)+){0,}(--([a-z0-9]+-?)+){0,2}$',
    'declaration-block-no-redundant-longhand-properties': [
      true,
      {
        severity: 'warning',
        ignoreShorthands: ['/^grid-.+/'],
      },
    ],
    'value-no-vendor-prefix': [
      true,
      {
        severity: 'warning',
        // needed for multiline truncation (-webkit-box)
        ignoreValues: ['box'],
      },
    ],
  },
};
