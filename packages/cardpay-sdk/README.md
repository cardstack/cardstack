# cardpay-sdk <!-- omit in toc -->
This is a package that provides an SDK to use the Cardpay protocol.

### Special Considerations <!-- omit in toc -->
 One item to note that all token amounts that are provided to the API must strings and be in units of `wei`. All token amounts returned by the API will also be in units of `wei`. You can use `Web3.utils.toWei()` and `Web3.utils.fromWei()` to convert to and from units of `wei`. Because ethereum numbers can be so large, it is unsafe to represent these natively in Javascript, and in fact it is very common for a smart contract to return numbers that are simply too large to be represented natively in Javascript. For this reason, within Javascript the only safe way to natively handle numbers coming from Ethereum is as a `string`. If you need to perform math on a number coming from Ethereum use the `BN` library.

- [`TokenBridgeForeignSide`](#tokenbridgeforeignside)
  - [`TokenBridgeForeignSide.unlockTokens`](#tokenbridgeforeignsideunlocktokens)
  - [`TokenBridgeForeignSide.relayTokens`](#tokenbridgeforeignsiderelaytokens)
  - [`TokenBridgeForeignSide.getSupportedTokens` (TBD)](#tokenbridgeforeignsidegetsupportedtokens-tbd)
- [`TokenBridgeHomeSide`](#tokenbridgehomeside)
  - [`TokenBridgeHomeSide.waitForBridgingCompleted`](#tokenbridgehomesidewaitforbridgingcompleted)
- [`Safes`](#safes)
  - [`Safes.view`](#safesview)
- [`PrepaidCard`](#prepaidcard)
  - [`PrepaidCard.create`](#prepaidcardcreate)
  - [`PrepaidCard.costForFaceValue` (TBD)](#prepaidcardcostforfacevalue-tbd)
  - [`PrepaidCard.payMerchant` (TBD)](#prepaidcardpaymerchant-tbd)
  - [`PrepaidCard.split` (TBD)](#prepaidcardsplit-tbd)
  - [`PrepaidCard.transfer` (TBD)](#prepaidcardtransfer-tbd)
- [`RevenuePool` (TBD)](#revenuepool-tbd)
  - [`RevenuePool.balanceOf` (TBD)](#revenuepoolbalanceof-tbd)
  - [`RevenuePool.withdraw` (TBD)](#revenuepoolwithdraw-tbd)
- [`RewardPool` (TBD)](#rewardpool-tbd)
  - [`RewardPool.balanceOf` (TBD)](#rewardpoolbalanceof-tbd)
  - [`RewardPool.withdraw` (TBD)](#rewardpoolwithdraw-tbd)
- [`getBlockHeight`](#getBlockHeight)
- [`getAddress`](#getaddress)
- [`getConstant`](#getconstant)
- [`networkIds`](#networkids)
- [ABI's](#abis)

## `TokenBridgeForeignSide`
The `TokenBridge` API is used to bridge tokens into the layer 2 network in which the Card Protocol runs. The `TokenBridgeForeignSide` class should be instantiated with your `Web3` instance that is configured to operate on a layer 1 network (like Ethereum Mainnet or Kovan).
```js
import { TokenBridgeForeignSide } from "@cardstack/cardpay-sdk";
let web3 = new Web3(myProvider);
let tokenBridge = new TokenBridgeForeignSide(web3); // Layer 1 web3 instance
```

### `TokenBridgeForeignSide.unlockTokens`
This call will perform an ERC-20 `approve` action on the tokens to grant the Token Bridge contract the ability bridge your tokens. This method is invoked with:
- The contract address of the token that you are unlocking. Note that the token address must be a supported stable coin token. Use the `TokenBridgeForeignSide.getSupportedTokens` method to get a list of supported tokens.
- The amount of tokens to unlock. This amount should be in units of `wei` and as string.
- You can optionally provide an object that specifies the from address, gas limit, and/or gas price as a third argument.

This method returns a promise that includes a web3 transaction receipt, from which you can obtain the transaction hash, ethereum events, and other details about the transaction https://web3js.readthedocs.io/en/v1.3.4/web3-eth-contract.html#id37.

```js
let txnReceipt = await tokenBridge.unlockTokens(
  "0x4F96Fe3b7A6Cf9725f59d353F723c1bDb64CA6Aa",
  new BN("1000000000000000000") // this is 1 token in wei
);
```
### `TokenBridgeForeignSide.relayTokens`
This call will invoke the token bridge contract to relay tokens that have been unlocked. It is always a good idea to relay the same number of tokens that were just unlocked. So if you unlocked 10 tokens, then you should subsequently relay 10 tokens. Once the tokens have been relayed to the layer 2 network they will be deposited in a Gnosis safe that you control in layer 2. You can use the `Safes.view` to obtain the address of the safe that you control in layer 2. Your safe will be reused for any subsequent tokens that you bridge into layer 2.

This method is invoked with the following parameters:
- The contract address of the token that you are unlocking. Note that the token address must be a supported stable coin token. Use the `TokenBridgeForeignSide.getSupportedTokens` method to get a list of supported tokens.
- The address of the layer 2 account that should own the resulting safe 
- The amount of tokens to unlock. This amount should be in units of `wei` and as a string.
- You can optionally provide an object that specifies the from address, gas limit, and/or gas price as a fourth argument.

This method returns a promise that includes a web3 transaction receipt, from which you can obtain the transaction hash, ethereum events, and other details about the transaction https://web3js.readthedocs.io/en/v1.3.4/web3-eth-contract.html#id37.

```js
let txnReceipt = await tokenBridge.relayTokens(
  "0x4F96Fe3b7A6Cf9725f59d353F723c1bDb64CA6Aa", // token address
  "0x7cc103485069bbba15799f5dac5c42e7bbb48b4d064e61548022bf04db1bfc19", // layer 2 recipient address
  new BN("1000000000000000000") // this is 1 token in wei
);
```

### `TokenBridgeForeignSide.getSupportedTokens` (TBD)


## `Safes`
The `Safes` API is used to query the card protocol about the gnosis safes in the layer 2 network in which the Card Protocol runs. This can includes safes in which bridged tokens are deposited as well as prepaid cards (which in turn are actually gnosis safes). The `Safes` class should be instantiated with your `Web3` instance that is configured to operate on a layer 2 network (like xDai or Sokol).
```js
import { Safes } from "@cardstack/cardpay-sdk";
let web3 = new Web3(myProvider);
let safes = new Safes(web3); // Layer 2 web3 instance
```

### `Safes.view`
This call is used to view the gnosis safes owned by a particular address in the layer 2 network in which the Card Protocol runs.

This method is invoked with the following parameters:
- Optionally the address of a safe owner. If no address is supplied, then the default account in your web3 provider's wallet will be used.

This method returns a promise that includes an array of all the gnosis safes owned by the specified address. The result is an object that is a `SafeInfo[]` type which conforms to the following shape:
```ts
interface SafeInfo {
  address: string;
  isPrepaidCard: boolean;
  tokens: TokenInfo[];
}
interface TokenInfo {
  tokenAddress: string;
  token: {
    name: string;
    symbol: string;
    decimals: number;
    logoUri: string;
  };
  balance: string; // balance is in wei
}
```

Which can be called like this:
```js
let safeDetails = await safes.view();
```

## `PrepaidCard`
The `PrepaidCard` API is used to create and interact with prepaid cards within the layer 2 network in which the Card Protocol runs. The `PrepaidCard` class should be instantiated with your `Web3` instance that is configured to operate on a layer 2 network (like xDai or Sokol).
```js
import { PrepaidCard } from "@cardstack/cardpay-sdk";
let web3 = new Web3(myProvider);
let prepaidCard = new PrepaidCard(web3); // Layer 2 web3 instance
```

### `PrepaidCard.create`
This call will create a new prepaid card from a gnosis safe, specifically a gnosis safe that holds tokens that were bridged to the layer 2 network from teh `TokenBridge` api. From this call you can create 1 or more prepaid cards from the `*.CPXD` layer 2 tokens (in the xDai network, for example). When a token is bridged to a layer 2 network like xDai, it will obtain a `*.CPXD` suffix, indicating that it can participate in the Card Protocol on xDai. The face value for the prepaid card does not include the amount of tokens consumed by the gas to create the card as well as fees to create a prepaid card.
```
total cost in *.CPXD = (Face value in § * token exchange rate) + fees + gas
```
Note that gas is charged in the `*.CPXD` token which will be deducted from your safe. You can use the `PrepaidCard.costForFaceValue` method to determine what the final cost for a card with a particular face value in units of **§** will be in the token of your choosing. You can use this amount to create the desired face value for your prepaid card.

This method is invoked with the following parameters:
- The address of the safe that you are using to pay for the prepaid card
- The contract address of the token that you wish to use to pay for the prepaid card. Note that the face value of the prepaid card will fluctuate based on the exchange rate of this token and the **§** unit.
- An array of amounts in units of `wei` as strings of the token specified in the previous parameter. Note that the face value for the prepaid card will this amount minus fees. Gas charges are applied after the card has been created and will be deducted directly from your safe and not effect the face value of the prepaid card. Note there is a maximum of 15 prepaid cards that can be created in a single transaction and a minimum face value of **§100** is enforced for each card.
- You can optionally provide an object that specifies the from address. The gas price and gas limit will be calculated by the card protocol and are not configurable.

```js
let daicpxd = await getAddress('daiCpxd', web3);
let result = await prepaidCard.create(
  safeAddress,
  daicpxd,
  [new BN("5000000000000000000")] // 5 DAI.CPXD tokens
);
```

This method returns a promise for a gnosis relay transaction object that has the following shape:
```ts
interface RelayTransaction {
  to: string;
  ethereumTx: {
    txHash: string;
    to: string;
    data: string;
    blockNumber: string;
    blockTimestamp: string;
    created: string;
    modified: string;
    gasUsed: string;
    status: number;
    transactionIndex: number;
    gas: string;
    gasPrice: string;
    nonce: string;
    value: string;
    from: string;
  };
  value: number;
  data: string;
  timestamp: string;
  operation: string;
  safeTxGas: number;
  dataGas: number;
  gasPrice: number;
  gasToken: string;
  refundReceiver: string;
  nonce: number;
  safeTxHash: string;
  txHash: string;
  transactionHash: string;
}
```

### `PrepaidCard.costForFaceValue` (TBD)
(provide options to get cost with and without gas taken into account)
### `PrepaidCard.payMerchant` (TBD)
### `PrepaidCard.split` (TBD)
### `PrepaidCard.transfer` (TBD)

## `RevenuePool` (TBD)
### `RevenuePool.balanceOf` (TBD)
### `RevenuePool.withdraw` (TBD)
## `RewardPool` (TBD)
### `RewardPool.balanceOf` (TBD)
### `RewardPool.withdraw` (TBD)

## `getAddress`
`getAddress` is a utility that will retrieve the contract address for a contract that is part of the Card Protocol in the specified network. The easiest way to use this function is to just pass your web3 instance to the function, and the function will query the web3 instance to see what network it is currently using. You can also just pass in the network name.

```js
let daiCpxdToken = await getAddress("daiCpxd", web3);
let daiToken = await getAddress("daiToken", web3);
let foreignBridge = await getAddress("foreignBridge", web3);
let homeBridge = await getAddress("homeBridge", web3);
let prepaidCardManager = await getAddress("prepaidCardManager", web3);
```

## `getConstant`
`getConstant` is a utility that will retrieve a network sensitive constant. The easiest way to use this function is to just pass your web3 instance to the function, and the function will query the web3 instance to see what network it is currently using. You can also just pass in the network name.

```js
let blockExplorer = await getConstant("blockExplorer", web3);
let rpcNode = await getConstant("rpcNode", "sokol");
let relayServiceURL = await getConstant("relayServiceURL", web3);
let transactionServiceURL = await getConstant("transactionServiceURL", web3);
```
## `networkIds`
`networkIds` is a POJO that maps a network name to it's ethereum network ID.
```js
let networkId = networkIds["sokol"]; // 77
```
Also, `networks` is an inverted `networkIds` POJO if you need to go in the other direction.
```js
let networkName = networks[77]; // "sokol"
```

## ABI's
All of the ABI's for the contracts that participate in the Card Protocol are also available:
```js
import {
  ERC20ABI,
  ERC677ABI,
  ForeignBridgeMediatorABI,
  PrepaidCardManagerABI } from "@cardstack/cardpay-sdk";
```