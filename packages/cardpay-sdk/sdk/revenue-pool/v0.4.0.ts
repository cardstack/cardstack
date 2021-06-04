import Web3 from 'web3';
import { AbiItem } from 'web3-utils';
import { Contract, ContractOptions } from 'web3-eth-contract';
import RevenuePoolABI from '../../contracts/abi/v0.4.0/revenue-pool';
import ERC20ABI from '../../contracts/abi/erc-20';
import { getAddress } from '../../contracts/addresses.js';
import { ZERO_ADDRESS } from '../constants.js';
import { EventABI, RelayTransaction, getParamsFromEvent } from '../utils/safe-utils';
import { waitUntilTransactionMined } from '../utils/general-utils';
import { Signature, sign } from '../utils/signing-utils';
import { getSDK } from '../version-resolver';
import { getPayMerchantPayload, executePayMerchant } from '../prepaid-card/v0.4.0';

const { toBN, fromWei } = Web3.utils;

interface RegisterMerchantTx extends RelayTransaction {
  payment: number; // this is not safe to use! Need to fix in relay server
  prepaidCardTxHash: string; // this is a hash of the txn data--not to be confused with the overall txn hash
  tokenAddress: string;
}

interface RevenueTokenBalance {
  tokenSymbol: string;
  tokenAddress: string;
  balance: string; // balance is in wei
}

export default class RevenuePool {
  private revenuePool: Contract | undefined;

  constructor(private layer2Web3: Web3) {}

  async merchantRegistrationFee(): Promise<number> {
    // this is a SPEND amount which is a safe number to represent in javascript
    return Number(await (await this.getRevenuePool()).methods.merchantRegistrationFeeInSPEND().call());
  }

  async balances(merchantSafeAddress: string): Promise<RevenueTokenBalance[]> {
    let revenuePool = new this.layer2Web3.eth.Contract(
      RevenuePoolABI as AbiItem[],
      await getAddress('revenuePool', this.layer2Web3)
    );
    let tokenAddresses = (await revenuePool.methods.revenueTokens(merchantSafeAddress).call()) as string[];
    let result = await Promise.all(
      tokenAddresses.map(async (tokenAddress) => {
        const tokenContract = new this.layer2Web3.eth.Contract(ERC20ABI as AbiItem[], tokenAddress);
        let [tokenSymbol, balance] = await Promise.all([
          tokenContract.methods.symbol().call() as Promise<string>,
          revenuePool.methods.revenueBalance(merchantSafeAddress, tokenAddress).call() as Promise<string>,
        ]);
        return {
          tokenAddress,
          tokenSymbol,
          balance,
        };
      })
    );
    return result;
  }

  async registerMerchant(
    prepaidCardAddress: string,
    options?: ContractOptions
  ): Promise<{ merchantSafe: string; gnosisTxn: RegisterMerchantTx }> {
    let from = options?.from ?? (await this.layer2Web3.eth.getAccounts())[0];
    let prepaidCardMgrAddress = await getAddress('prepaidCardManager', this.layer2Web3);
    let prepaidCard = await getSDK('PrepaidCard', this.layer2Web3);
    let issuingToken = await prepaidCard.issuingToken(prepaidCardAddress);
    let weiAmount = await prepaidCard.convertFromSpendForPrepaidCard(
      prepaidCardAddress,
      await this.merchantRegistrationFee(),
      (issuingToken, balanceAmount, requiredTokenAmount) =>
        new Error(
          `Prepaid card does not have enough balance to register a merchant. The issuing token ${issuingToken} balance of prepaid card ${prepaidCardAddress} is ${fromWei(
            balanceAmount.toString()
          )}, payment amount in issuing token is ${fromWei(requiredTokenAmount)}`
        )
    );

    let payload = await getPayMerchantPayload(
      this.layer2Web3,
      prepaidCardAddress,
      ZERO_ADDRESS,
      issuingToken,
      weiAmount
    );
    if (payload.lastUsedNonce == null) {
      payload.lastUsedNonce = -1;
    }
    let signatures = await sign(
      this.layer2Web3,
      issuingToken,
      0,
      payload.data,
      0,
      payload.safeTxGas,
      payload.dataGas,
      payload.gasPrice,
      payload.gasToken,
      payload.refundReceiver,
      toBN(payload.lastUsedNonce + 1),
      from,
      prepaidCardAddress
    );
    let contractSignature: Signature = {
      v: 1,
      r: toBN(prepaidCardMgrAddress).toString(),
      s: 0,
    };
    // The hash for the signatures requires that owner signatures be sorted by address
    if (prepaidCardMgrAddress.toLowerCase() > from.toLowerCase()) {
      signatures = signatures.concat(contractSignature);
    } else {
      signatures = [contractSignature].concat(signatures);
    }

    let gnosisTxn = await executePayMerchant(
      this.layer2Web3,
      prepaidCardAddress,
      issuingToken,
      ZERO_ADDRESS,
      weiAmount,
      signatures,
      toBN(payload.lastUsedNonce + 1).toString()
    );
    let merchantSafe = await this.getMerchantSafeFromTxn(gnosisTxn.ethereumTx.txHash);
    return { merchantSafe, gnosisTxn };
  }

  private async getRevenuePool(): Promise<Contract> {
    if (this.revenuePool) {
      return this.revenuePool;
    }
    this.revenuePool = new this.layer2Web3.eth.Contract(
      RevenuePoolABI as AbiItem[],
      await getAddress('revenuePool', this.layer2Web3)
    );
    return this.revenuePool;
  }

  private async getMerchantSafeFromTxn(txnHash: string): Promise<string> {
    let revenuePoolAddress = await getAddress('revenuePool', this.layer2Web3);
    let txnReceipt = await waitUntilTransactionMined(this.layer2Web3, txnHash);
    return getParamsFromEvent(this.layer2Web3, txnReceipt, this.createMerchantEventABI(), revenuePoolAddress)[0]
      ?.merchantSafe;
  }

  private createMerchantEventABI(): EventABI {
    return {
      topic: this.layer2Web3.eth.abi.encodeEventSignature('MerchantCreation(address,address)'),
      abis: [
        {
          type: 'address',
          name: 'merchant',
        },
        {
          type: 'address',
          name: 'merchantSafe',
        },
      ],
    };
  }
}
