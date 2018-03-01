const SampleToken = artifacts.require("./SampleToken.sol");

module.exports = function(deployer) {
  deployer.deploy(SampleToken);
};
