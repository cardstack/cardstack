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
        internalType: 'address',
        name: '_target',
        type: 'address',
      },
      {
        internalType: 'address',
        name: '_config',
        type: 'address',
      },
      {
        internalType: 'address',
        name: '_exchange',
        type: 'address',
      },
    ],
    stateMutability: 'nonpayable',
    type: 'constructor',
  },
  {
    inputs: [
      {
        internalType: 'bytes32',
        name: 'spHash',
        type: 'bytes32',
      },
    ],
    name: 'AlreadyScheduled',
    type: 'error',
  },
  {
    inputs: [
      {
        internalType: 'bytes32',
        name: 'spHash',
        type: 'bytes32',
      },
    ],
    name: 'ExceedMaxGasPrice',
    type: 'error',
  },
  {
    inputs: [
      {
        internalType: 'uint256',
        name: 'gas',
        type: 'uint256',
      },
    ],
    name: 'GasEstimation',
    type: 'error',
  },
  {
    inputs: [
      {
        internalType: 'bytes32',
        name: 'spHash',
        type: 'bytes32',
      },
    ],
    name: 'InvalidPeriod',
    type: 'error',
  },
  {
    inputs: [
      {
        internalType: 'address',
        name: 'guard_',
        type: 'address',
      },
    ],
    name: 'NotIERC165Compliant',
    type: 'error',
  },
  {
    inputs: [
      {
        internalType: 'bytes32',
        name: 'spHash',
        type: 'bytes32',
      },
      {
        internalType: 'uint256',
        name: 'gasUsed',
        type: 'uint256',
      },
    ],
    name: 'OutOfGas',
    type: 'error',
  },
  {
    inputs: [
      {
        internalType: 'bytes32',
        name: 'spHash',
        type: 'bytes32',
      },
    ],
    name: 'PaymentExecutionFailed',
    type: 'error',
  },
  {
    inputs: [
      {
        internalType: 'bytes32',
        name: 'spHash',
        type: 'bytes32',
      },
    ],
    name: 'UnknownHash',
    type: 'error',
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: 'address',
        name: 'previousAvatar',
        type: 'address',
      },
      {
        indexed: true,
        internalType: 'address',
        name: 'newAvatar',
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
        internalType: 'address',
        name: 'guard',
        type: 'address',
      },
    ],
    name: 'ChangedGuard',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: false,
        internalType: 'address',
        name: 'config',
        type: 'address',
      },
    ],
    name: 'ConfigSet',
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
        internalType: 'bytes32',
        name: 'spHash',
        type: 'bytes32',
      },
    ],
    name: 'PaymentScheduled',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: false,
        internalType: 'bytes32',
        name: 'spHash',
        type: 'bytes32',
      },
    ],
    name: 'ScheduledPaymentCancelled',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: false,
        internalType: 'bytes32',
        name: 'spHash',
        type: 'bytes32',
      },
    ],
    name: 'ScheduledPaymentExecuted',
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
        indexed: true,
        internalType: 'address',
        name: 'owner',
        type: 'address',
      },
      {
        indexed: true,
        internalType: 'address',
        name: 'avatar',
        type: 'address',
      },
      {
        indexed: false,
        internalType: 'address',
        name: 'target',
        type: 'address',
      },
      {
        indexed: false,
        internalType: 'address',
        name: 'config',
        type: 'address',
      },
      {
        indexed: false,
        internalType: 'address',
        name: 'exchange',
        type: 'address',
      },
    ],
    name: 'ScheduledPaymentModuleSetup',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: 'address',
        name: 'previousTarget',
        type: 'address',
      },
      {
        indexed: true,
        internalType: 'address',
        name: 'newTarget',
        type: 'address',
      },
    ],
    name: 'TargetSet',
    type: 'event',
  },
  {
    inputs: [],
    name: 'TRANSFER',
    outputs: [
      {
        internalType: 'bytes4',
        name: '',
        type: 'bytes4',
      },
    ],
    stateMutability: 'view',
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
        name: 'spHash',
        type: 'bytes32',
      },
    ],
    name: 'cancelScheduledPayment',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [],
    name: 'config',
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
        name: 'token',
        type: 'address',
      },
      {
        internalType: 'uint256',
        name: 'amount',
        type: 'uint256',
      },
      {
        internalType: 'address',
        name: 'payee',
        type: 'address',
      },
      {
        components: [
          {
            components: [
              {
                internalType: 'uint256',
                name: 'value',
                type: 'uint256',
              },
            ],
            internalType: 'struct Decimal.D256',
            name: 'fixedUSD',
            type: 'tuple',
          },
          {
            components: [
              {
                internalType: 'uint256',
                name: 'value',
                type: 'uint256',
              },
            ],
            internalType: 'struct Decimal.D256',
            name: 'percentage',
            type: 'tuple',
          },
        ],
        internalType: 'struct ScheduledPaymentModule.Fee',
        name: 'fee',
        type: 'tuple',
      },
      {
        internalType: 'uint256',
        name: 'executionGas',
        type: 'uint256',
      },
      {
        internalType: 'uint256',
        name: 'maxGasPrice',
        type: 'uint256',
      },
      {
        internalType: 'address',
        name: 'gasToken',
        type: 'address',
      },
      {
        internalType: 'string',
        name: 'salt',
        type: 'string',
      },
      {
        internalType: 'uint256',
        name: 'recursDayOfMonth',
        type: 'uint256',
      },
      {
        internalType: 'uint256',
        name: 'until',
        type: 'uint256',
      },
    ],
    name: 'createSpHash',
    outputs: [
      {
        internalType: 'bytes32',
        name: '',
        type: 'bytes32',
      },
    ],
    stateMutability: 'pure',
    type: 'function',
  },
  {
    inputs: [
      {
        internalType: 'address',
        name: 'token',
        type: 'address',
      },
      {
        internalType: 'uint256',
        name: 'amount',
        type: 'uint256',
      },
      {
        internalType: 'address',
        name: 'payee',
        type: 'address',
      },
      {
        components: [
          {
            components: [
              {
                internalType: 'uint256',
                name: 'value',
                type: 'uint256',
              },
            ],
            internalType: 'struct Decimal.D256',
            name: 'fixedUSD',
            type: 'tuple',
          },
          {
            components: [
              {
                internalType: 'uint256',
                name: 'value',
                type: 'uint256',
              },
            ],
            internalType: 'struct Decimal.D256',
            name: 'percentage',
            type: 'tuple',
          },
        ],
        internalType: 'struct ScheduledPaymentModule.Fee',
        name: 'fee',
        type: 'tuple',
      },
      {
        internalType: 'uint256',
        name: 'executionGas',
        type: 'uint256',
      },
      {
        internalType: 'uint256',
        name: 'maxGasPrice',
        type: 'uint256',
      },
      {
        internalType: 'address',
        name: 'gasToken',
        type: 'address',
      },
      {
        internalType: 'string',
        name: 'salt',
        type: 'string',
      },
      {
        internalType: 'uint256',
        name: 'payAt',
        type: 'uint256',
      },
    ],
    name: 'createSpHash',
    outputs: [
      {
        internalType: 'bytes32',
        name: '',
        type: 'bytes32',
      },
    ],
    stateMutability: 'pure',
    type: 'function',
  },
  {
    inputs: [
      {
        internalType: 'address',
        name: 'token',
        type: 'address',
      },
      {
        internalType: 'uint256',
        name: 'amount',
        type: 'uint256',
      },
      {
        internalType: 'address',
        name: 'payee',
        type: 'address',
      },
      {
        components: [
          {
            components: [
              {
                internalType: 'uint256',
                name: 'value',
                type: 'uint256',
              },
            ],
            internalType: 'struct Decimal.D256',
            name: 'fixedUSD',
            type: 'tuple',
          },
          {
            components: [
              {
                internalType: 'uint256',
                name: 'value',
                type: 'uint256',
              },
            ],
            internalType: 'struct Decimal.D256',
            name: 'percentage',
            type: 'tuple',
          },
        ],
        internalType: 'struct ScheduledPaymentModule.Fee',
        name: 'fee',
        type: 'tuple',
      },
      {
        internalType: 'uint256',
        name: 'maxGasPrice',
        type: 'uint256',
      },
      {
        internalType: 'address',
        name: 'gasToken',
        type: 'address',
      },
      {
        internalType: 'string',
        name: 'salt',
        type: 'string',
      },
      {
        internalType: 'uint256',
        name: 'payAt',
        type: 'uint256',
      },
      {
        internalType: 'uint256',
        name: 'gasPrice',
        type: 'uint256',
      },
    ],
    name: 'estimateExecutionGas',
    outputs: [
      {
        internalType: 'uint256',
        name: '',
        type: 'uint256',
      },
    ],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      {
        internalType: 'address',
        name: 'token',
        type: 'address',
      },
      {
        internalType: 'uint256',
        name: 'amount',
        type: 'uint256',
      },
      {
        internalType: 'address',
        name: 'payee',
        type: 'address',
      },
      {
        components: [
          {
            components: [
              {
                internalType: 'uint256',
                name: 'value',
                type: 'uint256',
              },
            ],
            internalType: 'struct Decimal.D256',
            name: 'fixedUSD',
            type: 'tuple',
          },
          {
            components: [
              {
                internalType: 'uint256',
                name: 'value',
                type: 'uint256',
              },
            ],
            internalType: 'struct Decimal.D256',
            name: 'percentage',
            type: 'tuple',
          },
        ],
        internalType: 'struct ScheduledPaymentModule.Fee',
        name: 'fee',
        type: 'tuple',
      },
      {
        internalType: 'uint256',
        name: 'maxGasPrice',
        type: 'uint256',
      },
      {
        internalType: 'address',
        name: 'gasToken',
        type: 'address',
      },
      {
        internalType: 'string',
        name: 'salt',
        type: 'string',
      },
      {
        internalType: 'uint256',
        name: 'recursDayOfMonth',
        type: 'uint256',
      },
      {
        internalType: 'uint256',
        name: 'until',
        type: 'uint256',
      },
      {
        internalType: 'uint256',
        name: 'gasPrice',
        type: 'uint256',
      },
    ],
    name: 'estimateExecutionGas',
    outputs: [
      {
        internalType: 'uint256',
        name: '',
        type: 'uint256',
      },
    ],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [],
    name: 'exchange',
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
        name: 'token',
        type: 'address',
      },
      {
        internalType: 'uint256',
        name: 'amount',
        type: 'uint256',
      },
      {
        internalType: 'address',
        name: 'payee',
        type: 'address',
      },
      {
        components: [
          {
            components: [
              {
                internalType: 'uint256',
                name: 'value',
                type: 'uint256',
              },
            ],
            internalType: 'struct Decimal.D256',
            name: 'fixedUSD',
            type: 'tuple',
          },
          {
            components: [
              {
                internalType: 'uint256',
                name: 'value',
                type: 'uint256',
              },
            ],
            internalType: 'struct Decimal.D256',
            name: 'percentage',
            type: 'tuple',
          },
        ],
        internalType: 'struct ScheduledPaymentModule.Fee',
        name: 'fee',
        type: 'tuple',
      },
      {
        internalType: 'uint256',
        name: 'executionGas',
        type: 'uint256',
      },
      {
        internalType: 'uint256',
        name: 'maxGasPrice',
        type: 'uint256',
      },
      {
        internalType: 'address',
        name: 'gasToken',
        type: 'address',
      },
      {
        internalType: 'string',
        name: 'salt',
        type: 'string',
      },
      {
        internalType: 'uint256',
        name: 'recursDayOfMonth',
        type: 'uint256',
      },
      {
        internalType: 'uint256',
        name: 'until',
        type: 'uint256',
      },
      {
        internalType: 'uint256',
        name: 'gasPrice',
        type: 'uint256',
      },
    ],
    name: 'executeScheduledPayment',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      {
        internalType: 'address',
        name: 'token',
        type: 'address',
      },
      {
        internalType: 'uint256',
        name: 'amount',
        type: 'uint256',
      },
      {
        internalType: 'address',
        name: 'payee',
        type: 'address',
      },
      {
        components: [
          {
            components: [
              {
                internalType: 'uint256',
                name: 'value',
                type: 'uint256',
              },
            ],
            internalType: 'struct Decimal.D256',
            name: 'fixedUSD',
            type: 'tuple',
          },
          {
            components: [
              {
                internalType: 'uint256',
                name: 'value',
                type: 'uint256',
              },
            ],
            internalType: 'struct Decimal.D256',
            name: 'percentage',
            type: 'tuple',
          },
        ],
        internalType: 'struct ScheduledPaymentModule.Fee',
        name: 'fee',
        type: 'tuple',
      },
      {
        internalType: 'uint256',
        name: 'executionGas',
        type: 'uint256',
      },
      {
        internalType: 'uint256',
        name: 'maxGasPrice',
        type: 'uint256',
      },
      {
        internalType: 'address',
        name: 'gasToken',
        type: 'address',
      },
      {
        internalType: 'string',
        name: 'salt',
        type: 'string',
      },
      {
        internalType: 'uint256',
        name: 'payAt',
        type: 'uint256',
      },
      {
        internalType: 'uint256',
        name: 'gasPrice',
        type: 'uint256',
      },
    ],
    name: 'executeScheduledPayment',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [],
    name: 'getGuard',
    outputs: [
      {
        internalType: 'address',
        name: '_guard',
        type: 'address',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'getSpHashes',
    outputs: [
      {
        internalType: 'bytes32[]',
        name: '',
        type: 'bytes32[]',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'guard',
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
        name: '',
        type: 'bytes32',
      },
    ],
    name: 'lastPaidAt',
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
    inputs: [],
    name: 'renounceOwnership',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      {
        internalType: 'bytes32',
        name: 'spHash',
        type: 'bytes32',
      },
    ],
    name: 'schedulePayment',
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
        internalType: 'address',
        name: '_config',
        type: 'address',
      },
    ],
    name: 'setConfig',
    outputs: [],
    stateMutability: 'nonpayable',
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
    name: 'setGuard',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      {
        internalType: 'address',
        name: '_target',
        type: 'address',
      },
    ],
    name: 'setTarget',
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
    inputs: [],
    name: 'target',
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
