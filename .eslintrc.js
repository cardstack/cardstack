module.exports = {
  root: true,
  // since there is no tsconfig at the root of the project, we do only js linting at this level
  // eslint-disable-next-line node/no-extraneous-require
  extends: require.resolve('@cardstack/eslint-config/javascript'),
};
