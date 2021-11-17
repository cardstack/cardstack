import Web3 from 'web3';
import SupplierManagerABI from '../../contracts/abi/v0.8.5/supplier-manager';
import ERC20ABI from '../../contracts/abi/erc-20';
import { AbiItem } from 'web3-utils';
import { getAddress } from '../../contracts/addresses';
import { ContractOptions } from 'web3-eth-contract';
import { gasEstimate, executeTransaction, getNextNonceFromEstimate } from '../utils/safe-utils';
import { signSafeTx } from '../utils/signing-utils';
import BN from 'bn.js';
import { query } from '../utils/graphql';
import { TransactionReceipt } from 'web3-core';
import { TransactionOptions, waitForSubgraphIndexWithTxnReceipt, isTransactionHash } from '../utils/general-utils';
const { fromWei } = Web3.utils;

export type Safe = DepotSafe | PrepaidCardSafe | MerchantSafe | RewardSafe | ExternalSafe;
interface BaseSafe {
  address: string;
  createdAt: number;
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
  merchant: string;
  infoDID?: string;
}

export interface RewardSafe extends BaseSafe {
  type: 'reward';
  rewardProgramId: string;
}

export interface ExternalSafe extends BaseSafe {
  type: 'external';
}
export interface PrepaidCardSafe extends BaseSafe {
  type: 'prepaid-card';
  issuingToken: string;
  spendFaceValue: number;
  prepaidCardOwner: string;
  hasBeenUsed: boolean;
  issuer: string;
  reloadable: boolean;
  transferrable: boolean;
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

export interface Options {
  viewAll: boolean;
  type?: Safe['type'];
}
const defaultOptions: Options = { viewAll: false };

export interface ViewSafeResult {
  safe: Safe | undefined;
  blockNumber: number;
}
export interface ViewSafesResult {
  safes: Safe[];
  blockNumber: number;
}

const safeQueryFields = `
  id
  createdAt
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
    faceValue
    payments {
      id
    }
    issuer {
      id
    }
    owner {
      id
    }
    reloadable
  }
  merchant {
    id
    spendBalance
    infoDid
    merchant {
      id
    }
  }
  reward {
    id
    rewardee {
      id
    }
  }
`;

const safeQuery = `
  query ($id: ID!) {
    safe(id: $id) {
      ${safeQueryFields}
    }
    _meta {
      block {
        number
      }
    }
  }
`;

const safesQuery = `
  query($account: ID!) {
    account(id: $account) {
      safes(orderBy:ownershipChangedAt orderDirection:desc) {
        safe {
          ${safeQueryFields}
        }
      }
    }

    _meta {
      block {
        number
      }
    }
  }
`;

const safesFilteredQuery = `
  query($account: ID!, $type: String) {
    account(id: $account) {
      safes(orderBy:ownershipChangedAt orderDirection:desc, where: {type: $type}) {
        safe {
          ${safeQueryFields}
        }
      }
    }

    _meta {
      block {
        number
      }
    }
  }
`;

export async function viewSafe(network: 'xdai' | 'sokol', safeAddress: string): Promise<ViewSafeResult> {
  let {
    data: { safe, _meta },
  } = await query(network, safeQuery, { id: safeAddress });
  return {
    safe: processSafeResult(safe as GraphQLSafeResult),
    blockNumber: _meta.block.number,
  };
}

export default class Safes {
  constructor(private layer2Web3: Web3) {}

  async viewSafe(safeAddress: string): Promise<ViewSafeResult> {
    let {
      data: { safe, _meta },
    } = await query(this.layer2Web3, safeQuery, { id: safeAddress });

    return {
      safe: processSafeResult(safe as GraphQLSafeResult),
      blockNumber: _meta.block.number,
    };
  }

  async view(options?: Partial<Options>): Promise<ViewSafesResult>;
  async view(owner?: string): Promise<ViewSafesResult>;
  async view(owner?: string, options?: Partial<Options>): Promise<ViewSafesResult>;
  async view(ownerOrOptions?: string | Partial<Options>, options?: Partial<Options>): Promise<ViewSafesResult> {
    let owner: string;
    let _options: Options | undefined;
    if (typeof ownerOrOptions === 'string') {
      owner = ownerOrOptions;
    } else {
      owner = (await this.layer2Web3.eth.getAccounts())[0];
      _options = { ...defaultOptions, ...(ownerOrOptions ?? {}) };
    }
    _options = { ...defaultOptions, ...(options ?? _options ?? {}) };

    let account, _meta;
    if (options?.type) {
      let type = options.type === 'external' ? null : options.type;
      ({
        data: { account, _meta },
      } = await query(this.layer2Web3, safesFilteredQuery, { account: owner, type }));
    } else {
      ({
        data: { account, _meta },
      } = await query(this.layer2Web3, safesQuery, { account: owner }));
    }
    if (account == null) {
      return {
        safes: [],
        blockNumber: _meta.block.number,
      };
    }

    let { safes } = account;
    let result: Safe[] = [];
    for (let { safe } of safes as { safe: GraphQLSafeResult }[]) {
      let safeResult = processSafeResult(safe);
      if (safeResult) {
        if (_options.viewAll) {
          result.push(safeResult);
        } else if (safeResult.type === 'prepaid-card' && safeResult.spendFaceValue > 0) {
          result.push(safeResult);
        } else if (safeResult.type === 'merchant' || safeResult.type === 'depot' || safeResult.type === 'reward') {
          result.push(safeResult);
        }
      }
    }
    return {
      safes: result,
      blockNumber: _meta.block.number,
    };
  }

  // Note that the returned amount is in units of the token specified in the
  // function params, tokenAddress
  async sendTokensGasEstimate(
    safeAddress: string,
    tokenAddress: string,
    recipient: string,
    amount: string
  ): Promise<string> {
    let token = new this.layer2Web3.eth.Contract(ERC20ABI as AbiItem[], tokenAddress);
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
    let gasInToken = new BN(String(estimate.baseGas))
      .add(new BN(String(estimate.safeTxGas)))
      .mul(new BN(String(estimate.gasPrice)))
      .toString();
    return gasInToken;
  }

  async sendTokens(txnHash: string): Promise<TransactionReceipt>;
  async sendTokens(
    safeAddress: string,
    tokenAddress: string,
    recipient: string,
    amount: string,
    txnOptions?: TransactionOptions,
    contractOptions?: ContractOptions
  ): Promise<TransactionReceipt>;
  async sendTokens(
    safeAddressOrTxnHash: string,
    tokenAddress?: string,
    recipient?: string,
    amount?: string,
    txnOptions?: TransactionOptions,
    contractOptions?: ContractOptions
  ): Promise<TransactionReceipt> {
    if (isTransactionHash(safeAddressOrTxnHash)) {
      let txnHash = safeAddressOrTxnHash;
      return waitForSubgraphIndexWithTxnReceipt(this.layer2Web3, txnHash);
    }
    let safeAddress = safeAddressOrTxnHash;
    if (!tokenAddress) {
      throw new Error('tokenAddress must be specified');
    }
    if (!recipient) {
      throw new Error('recipient must be specified');
    }
    if (!amount) {
      throw new Error('amount must be specified');
    }
    let { nonce, onNonce, onTxnHash } = txnOptions ?? {};
    let from = contractOptions?.from ?? (await this.layer2Web3.eth.getAccounts())[0];
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
    if (nonce == null) {
      nonce = getNextNonceFromEstimate(estimate);
      if (typeof onNonce === 'function') {
        onNonce(nonce);
      }
    }

    let result = await executeTransaction(
      this.layer2Web3,
      safeAddress,
      tokenAddress,
      payload,
      estimate,
      nonce,
      await signSafeTx(this.layer2Web3, safeAddress, tokenAddress, payload, estimate, nonce, from)
    );

    let txnHash = result.ethereumTx.txHash;

    if (typeof onTxnHash === 'function') {
      await onTxnHash(txnHash);
    }
    return await waitForSubgraphIndexWithTxnReceipt(this.layer2Web3, txnHash);
  }

  async setSupplierInfoDID(txnHash: string): Promise<TransactionReceipt>;
  async setSupplierInfoDID(
    safeAddress: string,
    infoDID: string,
    gasToken: string,
    txnOptions?: TransactionOptions,
    contractOptions?: ContractOptions
  ): Promise<TransactionReceipt>;
  async setSupplierInfoDID(
    safeAddressOrTxnHash: string,
    infoDID?: string,
    gasToken?: string,
    txnOptions?: TransactionOptions,
    contractOptions?: ContractOptions
  ): Promise<TransactionReceipt> {
    if (isTransactionHash(safeAddressOrTxnHash)) {
      let txnHash = safeAddressOrTxnHash;
      return waitForSubgraphIndexWithTxnReceipt(this.layer2Web3, txnHash);
    }
    let safeAddress = safeAddressOrTxnHash;
    if (infoDID == null) {
      throw new Error('infoDID is required');
    }
    if (gasToken == null) {
      throw new Error('gasToken is required');
    }
    let { nonce, onNonce, onTxnHash } = txnOptions ?? {};
    let from = contractOptions?.from ?? (await this.layer2Web3.eth.getAccounts())[0];
    let supplierManager = await getAddress('supplierManager', this.layer2Web3);
    let payload = await this.setSupplierInfoDIDPayload(infoDID);
    let estimate = await gasEstimate(this.layer2Web3, safeAddress, supplierManager, '0', payload, 0, gasToken);
    if (nonce == null) {
      nonce = getNextNonceFromEstimate(estimate);
      if (typeof onNonce === 'function') {
        onNonce(nonce);
      }
    }
    let result = await executeTransaction(
      this.layer2Web3,
      safeAddress,
      supplierManager,
      payload,
      estimate,
      nonce,
      await signSafeTx(this.layer2Web3, safeAddress, estimate.gasToken, payload, estimate, nonce, from)
    );

    let txnHash = result.ethereumTx.txHash;

    if (typeof onTxnHash === 'function') {
      await onTxnHash(txnHash);
    }
    return await waitForSubgraphIndexWithTxnReceipt(this.layer2Web3, txnHash);
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
  createdAt: string;
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
    owner: {
      id: string;
    };
    payments: {
      id: string;
    }[];
    faceValue: string;
    issuer: { id: string };
    reloadable: boolean;
  } | null;
  merchant: {
    id: string;
    spendBalance: string;
    infoDid: string | null;
    merchant: {
      id: string;
    };
  };
  reward: {
    id: string;
    rewardProgramId: string;
    rewardee: {
      id: string;
    };
  };
}

function processSafeResult(safe: GraphQLSafeResult): Safe | undefined {
  if (!safe) {
    return;
  }

  let tokens: TokenInfo[] = [];
  let createdAt = parseInt(safe.createdAt);
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
      createdAt,
      owners,
    };
    return depot;
  } else if (safe.merchant) {
    let merchant: MerchantSafe = {
      type: 'merchant',
      address: safe.merchant.id,
      infoDID: safe.merchant.infoDid ? safe.merchant.infoDid : undefined,
      accumulatedSpendValue: parseInt(safe.merchant.spendBalance),
      merchant: safe.merchant.merchant.id,
      tokens,
      createdAt,
      owners,
    };
    return merchant;
  } else if (safe.prepaidCard) {
    let prepaidCard: PrepaidCardSafe = {
      type: 'prepaid-card',
      address: safe.prepaidCard.id,
      customizationDID: safe.prepaidCard.customizationDID ? safe.prepaidCard.customizationDID : undefined,
      issuingToken: safe.prepaidCard.issuingToken.id,
      spendFaceValue: parseInt(safe.prepaidCard.faceValue),
      issuer: safe.prepaidCard.issuer.id,
      hasBeenUsed: safe.prepaidCard.payments.length > 0,
      reloadable: safe.prepaidCard.reloadable,
      transferrable: safe.prepaidCard.payments.length === 0 && safe.prepaidCard.issuer.id === safe.prepaidCard.owner.id,
      prepaidCardOwner: safe.prepaidCard.owner.id,
      tokens,
      createdAt,
      owners,
    };
    return prepaidCard;
  } else if (safe.reward) {
    let reward: RewardSafe = {
      type: 'reward',
      address: safe.reward.id,
      rewardProgramId: safe.reward.rewardProgramId,
      tokens,
      createdAt,
      owners,
    };
    return reward;
  } else {
    let externalSafe: ExternalSafe = {
      type: 'external',
      address: safe.id,
      tokens,
      createdAt,
      owners,
    };
    return externalSafe;
  }
}
