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
