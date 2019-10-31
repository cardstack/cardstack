module.exports = {
  root: true,
  extends: '@cardstack/eslint-config', // this is the node config with ts support, at some point we'll need to augment with browser support too
  // probably we want to make a new eslint rule for cards (the one that exists now is pretty out of date)
};
