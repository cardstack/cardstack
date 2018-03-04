module.exports = {
  root: true,
  "extends": require.resolve('@cardstack/eslint-config'),
  "globals": {
    "web3": true,
    "contract": true,
    "artifacts": true,
  },
};
