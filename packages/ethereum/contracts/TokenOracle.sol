pragma solidity ^0.4.18;

import "./zeppelin/ownership/Ownable.sol";

contract TokenOracle is Ownable {
  struct Token {
    bytes32 id;
    address tokenAddress;
    string tokenSymbol;
    uint256 rate;
  }

  mapping (address => Token) public tokens;
  mapping (bytes32 => Token) public tokensBySymbols;

  event TokenAdded(bytes32 id, address tokenAddress, string tokenSymbol, uint256 rate);

  function addToken(address tokenAddress, string memory tokenSymbol, uint256 rate) public onlyOwner {
    bytes32 id = keccak256(abi.encode(tokenSymbol));
    Token memory token = Token(id, tokenAddress, tokenSymbol, rate);
    tokens[tokenAddress] = token;

    tokensBySymbols[id] = token;

    emit TokenAdded(id, tokenAddress, tokenSymbol, rate);
  }
}