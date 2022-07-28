import { SubscribeBlockTracker } from 'eth-block-tracker';
import ProviderEngine from 'web3-provider-engine';
import { WebsocketProviderOptions } from 'web3-core-helpers';

//@ts-ignore need to patch SubscribeBlockTracker because this signature is wrong
export default class PatchedSubscribeBlockTracker extends SubscribeBlockTracker {
  _handleSubData(response: any): void {
    //@ts-ignore need to patch SubscribeBlockTracker because this signature is wrong
    super._handleSubData(null, response);
  }
  get provider() {
    //@ts-ignore need to expose the provider for updating
    return this._provider;
  }

  // Some RPC nodes don’t support subscribing to newHeads with {} parameters, so this removes that
  protected async _start(): Promise<void> {
    //@ts-ignore access private this._subscriptionId
    if (this._subscriptionId === undefined || this._subscriptionId === null) {
      try {
        //@ts-ignore access private this._call
        const blockNumber = (await this._call('eth_blockNumber')) as string;
        //@ts-ignore access private this._subscriptionId and this._call
        this._subscriptionId = (await this._call('eth_subscribe', 'newHeads')) as string;
        this.provider.on('data', this._handleSubData.bind(this));
        this._newPotentialLatest(blockNumber);
      } catch (e) {
        this.emit('error', e);
      }
    }
  }
}

type Constructor = new (...args: any[]) => {};

function ExtendProviderEngine<TBase extends Constructor>(Base: TBase) {
  return class ExtendingProviderEngine extends Base {
    get blockTracker(): PatchedSubscribeBlockTracker {
      return (this as any)._blockTracker;
    }
  };
}
export const ExtendedProviderEngine = ExtendProviderEngine(ProviderEngine);

import {
  WebsocketProvider as TypedWebsocketProvider, // Typings say that WebsocketProvider is a named export,
  default as UntypedWebsocketProvider, ////////// but it is actually the default export.
} from 'web3-providers-ws';

export declare class TypedWebsocketProviderWithConstructor extends TypedWebsocketProvider {
  constructor(host: string, options?: WebsocketProviderOptions);
}

export const WebsocketProvider: any = UntypedWebsocketProvider as unknown as TypedWebsocketProviderWithConstructor;
