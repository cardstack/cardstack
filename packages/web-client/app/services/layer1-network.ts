import Service from '@ember/service';
import config from '../config/environment';
import { Layer1Web3Strategy } from '../utils/web3-strategies/types';
import Layer1TestWeb3Strategy from '../utils/web3-strategies/test-layer1';
import EthWeb3Strategy from '../utils/web3-strategies/ethereum';
import KovanWeb3Strategy from '../utils/web3-strategies/kovan';
import { reads } from 'macro-decorators';
import WalletInfo from '../utils/wallet-info';
import { task } from 'ember-concurrency-decorators';
import { WalletProvider } from '../utils/wallet-providers';
import { BigNumber } from '@ethersproject/bignumber';

export default class Layer1Network extends Service {
  strategy!: Layer1Web3Strategy;
  @reads('strategy.isConnected', false) isConnected!: boolean;
  @reads('strategy.walletConnectUri') walletConnectUri: string | undefined;
  @reads('strategy.walletInfo', new WalletInfo([], -1)) walletInfo!: WalletInfo;
  @reads('strategy.waitForAccount') waitForAccount!: Promise<void>;
  @reads('strategy.chainName') chainName!: string;
  @reads('strategy.defaultTokenBalance') defaultTokenBalance:
    | BigNumber
    | undefined;
  @reads('strategy.daiBalance') daiBalance: BigNumber | undefined;
  @reads('strategy.cardBalance') cardBalance: BigNumber | undefined;

  constructor(props: object | undefined) {
    super(props);
    switch (config.chains.layer1) {
      case 'keth':
        this.strategy = new KovanWeb3Strategy();
        break;
      case 'eth':
        this.strategy = new EthWeb3Strategy();
        break;
      case 'test':
        this.strategy = new Layer1TestWeb3Strategy();
        break;
    }
  }

  connect(walletProvider: WalletProvider) {
    this.strategy.connect(walletProvider);
    return this.waitForAccount;
  }

  disconnect() {
    this.strategy.disconnect();
  }

  get hasAccount() {
    return this.walletInfo.accounts.length > 0;
  }

  @task *approve(amount: BigNumber, tokenSymbol: string): any {
    let txnReceipt = yield this.strategy.approve(amount, tokenSymbol);
    return txnReceipt;
  }

  @task *relayTokens(
    tokenSymbol: string,
    destinationAddress: string,
    amount: BigNumber
  ): any {
    let txnReceipt = yield this.strategy.relayTokens(
      tokenSymbol,
      destinationAddress,
      amount
    );
    return txnReceipt;
  }

  blockExplorerUrl(txnHash: string | undefined): string | undefined {
    return txnHash ? this.strategy.blockExplorerUrl(txnHash) : undefined;
  }

  bridgeExplorerUrl(txnHash: string) {
    return txnHash ? this.strategy.bridgeExplorerUrl(txnHash) : undefined;
  }
}

// DO NOT DELETE: this is how TypeScript knows how to look up your services.
declare module '@ember/service' {
  // eslint-disable-next-line no-unused-vars
  interface Registry {
    'layer1-network': Layer1Network;
  }
}
