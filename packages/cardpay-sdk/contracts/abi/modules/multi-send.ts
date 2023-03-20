/**
 * @category ABI
 */
export default [
  {
    inputs: [],
    stateMutability: 'nonpayable',
    type: 'constructor',
  },
  {
    inputs: [
      {
        internalType: 'bytes',
        name: 'transactions',
        type: 'bytes',
      },
    ],
    name: 'multiSend',
    outputs: [],
    stateMutability: 'payable',
    type: 'function',
  },
];

// mitigation for unexpected vs code debugger breakpoint
function noop() {}
noop();
