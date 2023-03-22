import { BigNumber, utils, VoidSigner } from 'ethers';

/**
 * @group Utils
 * @category Rewards
 * @alpha
 */
class SolidityStruct {
  properties: { name: string; type: string }[];
  values: any[]; // eslint-disable-line @typescript-eslint/no-explicit-any
  structName: string;

  constructor(
    structName: string,
    properties: { name: string; type: string }[],
    values: any[] // eslint-disable-line @typescript-eslint/no-explicit-any
  ) {
    this.structName = structName;
    this.properties = properties;
    this.values = values;
  }

  typeString() {
    const structArguments = this.properties.map((o) => o.type + ' ' + o.name).join(',');
    return `${this.structName}(${structArguments})`;
  }

  typeHash() {
    return utils.keccak256(utils.toUtf8Bytes(this.typeString()));
  }

  abiEncode() {
    const abiCoder = new utils.AbiCoder();
    return abiCoder.encode(
      this.properties.map((o) => o.type),
      this.values
    );
  }

  typedData() {
    const type: { [key: string]: { name: string; type: string }[] } = {};
    type[this.structName] = this.properties;
    return type;
  }

  asMapping() {
    const data: { [key: string]: any } = {}; // eslint-disable-line @typescript-eslint/no-explicit-any
    this.properties.forEach((o, i) => {
      data[o.name] = this.values[i];
    });
    return data;
  }
}

/**
 * Check: Specify when a claim is valid
 * @group Utils
 * @category Rewards
 * @alpha
 */
export class TimeRangeSeconds extends SolidityStruct {
  constructor(validFromTime: number, validToTime: number) {
    super(
      'TimeRangeSeconds',
      [
        { name: 'validFromTime', type: 'uint256' },
        { name: 'validToTime', type: 'uint256' },
      ],
      [validFromTime, validToTime]
    );
  }
}

class Action extends SolidityStruct {
  constructor(structName: string, properties: { name: string; type: string }[], values: any[]) {
    super(structName, properties, values);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  defaultExtraData(): { types: string[]; data: any[] } {
    return {
      types: [],
      data: [],
    };
  }
}

/**
 * Check: Specify address of caller
 * @group Utils
 * @category Rewards
 * @alpha
 */
export class Address extends SolidityStruct {
  constructor(caller: string) {
    super('Address', [{ name: 'caller', type: 'address' }], [caller]);
  }
}

/**
 * Action: Transfer token to caller
 * @group Utils
 * @category Rewards
 * @alpha
 */
export class TransferERC20ToCaller extends Action {
  amount: BigNumber;
  constructor(token: string, amount: BigNumber) {
    super(
      'TransferERC20ToCaller',
      [
        { name: 'token', type: 'address' },
        { name: 'amount', type: 'uint256' },
      ],
      [token, amount]
    );
    this.amount = amount;
  }

  defaultExtraData() {
    return {
      types: ['uint256'],
      data: [this.amount],
    };
  }
}

/**
 * Check: Specify nft that the caller must hold
 * @group Utils
 * @category Rewards
 * @alpha
 */
export class NFTOwner extends SolidityStruct {
  constructor(nftContract: string, tokenId: BigNumber) {
    super(
      'NFTOwner',
      [
        { name: 'nftContract', type: 'address' },
        { name: 'tokenId', type: 'uint256' },
      ],
      [nftContract, tokenId]
    );
  }
}

/**
 * Transfer token to an NFT holder/caller
 * @group Utils
 * @category Rewards
 * @alpha
 */
export class TransferNFTToCaller extends Action {
  constructor(token: string, tokenId: BigNumber) {
    super(
      'TransferNFTToCaller',
      [
        { name: 'token', type: 'address' },
        { name: 'tokenId', type: 'uint256' },
      ],
      [token, tokenId]
    );
  }
}

/**
 * Class that represents the type of claim a user can execute
 * @group Utils
 * @category Rewards
 * @alpha
 */
export class Claim {
  id: string;
  chainId: string;
  address: string;
  stateCheck: SolidityStruct;
  callerCheck: SolidityStruct;
  action: Action;

  constructor(
    id: string,
    chainId: string,
    address: string,
    stateCheck: SolidityStruct,
    callerCheck: SolidityStruct,
    action: Action
  ) {
    this.id = id;
    this.chainId = chainId;
    this.address = address;
    this.stateCheck = stateCheck;
    this.callerCheck = callerCheck;
    this.action = action;
  }

  typedData() {
    return getTypedData(this.chainId, this.address, this.id, this.stateCheck, this.callerCheck, this.action);
  }

  typeString() {
    // Construct a fake type which will contain our checks and actions
    const ownTypeString = `Claim(bytes32 id,${this.stateCheck.structName} state,${this.callerCheck.structName} caller,${this.action.structName} action)`;
    // EIP-712 requires that the type string is sorted alphabetically for types other than the primary one
    const subTypes = [this.stateCheck.typeString(), this.callerCheck.typeString(), this.action.typeString()].sort();
    return ownTypeString + subTypes.join('');
  }

  typeHash() {
    return utils.keccak256(utils.toUtf8Bytes(this.typeString()));
  }

  /**
   * Signs Claim data using EIP712
   */
  sign(signer: VoidSigner) {
    const data = this.typedData();
    return signer._signTypedData(data.domain, data.types, data.message);
  }

  /**
   * @remarks this abi encoded data is eventually decoded at the smart contract level.
   * We have to encode Claim because ethereum contract have limits to the number of arguments they can handle
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  abiEncode(extraActionData?: { types: string[]; data: any[] }) {
    const abiCoder = new utils.AbiCoder();
    const actionData = extraActionData ? extraActionData : this.action.defaultExtraData();
    return abiCoder.encode(
      ['bytes32', 'bytes32', 'bytes32', 'bytes', 'bytes32', 'bytes', 'bytes32', 'bytes', 'bytes'],
      [
        this.typeHash(),
        this.id,
        this.stateCheck.typeHash(),
        this.stateCheck.abiEncode(),
        this.callerCheck.typeHash(),
        this.callerCheck.abiEncode(),
        this.action.typeHash(),
        this.action.abiEncode(),
        abiCoder.encode(actionData.types, actionData.data),
      ]
    );
  }
}

/**
 * Util function to get typed data as based on schema defined in the module contract
 * @group Utils
 * @category Rewards
 * @alpha
 */
export const getTypedData = (
  chainId: string,
  address: string,
  id: string,
  state: SolidityStruct,
  caller: SolidityStruct,
  action: SolidityStruct
) => {
  const types = {
    ...state.typedData(),
    ...caller.typedData(),
    ...action.typedData(),
    ...{
      Claim: [
        { name: 'id', type: 'bytes32' },
        { name: 'state', type: state.structName },
        { name: 'caller', type: caller.structName },
        { name: 'action', type: action.structName },
      ],
    },
  };
  return {
    types: types,
    primaryType: 'Claim',
    domain: {
      name: 'CardstackClaimSettlementModule',
      version: '1',
      chainId: chainId,
      verifyingContract: address,
    },
    message: {
      id: id,
      state: state.asMapping(),
      caller: caller.asMapping(),
      action: action.asMapping(),
    },
  };
};
