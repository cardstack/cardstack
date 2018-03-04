pragma solidity ^0.4.18;

// looks like truffle doesn't handle yarn workspaces and
// as a result cannot find the open zeppelin libs in the
// node_modules/ folder. manually replicating these
// instead since it's purely for testing purposes

import "./zeppelin/MintableToken.sol";

contract SampleToken is MintableToken {
  string public name = "SampleToken";
  string public symbol = "TOK";

  function fund() payable public { }
}
