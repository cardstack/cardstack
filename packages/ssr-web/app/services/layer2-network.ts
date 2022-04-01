import Service from '@ember/service';
import config from '../config/environment';
import { inject as service } from '@ember/service';
import {
  Layer2ChainEvent,
  Layer2Web3Strategy,
} from '@cardstack/ssr-web/utils/web3-strategies/types';
import Layer2TestWeb3Strategy from '@cardstack/ssr-web/utils/web3-strategies/test-layer2';
import XDaiWeb3Strategy from '@cardstack/ssr-web/utils/web3-strategies/x-dai';
import SokolWeb3Strategy from '@cardstack/ssr-web/utils/web3-strategies/sokol';
import { reads } from 'macro-decorators';
import WalletInfo from '@cardstack/ssr-web/utils/wallet-info';
import {
  Emitter,
  SimpleEmitter,
  UnbindEventListener,
} from '@cardstack/ssr-web/utils/events';
import { action } from '@ember/object';
import HubAuthentication from '@cardstack/ssr-web/services/hub-authentication';
import { taskFor } from 'ember-concurrency-ts';
import Fastboot from 'ember-cli-fastboot/services/fastboot';
export default class Layer2Network
  extends Service
  implements Emitter<Layer2ChainEvent>
{
  @service declare hubAuthentication: HubAuthentication;
  @service declare fastboot: Fastboot;

  strategy!: Layer2Web3Strategy;
  simpleEmitter = new SimpleEmitter();
  @reads('strategy.isInitializing') declare isInitializing: boolean;
  @reads('strategy.isConnected', false) isConnected!: boolean;
  @reads('strategy.walletConnectUri') walletConnectUri: string | undefined;
  @reads('strategy.walletInfo', []) walletInfo!: WalletInfo;
  @reads('strategy.waitForAccount') waitForAccount!: Promise<void>;

  constructor(props: object | undefined) {
    super(props);
    if (this.fastboot.isFastBoot) {
      return;
    }

    switch (config.chains.layer2) {
      case 'xdai':
        this.strategy = new XDaiWeb3Strategy();
        break;
      case 'sokol':
        this.strategy = new SokolWeb3Strategy();
        break;
      case 'test':
        this.strategy = new Layer2TestWeb3Strategy();
        break;
    }

    this.strategy.on('disconnect', this.onDisconnect);
    this.strategy.on('incorrect-chain', this.onIncorrectChain);
    this.strategy.on('account-changed', this.onAccountChanged);
    this.strategy.on('websocket-disconnected', this.onWebsocketDisconnected);
    this.strategy.on('initialized', () => {
      this.simpleEmitter.emit('initialized');
    });

    taskFor(this.strategy.initializeTask).perform();
  }

  authenticate(): Promise<string> {
    return this.strategy.authenticate();
  }

  checkHubAuthenticationValid(authToken: string): Promise<boolean> {
    return this.strategy.checkHubAuthenticationValid(authToken);
  }

  disconnect() {
    return this.strategy.disconnect();
  }

  @action onDisconnect() {
    this.hubAuthentication.authToken = null;
    this.simpleEmitter.emit('disconnect');
  }

  @action onIncorrectChain() {
    this.simpleEmitter.emit('incorrect-chain');
  }

  @action onAccountChanged() {
    this.simpleEmitter.emit('account-changed');
  }

  @action onWebsocketDisconnected() {
    this.simpleEmitter.emit('websocket-disconnected');
  }

  on(event: Layer2ChainEvent, cb: Function): UnbindEventListener {
    return this.simpleEmitter.on(event, cb);
  }
}

// DO NOT DELETE: this is how TypeScript knows how to look up your services.
declare module '@ember/service' {
  interface Registry {
    'layer2-network': Layer2Network;
  }
}
