export default [
  {
    anonymous: false,
    inputs: [
      {
        indexed: false,
        internalType: 'address',
        name: 'rewardSafe',
        type: 'address',
      },
      {
        indexed: false,
        internalType: 'address',
        name: 'token',
        type: 'address',
      },
      {
        indexed: false,
        internalType: 'uint256',
        name: 'value',
        type: 'uint256',
      },
    ],
    name: 'RewardSafeWithdrawal',
    type: 'event',
  },
  {
    constant: false,
    inputs: [
      {
        internalType: 'address',
        name: '__trusted__managerContract',
        type: 'address',
      },
      {
        internalType: 'address',
        name: '__untrusted__prevOwner',
        type: 'address',
      },
      {
        internalType: 'address',
        name: '__untrusted__oldOwner',
        type: 'address',
      },
      {
        internalType: 'address',
        name: '__untrusted__newOwner',
        type: 'address',
      },
    ],
    name: 'swapOwner',
    outputs: [],
    payable: false,
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    constant: false,
    inputs: [
      {
        internalType: 'address',
        name: '__trusted__managerContract',
        type: 'address',
      },
      {
        internalType: 'address',
        name: '__untrusted__token',
        type: 'address',
      },
      {
        internalType: 'address',
        name: '__untrusted__to',
        type: 'address',
      },
      {
        internalType: 'uint256',
        name: '__untrusted__value',
        type: 'uint256',
      },
    ],
    name: 'withdraw',
    outputs: [],
    payable: false,
    stateMutability: 'nonpayable',
    type: 'function',
  },
];
