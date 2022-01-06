declare module 'web3-provider-engine' {
  import { Provider, JSONRPCRequestPayload, JSONRPCResponsePayload } from 'ethereum-protocol';
  interface Web3ProviderEngineOptions {
    pollingInterval?: number | undefined;
    blockTracker?: any;
    blockTrackerProvider?: any;
  }
  declare class Web3ProviderEngine implements Provider {
    constructor(options?: Web3ProviderEngineOptions);
    on(event: string, handler: (...args: any[]) => void): void;
    send(payload: JSONRPCRequestPayload): void;
    sendAsync(
      payload: JSONRPCRequestPayload,
      callback: (error: null | Error, response: JSONRPCResponsePayload) => void
    ): void;
    addProvider(provider: any): void;
    // start block polling
    start(callback?: () => void): void;
    // stop block polling
    stop(): void;
    emit(eventName: string, ...args): void;
  }
  export = Web3ProviderEngine;
}
