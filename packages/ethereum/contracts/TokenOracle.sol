pragma solidity ^0.4.18;

import "./zeppelin/ownership/Ownable.sol";

contract TokenOracle is Ownable {
  struct Token {
    address tokenAddress;
    string tokenSymbol;
    uint256 rate;
  }

  mapping (address => Token) public tokens;

  event TokenAdded(address tokenAddress, string tokenSymbol, uint256 rate);

  function addToken(address tokenAddress, string memory tokenSymbol, uint256 rate) public onlyOwner {
    Token memory token = Token(tokenAddress, tokenSymbol, rate);
    tokens[tokenAddress] = token;

    emit TokenAdded(tokenAddress, tokenSymbol, rate);
  }
}