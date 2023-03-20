/**
 * @category ABI
 */
export default [
  {
    inputs: [
      {
        internalType: 'address',
        name: '_owner',
        type: 'address',
      },
      {
        internalType: 'address',
        name: '_avatar',
        type: 'address',
      },
      {
        internalType: 'uint256',
        name: '_maxGuard',
        type: 'uint256',
      },
      {
        internalType: 'address[]',
        name: '_guards',
        type: 'address[]',
      },
    ],
    stateMutability: 'nonpayable',
    type: 'constructor',
  },
  {
    inputs: [
      {
        internalType: 'address',
        name: 'guard',
        type: 'address',
      },
    ],
    name: 'AlreadyAddedGuard',
    type: 'error',
  },
  {
    inputs: [
      {
        internalType: 'address',
        name: 'guard',
        type: 'address',
      },
    ],
    name: 'ExceedMaxGuard',
    type: 'error',
  },
  {
    inputs: [
      {
        internalType: 'address',
        name: 'guard',
        type: 'address',
      },
    ],
    name: 'InvalidGuard',
    type: 'error',
  },
  {
    inputs: [
      {
        internalType: 'address',
        name: 'guard',
        type: 'address',
      },
    ],
    name: 'UnknownGuard',
    type: 'error',
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: false,
        internalType: 'address',
        name: 'guard',
        type: 'address',
      },
    ],
    name: 'AddedGuard',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: false,
        internalType: 'address',
        name: 'avatar',
        type: 'address',
      },
    ],
    name: 'AvatarSet',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: false,
        internalType: 'uint8',
        name: 'version',
        type: 'uint8',
      },
    ],
    name: 'Initialized',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: false,
        internalType: 'uint256',
        name: 'maxGuard',
        type: 'uint256',
      },
    ],
    name: 'MaxGuardSet',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: 'address',
        name: 'initiator',
        type: 'address',
      },
      {
        indexed: false,
        internalType: 'address',
        name: 'owner',
        type: 'address',
      },
      {
        indexed: false,
        internalType: 'address',
        name: 'avatar',
        type: 'address',
      },
      {
        indexed: false,
        internalType: 'uint256',
        name: 'maxGuard',
        type: 'uint256',
      },
      {
        indexed: false,
        internalType: 'address[]',
        name: 'guards',
        type: 'address[]',
      },
    ],
    name: 'MetaGuardSetup',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: 'address',
        name: 'previousOwner',
        type: 'address',
      },
      {
        indexed: true,
        internalType: 'address',
        name: 'newOwner',
        type: 'address',
      },
    ],
    name: 'OwnershipTransferred',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: false,
        internalType: 'address',
        name: 'guard',
        type: 'address',
      },
    ],
    name: 'RemovedGuard',
    type: 'event',
  },
  {
    stateMutability: 'nonpayable',
    type: 'fallback',
  },
  {
    inputs: [
      {
        internalType: 'address',
        name: 'guard',
        type: 'address',
      },
    ],
    name: 'addGuard',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [],
    name: 'avatar',
    outputs: [
      {
        internalType: 'address',
        name: '',
        type: 'address',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      {
        internalType: 'bytes32',
        name: 'txHash',
        type: 'bytes32',
      },
      {
        internalType: 'bool',
        name: 'success',
        type: 'bool',
      },
    ],
    name: 'checkAfterExecution',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      {
        internalType: 'address',
        name: 'to',
        type: 'address',
      },
      {
        internalType: 'uint256',
        name: 'value',
        type: 'uint256',
      },
      {
        internalType: 'bytes',
        name: 'data',
        type: 'bytes',
      },
      {
        internalType: 'enum Enum.Operation',
        name: 'operation',
        type: 'uint8',
      },
      {
        internalType: 'uint256',
        name: 'safeTxGas',
        type: 'uint256',
      },
      {
        internalType: 'uint256',
        name: 'baseGas',
        type: 'uint256',
      },
      {
        internalType: 'uint256',
        name: 'gasPrice',
        type: 'uint256',
      },
      {
        internalType: 'address',
        name: 'gasToken',
        type: 'address',
      },
      {
        internalType: 'address payable',
        name: 'refundReceiver',
        type: 'address',
      },
      {
        internalType: 'bytes',
        name: 'signatures',
        type: 'bytes',
      },
      {
        internalType: 'address',
        name: 'msgSender',
        type: 'address',
      },
    ],
    name: 'checkTransaction',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [],
    name: 'getAllGuards',
    outputs: [
      {
        internalType: 'address[]',
        name: '',
        type: 'address[]',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      {
        internalType: 'address',
        name: '_guard',
        type: 'address',
      },
    ],
    name: 'isGuardAdded',
    outputs: [
      {
        internalType: 'bool',
        name: '',
        type: 'bool',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'maxGuard',
    outputs: [
      {
        internalType: 'uint256',
        name: '',
        type: 'uint256',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'owner',
    outputs: [
      {
        internalType: 'address',
        name: '',
        type: 'address',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      {
        internalType: 'address',
        name: 'prevGuard',
        type: 'address',
      },
      {
        internalType: 'address',
        name: 'guard',
        type: 'address',
      },
    ],
    name: 'removeGuard',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [],
    name: 'renounceOwnership',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      {
        internalType: 'address',
        name: '_avatar',
        type: 'address',
      },
    ],
    name: 'setAvatar',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      {
        internalType: 'uint256',
        name: '_maxGuard',
        type: 'uint256',
      },
    ],
    name: 'setMaxGuard',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      {
        internalType: 'bytes',
        name: 'initParams',
        type: 'bytes',
      },
    ],
    name: 'setUp',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      {
        internalType: 'bytes4',
        name: 'interfaceId',
        type: 'bytes4',
      },
    ],
    name: 'supportsInterface',
    outputs: [
      {
        internalType: 'bool',
        name: '',
        type: 'bool',
      },
    ],
    stateMutability: 'pure',
    type: 'function',
  },
  {
    inputs: [],
    name: 'totalGuard',
    outputs: [
      {
        internalType: 'uint256',
        name: '',
        type: 'uint256',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      {
        internalType: 'address',
        name: 'newOwner',
        type: 'address',
      },
    ],
    name: 'transferOwnership',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
];

// mitigation for unexpected vs code debugger breakpoint
function noop() {}
noop();
