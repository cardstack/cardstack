import Web3 from 'web3';
import SupplierManagerABI from '../../contracts/abi/v0.6.2/supplier-manager';
import ERC20ABI from '../../contracts/abi/erc-20';
import { AbiItem } from 'web3-utils';
import { getAddress } from '../../contracts/addresses';
import { ZERO_ADDRESS } from '../constants';
import { ContractOptions } from 'web3-eth-contract';
import { GnosisExecTx, gasEstimate, executeTransaction } from '../utils/safe-utils';
import { signSafeTxAsRSV } from '../utils/signing-utils';
import BN from 'bn.js';
import { query } from '../utils/graphql';
const { toBN, fromWei } = Web3.utils;

export type Safe = DepotSafe | PrepaidCardSafe | MerchantSafe | ExternalSafe;
interface BaseSafe {
  address: string;
  tokens: TokenInfo[];
  owners: string[];
}
export interface DepotSafe extends BaseSafe {
  type: 'depot';
  infoDID?: string;
}
export interface MerchantSafe extends BaseSafe {
  type: 'merchant';
  accumulatedSpendValue: number;
  infoDID?: string;
}
export interface ExternalSafe extends BaseSafe {
  type: 'external';
}
export interface PrepaidCardSafe extends BaseSafe {
  type: 'prepaid-card';
  issuingToken: string;
  spendFaceValue: number;
  issuer: string;
  reloadable: boolean;
  customizationDID?: string;
}
export interface TokenInfo {
  tokenAddress: string;
  token: {
    name: string;
    symbol: string;
    decimals: number;
  };
  balance: string; // balance is in wei
}

const safeQueryFields = `
  id
  owners {
    owner {
      id
    }
  }
  tokens {
    balance
    token {
      id
      name
      symbol
    }
  }
  depot {
    id
    infoDid
  }
  prepaidCard {
    id
    customizationDID
    issuingToken {
      symbol
      id
    }
    spendBalance
    issuer {
      id
    }
    reloadable
  }
  merchant {
    id
    spendBalance
    infoDid
  }
`;

const safeQuery = `
  query ($id: ID!) {
    safe(id: $id) {
      ${safeQueryFields}
    }
  }
`;

const safesQuery = `
  query($account: ID!) {
    account(id: $account) {
      safes {
        safe {
          ${safeQueryFields}
        }
      }
    }
  }
`;

export default class Safes {
  constructor(private layer2Web3: Web3) {}

  async viewSafe(safeAddress: string): Promise<Safe | undefined> {
    let {
      data: { safe },
    } = await query(this.layer2Web3, safeQuery, { id: safeAddress });
    return processSafeResult(safe as GraphQLSafeResult);
  }

  async view(owner?: string): Promise<Safe[]> {
    owner = owner ?? (await this.layer2Web3.eth.getAccounts())[0];
    let {
      data: { account },
    } = await query(this.layer2Web3, safesQuery, { account: owner });
    if (account == null) {
      return [];
    }
    let { safes } = account;
    let result: Safe[] = [];
    for (let { safe } of safes as { safe: GraphQLSafeResult }[]) {
      let safeResult = processSafeResult(safe);
      if (safeResult) {
        result.push(safeResult);
      }
    }
    return result;
  }

  async sendTokens(
    safeAddress: string,
    tokenAddress: string,
    recipient: string,
    amount: string,
    options?: ContractOptions
  ): Promise<GnosisExecTx> {
    let from = options?.from ?? (await this.layer2Web3.eth.getAccounts())[0];
    let token = new this.layer2Web3.eth.Contract(ERC20ABI as AbiItem[], tokenAddress);
    let symbol = await token.methods.symbol().call();
    let safeBalance = new BN(await token.methods.balanceOf(safeAddress).call());
    if (safeBalance.lt(new BN(amount))) {
      throw new Error(
        `Safe does not have enough balance to transfer tokens. The token ${tokenAddress} balance of safe ${safeAddress} is ${fromWei(
          safeBalance.toString()
        )}, amount to transfer ${fromWei(amount)}`
      );
    }
    let payload = this.transferTokenPayload(tokenAddress, recipient, amount);
    let estimate = await gasEstimate(this.layer2Web3, safeAddress, tokenAddress, '0', payload, 0, tokenAddress);
    let gasCost = new BN(estimate.dataGas).add(new BN(estimate.baseGas)).mul(new BN(estimate.gasPrice));
    if (safeBalance.lt(new BN(amount).add(gasCost))) {
      throw new Error(
        `Safe does not have enough balance to pay for gas when transfer tokens. The token ${tokenAddress} balance of safe ${safeAddress} is ${fromWei(
          safeBalance.toString()
        )} ${symbol}, amount to transfer ${fromWei(amount)} ${symbol}, the gas cost is ${fromWei(gasCost)} ${symbol}`
      );
    }

    if (estimate.lastUsedNonce == null) {
      estimate.lastUsedNonce = -1;
    }
    let signatures = await signSafeTxAsRSV(
      this.layer2Web3,
      tokenAddress,
      0,
      payload,
      0,
      estimate.safeTxGas,
      estimate.dataGas,
      estimate.gasPrice,
      estimate.gasToken,
      ZERO_ADDRESS,
      toBN(estimate.lastUsedNonce + 1),
      from,
      safeAddress
    );
    let result = await executeTransaction(
      this.layer2Web3,
      safeAddress,
      tokenAddress,
      0,
      payload,
      0,
      estimate.safeTxGas,
      estimate.dataGas,
      estimate.gasPrice,
      toBN(estimate.lastUsedNonce + 1).toString(),
      signatures,
      estimate.gasToken,
      ZERO_ADDRESS
    );
    return result;
  }

  async setSupplierInfoDID(
    safeAddress: string,
    infoDID: string,
    gasToken: string,
    options?: ContractOptions
  ): Promise<GnosisExecTx> {
    let from = options?.from ?? (await this.layer2Web3.eth.getAccounts())[0];
    let supplierManager = await getAddress('supplierManager', this.layer2Web3);
    let payload = await this.setSupplierInfoDIDPayload(infoDID);
    let estimate = await gasEstimate(this.layer2Web3, safeAddress, supplierManager, '0', payload, 0, gasToken);
    if (estimate.lastUsedNonce == null) {
      estimate.lastUsedNonce = -1;
    }
    let signatures = await signSafeTxAsRSV(
      this.layer2Web3,
      supplierManager,
      0,
      payload,
      0,
      estimate.safeTxGas,
      estimate.dataGas,
      estimate.gasPrice,
      estimate.gasToken,
      ZERO_ADDRESS,
      toBN(estimate.lastUsedNonce + 1),
      from,
      safeAddress
    );
    let result = await executeTransaction(
      this.layer2Web3,
      safeAddress,
      supplierManager,
      0,
      payload,
      0,
      estimate.safeTxGas,
      estimate.dataGas,
      estimate.gasPrice,
      toBN(estimate.lastUsedNonce + 1).toString(),
      signatures,
      estimate.gasToken,
      ZERO_ADDRESS
    );
    return result;
  }

  private transferTokenPayload(tokenAddress: string, recipient: string, amount: string): string {
    let token = new this.layer2Web3.eth.Contract(ERC20ABI as AbiItem[], tokenAddress);
    return token.methods.transfer(recipient, amount).encodeABI();
  }

  private async setSupplierInfoDIDPayload(infoDID: string): Promise<string> {
    let supplierManager = new this.layer2Web3.eth.Contract(
      SupplierManagerABI as AbiItem[],
      await getAddress('supplierManager', this.layer2Web3)
    );
    return supplierManager.methods.setSupplierInfoDID(infoDID).encodeABI();
  }
}

interface GraphQLSafeResult {
  id: string;
  owners: {
    owner: {
      id: string;
    };
  }[];
  tokens: {
    balance: string;
    token: {
      id: string;
      name: string;
      symbol: string;
    };
  }[];
  depot: {
    id: string;
    infoDid: string | null;
  } | null;
  prepaidCard: {
    id: string;
    customizationDID: string | null;
    issuingToken: {
      symbol: string;
      id: string;
    };
    spendBalance: string;
    issuer: { id: string };
    reloadable: boolean;
  } | null;
  merchant: {
    id: string;
    spendBalance: string;
    infoDid: string | null;
  };
}

function processSafeResult(safe: GraphQLSafeResult): Safe | undefined {
  let tokens: TokenInfo[] = [];
  for (let tokenDetail of safe.tokens) {
    tokens.push({
      tokenAddress: tokenDetail.token.id,
      balance: tokenDetail.balance,
      token: {
        name: tokenDetail.token.name,
        symbol: tokenDetail.token.symbol,
        // we should really get this from teh subgraph--but honestly having
        // a non-decimal 18 token messes so many other things up on-chain
        // that likely we'll never support a non-decimal 18 token
        decimals: 18,
      },
    });
  }
  let owners: string[] = [];
  for (let ownerInfo of safe.owners) {
    let {
      owner: { id: owner },
    } = ownerInfo;
    owners.push(owner);
  }
  if (safe.depot) {
    let depot: DepotSafe = {
      type: 'depot',
      address: safe.depot.id,
      infoDID: safe.depot.infoDid ? safe.depot.infoDid : undefined,
      tokens,
      owners,
    };
    return depot;
  } else if (safe.merchant) {
    let merchant: MerchantSafe = {
      type: 'merchant',
      address: safe.merchant.id,
      infoDID: safe.merchant.infoDid ? safe.merchant.infoDid : undefined,
      accumulatedSpendValue: parseInt(safe.merchant.spendBalance),
      tokens,
      owners,
    };
    return merchant;
  } else if (safe.prepaidCard) {
    let prepaidCard: PrepaidCardSafe = {
      type: 'prepaid-card',
      address: safe.prepaidCard.id,
      customizationDID: safe.prepaidCard.customizationDID ? safe.prepaidCard.customizationDID : undefined,
      issuingToken: safe.prepaidCard.issuingToken.id,
      spendFaceValue: parseInt(safe.prepaidCard.spendBalance),
      issuer: safe.prepaidCard.issuer.id,
      reloadable: safe.prepaidCard.reloadable,
      tokens,
      owners,
    };
    return prepaidCard;
  } else {
    let externalSafe: ExternalSafe = {
      type: 'external',
      address: safe.id,
      tokens,
      owners,
    };
    return externalSafe;
  }
}
