import ProviderEngine from 'web3-provider-engine';
//@ts-ignore no types
import Web3Subprovider from 'web3-provider-engine/subproviders/provider.js';
import Web3 from 'web3';

// This is a patched HttpProvider that will allow an HDWalletProvider to send
// transactions
export default class HttpProvider {
  constructor(url: string) {
    let engine = new ProviderEngine();
    // parity will barf if you include this in the payload
    // https://github.com/MetaMask/web3-provider-engine/issues/346
    //@ts-ignore hack to save parity
    engine._blockTracker._setSkipCacheFlag = false;

    let httpProvider = new Web3.providers.HttpProvider(url);
    //@ts-ignore we are caught in between different web3 provider versions, patching sendAsync
    httpProvider.sendAsync = httpProvider.send;

    let subprovider = new Web3Subprovider(httpProvider);
    subprovider.handleRequest = function (payload: any, _next: any, end: any) {
      if (typeof payload.skipCache !== 'undefined') {
        delete payload.skipCache;
      }
      // parity will barf if you include this in the payload
      // https://github.com/MetaMask/web3-provider-engine/issues/346
      //@ts-ignore annoying hack to cleanse payload for parity
      this.provider.sendAsync(payload, function (err: any, response: any) {
        if (err) {
          return end(err);
        }
        if (response.error) {
          return end(new Error(`error: ${response.error.message}, received from payload ${JSON.stringify(payload)}`));
        }
        end(null, response.result);
      });
    }.bind(subprovider);
    engine.addProvider(subprovider);

    //@ts-ignore Ugh... https://github.com/MetaMask/web3-provider-engine/issues/309
    engine.send = engine.sendAsync;

    engine.start();
    return engine;
  }
}
