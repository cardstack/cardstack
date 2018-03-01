module.exports = {
  "extends": require.resolve("@cardstack/eslint-config/test"),
  env: {
    'node': true
  },
  "globals": {
    "web3": true,
    "contract": true,
    "artifacts": true,
  }
};
