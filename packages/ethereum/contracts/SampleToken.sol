pragma solidity ^0.4.18;

import "./zeppelin/MintableToken.sol";

contract SampleToken is MintableToken {
  string public name = "SampleToken";
  string public symbol = "TOK";
}
