pragma solidity ^0.4.18;

// looks like truffle doesn't handle yarn workspaces and
// as a result cannot find the open zeppelin libs in the
// node_modules/ folder. manually replicating these
// instead since it's purely for testing purposes

import "./zeppelin/MintableToken.sol";

contract SampleToken is MintableToken {
  string public name = "SampleToken";
  string public symbol = "TOK";
  bool public tokenFrozen = false;
  uint256 public balanceLimit;
  uint256 public buyerCount;

  mapping (address => uint256) public customBuyerLimit;
  mapping (address => bool) public approvedBuyer;

  mapping (address => uint256) vestingStartDate;
  mapping (address => uint256) vestingCliffDate;
  mapping (address => uint256) vestingDurationSec;
  mapping (address => uint256) vestingFullyVestedAmount;
  mapping (address => uint256) vestingRevokeDate;
  mapping (address => bool) vestingIsRevocable;

  event WhiteList(address indexed buyer, uint256 holdCap);
  event VestedTokenGrant(address indexed beneficiary, uint256 startDate, uint256 cliffSec, uint256 durationSec, uint256 fullyVestedAmount, uint256 revokeDate, bool isRevocable);

  function fund() payable public { }

  function setBalanceLimit(uint256 _balanceLimit) onlyOwner public returns (bool) {
    balanceLimit = _balanceLimit;
  }

  function setTokenFrozen(bool _isFrozen) onlyOwner public returns (bool) {
    tokenFrozen = _isFrozen;
  }

  function setLedger(address _address, uint256 balance) onlyOwner returns (bool) {
    balances[_address] = balance;
  }

  function setCustomBuyer(address buyer, uint256 _balanceLimit) onlyOwner public returns (bool) {
    customBuyerLimit[buyer] = _balanceLimit;
    addBuyer(buyer);

    return true;
  }

  function addBuyer(address buyer) onlyOwner public returns (bool) {
    approvedBuyer[buyer] = true;
    buyerCount = buyerCount + 1;

    uint256 _balanceLimit = customBuyerLimit[buyer];
    if (_balanceLimit == 0) {
      _balanceLimit = balanceLimit;
    }

    emit WhiteList(buyer, _balanceLimit);

    return true;
  }

  function grantVestedTokens(address beneficiary,
                             uint256 fullyVestedAmount,
                             uint256 startDate,
                             uint256 cliffSec,
                             uint256 durationSec,
                             uint256 revokeDate,
                             bool isRevocable) onlyOwner public returns(bool) {
    vestingStartDate[beneficiary] = startDate;
    vestingCliffDate[beneficiary] = cliffSec;
    vestingDurationSec[beneficiary] = durationSec;
    vestingFullyVestedAmount[beneficiary] = fullyVestedAmount;
    vestingRevokeDate[beneficiary] = revokeDate;
    vestingIsRevocable[beneficiary] = isRevocable;

    emit VestedTokenGrant(beneficiary, startDate, cliffSec, durationSec, fullyVestedAmount, revokeDate, isRevocable);

    return true;
  }

  function vestingSchedule(address beneficiary) public
                                                view returns (uint256 startDate,
                                                              uint256 cliffDate,
                                                              uint256 durationSec,
                                                              uint256 fullyVestedAmount,
                                                              uint256 revokeDate,
                                                              bool isRevocable) {
    startDate = vestingStartDate[beneficiary];
    cliffDate = vestingCliffDate[beneficiary];
    durationSec = vestingDurationSec[beneficiary];
    fullyVestedAmount = vestingFullyVestedAmount[beneficiary];
    revokeDate = vestingRevokeDate[beneficiary];
    isRevocable = vestingIsRevocable[beneficiary];
  }
}
