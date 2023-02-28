import { BigNumber, utils, VoidSigner } from 'ethers';

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

export class SolidityStructExtraData extends SolidityStruct {
  extraProperties: { name: string; type: string }[];
  extraValues: any[]; // eslint-disable-line @typescript-eslint/no-explicit-any
  constructor(
    structName: string,
    properties: { name: string; type: string }[],
    values: any[],
    extraProperties: { name: string; type: string }[],
    extraValues: any[] = []
  ) {
    super(structName, properties, values);
    this.extraProperties = extraProperties;
    this.extraValues = extraValues;
  }

  abiEncodeExtra() {
    const abiCoder = new utils.AbiCoder();
    return abiCoder.encode(
      this.extraProperties.map((o) => o.type),
      this.extraValues
    );
  }
}
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

export class Address extends SolidityStruct {
  constructor(caller: string) {
    super('Address', [{ name: 'caller', type: 'address' }], [caller]);
  }
}

export class TransferERC20ToCaller extends SolidityStructExtraData {
  constructor(token: string, amount: BigNumber, minAmount: BigNumber) {
    super(
      'TransferERC20ToCaller',
      [
        { name: 'token', type: 'address' },
        { name: 'amount', type: 'uint256' },
      ],
      [token, amount],
      [{ name: 'minAmount', type: 'uint256' }],
      [minAmount]
    );
  }
}

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

export class TransferNFTToCaller extends SolidityStruct {
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

export class Claim {
  id: string;
  chainId: string;
  address: string;
  stateCheck: SolidityStruct;
  callerCheck: SolidityStruct;
  action: SolidityStruct | SolidityStructExtraData;

  constructor(
    id: string,
    chainId: string,
    address: string,
    stateCheck: SolidityStruct,
    callerCheck: SolidityStruct,
    action: SolidityStruct
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

  sign(signer: VoidSigner) {
    const data = this.typedData();
    return signer._signTypedData(data.domain, data.types, data.message);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  abiEncode() {
    const abiCoder = new utils.AbiCoder();
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
        this.action instanceof SolidityStructExtraData ? this.action.abiEncodeExtra() : '0x',
      ]
    );
  }
}

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
