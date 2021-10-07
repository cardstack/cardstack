# cardpay-sdk <!-- omit in toc -->
This is a package that provides an SDK to use the Cardpay protocol.

### Special Considerations <!-- omit in toc -->
 One item to note that all token amounts that are provided to the API must strings and be in units of `wei`. All token amounts returned by the API will also be in units of `wei`. You can use `Web3.utils.toWei()` and `Web3.utils.fromWei()` to convert to and from units of `wei`. Because ethereum numbers can be so large, it is unsafe to represent these natively in Javascript, and in fact it is very common for a smart contract to return numbers that are simply too large to be represented natively in Javascript. For this reason, within Javascript the only safe way to natively handle numbers coming from Ethereum is as a `string`. If you need to perform math on a number coming from Ethereum use the `BN` library.

- [Function Parameters](#function-parameters)
  - [TransactionOptions](#transactionoptions)
    - [Nonce](#nonce)
    - [Transaction Hash](#transaction-hash)
- [`getSDK`](#getsdk)
- [`Assets`](#assets)
  - [`Assets.getNativeTokenBalance`](#assetsgetnativetokenbalance)
  - [`Assets.getBalanceForToken`](#assetsgetbalancefortoken)
  - [`Assets.getTokenInfo`](#assetsgettokeninfo)
- [`TokenBridgeForeignSide`](#tokenbridgeforeignside)
  - [`TokenBridgeForeignSide.unlockTokens`](#tokenbridgeforeignsideunlocktokens)
  - [`TokenBridgeForeignSide.relayTokens`](#tokenbridgeforeignsiderelaytokens)
  - [`TokenBridgeForeignSide.claimBridgedTokens`](#tokenbridgeforeignsideclaimbridgedtokens)
  - [`TokenBridgeForeignSide.getSupportedTokens` (TBD)](#tokenbridgeforeignsidegetsupportedtokens-tbd)
- [`TokenBridgeHomeSide`](#tokenbridgehomeside)
  - [`TokenBridgeHomeSide.withdrawlLimits`](#tokenbridgehomesidewithdrawllimits)
  - [`TokenBridgeHomeSide.relayTokens`](#tokenbridgehomesiderelaytokens)
  - [`TokenBridgeHomeSide.waitForBridgingValidation`](#tokenbridgehomesidewaitforbridgingvalidation)
  - [`TokenBridgeHomeSide.waitForBridgingToLayer2Completed`](#tokenbridgehomesidewaitforbridgingtolayer2completed)
- [`Safes`](#safes)
  - [`Safe.viewSafe`](#safeviewsafe)
  - [`Safes.view`](#safesview)
  - [`Safes.sendTokensGasEstimate`](#safessendtokensgasestimate)
  - [`Safes.sendTokens`](#safessendtokens)
  - [`Safes.setSupplierInfoDID`](#safessetsupplierinfodid)
- [`PrepaidCard`](#prepaidcard)
  - [`PrepaidCard.create`](#prepaidcardcreate)
  - [`PrepaidCard.canSplit`](#prepaidcardcansplit)
  - [`PrepaidCard.split`](#prepaidcardsplit)
  - [`PrepaidCard.canTransfer`](#prepaidcardcantransfer)
  - [`PrepaidCard.transfer`](#prepaidcardtransfer)
  - [`PrepaidCard.priceForFaceValue`](#prepaidcardpriceforfacevalue)
  - [`PrepaidCard.gasFee`](#prepaidcardgasfee)
  - [`PrepaidCard.getPaymentLimits`](#prepaidcardgetpaymentlimits)
  - [`PrepaidCard.payMerchant`](#prepaidcardpaymerchant)
- [`PrepaidCardMarket`](#prepaidcardmarket)
  - [`PrepaidCardMarket.isPaused`](#prepaidcardmarketispaused)
  - [`PrepaidCardMarket.getSKUInfo`](#prepaidcardmarketgetskuinfo)
  - [`PrepaidCardMarket.getInventory`](#prepaidcardmarketgetinventory)
  - [`PrepaidCardMarket.addToInventory`](#prepaidcardmarketaddtoinventory)
  - [`PrepaidCardMarket.removeFromInventory`](#prepaidcardmarketremovefrominventory)
  - [`PrepaidCardMarket.setAsk`](#prepaidcardmarketsetask)
- [`RevenuePool`](#revenuepool)
  - [`RevenuePool.merchantRegistrationFee`](#revenuepoolmerchantregistrationfee)
  - [`RevenuePool.registerMerchant`](#revenuepoolregistermerchant)
  - [`RevenuePool.balances`](#revenuepoolbalances)
  - [`RevenuePool.claimGasEstimate`](#revenuepoolclaimgasestimate)
  - [`RevenuePool.claim`](#revenuepoolclaim)
- [`RewardPool`](#rewardpool)
  - [`RewardPool.rewardTokenBalance`](#rewardpoolrewardtokenbalance)
- [`RewardPool.addRewardTokens`](#rewardpooladdrewardtokens)
  - [`RewardPool.claim`](#rewardpoolclaim)
- [`RewardManager`](#rewardmanager)
- [`RewardManager.registerRewardProgram`](#rewardmanagerregisterrewardprogram)
- [`RewardManager.registerRewardee`](#rewardmanagerregisterrewardee)
- [`LayerOneOracle`](#layeroneoracle)
  - [`LayerOneOracle.ethToUsd`](#layeroneoracleethtousd)
  - [LayerOneOracle.getEthToUsdConverter](#layeroneoraclegetethtousdconverter)
  - [`LayerOneOracle.getUpdatedAt`](#layeroneoraclegetupdatedat)
- [`LayerTwoOracle`](#layertwooracle)
  - [`LayerTwoOracle.convertToSpend`](#layertwooracleconverttospend)
  - [`LayerTwoOracle.convertFromSpend`](#layertwooracleconvertfromspend)
  - [`LayerTwoOracle.getUSDPrice`](#layertwooraclegetusdprice)
  - [LayerTwoOracle.getUSDConverter](#layertwooraclegetusdconverter)
  - [`LayerTwoOracle.getETHPrice`](#layertwooraclegetethprice)
  - [`LayerTwoOracle.getUpdatedAt`](#layertwooraclegetupdatedat)
- [`HubAuth` (TODO)](#hubauth-todo)
- [`getAddress`](#getaddress)
- [`getOracle`](#getoracle)
- [`getConstant`](#getconstant)
- [`networkIds`](#networkids)
- [ABI's](#abis)

## Function Parameters
### TransactionOptions

All the APIs that mutate the state of the blockchain have an overload that accepts a transaction hash
as a single argument. This overload allows for resuming interrupted calls with a consistent return type.

In addition, the normal overloads of these APIs accept a TransactionOptions arg with options related to
nonce and the transaction hash.

#### Nonce
TransactionOptions has 2 optional parameters for nonce:
- `onNonce: (nonce: BN) => void`
- `nonce: BN`

The purpose of these nonce parameters are to allow the client to reattempt sending the transaction. Specifically this can be used to handle re-requesting a wallet to sign a transaction. When the `nonce` parameter is not specified, then the SDK will use the next available nonce for the transaction based on the transaction count for the EOA or safe (as the case may be). The `onNonce` callback will return the next available nonce (which is the nonce included in the signing request for the wallet). If the caller wishes to re-attempt sending the same transaction, the caller can specify the `nonce` to use when re-signing the transaction based on the nonce that was provided from the original `onNonce` callback. This will prevent the scenarios where the nonce will be increased on when the caller wants to force the wallet to resign the transaction. Care should be take though not to reuse a `nonce` value associated with a completed transaction. Such a situation could lead to the transaction being rejected because the nonce value is too low, or because the txn hash is identical to an already mined transaction.

#### Transaction Hash
TransactionOptions has an optional parameter for obtaining the transaction hash:
- `onTxnHash(txnHash: string) => unknown`

The promise returned by all the API's that mutate the state of the blockchain will resolve after the transaction has been mined with a transaction receipt. In order for callers of the SDK to obtain the transaction hash (for purposes of tracking the transaction) before the transaction has been mined, all API's that mutate the state of the blockchain will also contain a callback `onTxnHash` that callers can use to obtain the transaction hash as soon as it is available.

## `getSDK`
The cardpay SDK will automatically obtain the latest API version that works with the on-chain contracts. In order to obtain an API you need to leverage the `getSDK()` function and pass to it the API that you wish to work with, as well as any parameters necessary for obtaining an API (usually just an instance of Web3). This function then returns a promise for the requested API. For example, to obtain the `Safes` API, you would call:
```js
import { getSDK } from "@cardstack/cardpay-sdk";
let safesAPI = await getSDK('Safes', web3);
```

## `Assets`
Thie `Assets` API is used issue queries for native coin balances and ERC-20 token balances, as well as to get ERC-20 token info. The `Assets` API can be obtained from `getSDK()` with a `Web3` instance that is configured to operate on either layer 1 or layer 2, depending on where the asset you wish to query lives.
```js
import { getSDK } from "@cardstack/cardpay-sdk";
let web3 = new Web3(myProvider);
let assetAPI = await getSDK('Assets', web3);
```

### `Assets.getNativeTokenBalance`
This call returns the balance in native token for the specified address. So in Ethereum mainnet, this would be the ether balance. In xDai this would be the DAI token balance. This call returns a promise for the native token amount as a string in units of `wei`. If no address is provided, then the balance of the first address in the wallet will be retrieved.
```js
let assetsAPI = await getSDK('Assets', web3);
let etherBalance = await assetsAPI.getNativeTokenBalance(walletAddress);
```

### `Assets.getBalanceForToken`
This call returns the balance in for an ERC-20 token from the specified address. This call returns a promise for the token amount as a string in units of `wei`. If no token holder address is provided, then the balance of the first address in the wallet will be retrieved.
```js
let assetsAPI = await getSDK('Assets', web3);
let cardBalance = await assetsAPI.getBalanceForToken(cardTokenAddress, walletAddress);
```

### `Assets.getTokenInfo`
This call returns ERC-20 token information: the token name, the token symbol, and the token decimals for an ERC-20 token.
```js
let assetsAPI = await getSDK('Assets', web3);
let { name, symbol, decimals } = await assetsAPI.getTokenInfo(cardTokenAddress);
```
The response of this call is a promise for an object shaped like:
```ts
{
  decimals: number;
  name: string;
  symbol: string;
}
```

## `TokenBridgeForeignSide`
The `TokenBridgeForeignSide` API is used to bridge tokens into the layer 2 network in which the Card Protocol runs. The `TokenBridgeForeignSide` API can be obtained from `getSDK()` with a `Web3` instance that is configured to operate on a layer 1 network (like Ethereum Mainnet or Kovan).
```js
import { getSDK } from "@cardstack/cardpay-sdk";
let web3 = new Web3(myProvider); // Layer 1 web3 instance
let tokenBridge = await getSDK('TokenBridgeForeignSide', web3);
```

### `TokenBridgeForeignSide.unlockTokens`
This call will perform an ERC-20 `approve` action on the tokens to grant the Token Bridge contract the ability bridge your tokens. This method is invoked with:
- The contract address of the token that you are unlocking. Note that the token address must be a supported stable coin token. Use the `TokenBridgeForeignSide.getSupportedTokens` method to get a list of supported tokens.
- The amount of tokens to unlock. This amount should be in units of `wei` and as string.
- You can optionally provide an object that specifies the nonce, onNonce callback, and/or onTxnHash callback as a third argument.
- You can optionally provide an object that specifies the from address, gas limit, and/or gas price as a fourth argument.

This method returns a promise that includes a web3 transaction receipt, from which you can obtain the transaction hash, ethereum events, and other details about the transaction https://web3js.readthedocs.io/en/v1.3.4/web3-eth-contract.html#id37.

```js
let txnReceipt = await tokenBridge.unlockTokens(
  "0x4F96Fe3b7A6Cf9725f59d353F723c1bDb64CA6Aa",
  new BN("1000000000000000000") // this is 1 token in wei
);
```
### `TokenBridgeForeignSide.relayTokens`
This call will invoke the token bridge contract to relay tokens that have been unlocked in layer 1 and relay them to layer 2. It is always a good idea to relay the same number of tokens that were just unlocked. So if you unlocked 10 tokens, then you should subsequently relay 10 tokens. Once the tokens have been relayed to the layer 2 network they will be deposited in a Gnosis safe that you control in layer 2. You can use the `Safes.view` to obtain the address of the safe that you control in layer 2. Your safe will be reused for any subsequent tokens that you bridge into layer 2.

This method is invoked with the following parameters:
- The layer 1 contract address of the token that you are unlocking. Note that the token address must be a supported stable coin token. Use the `TokenBridgeForeignSide.getSupportedTokens` method to get a list of supported tokens.
- The address of the layer 2 account that should own the resulting safe
- The amount of tokens to unlock. This amount should be in units of `wei` and as a string.
- You can optionally provide an object that specifies the nonce, onNonce callback, and/or onTxnHash callback as a fourth argument.
- You can optionally provide an object that specifies the from address, gas limit, and/or gas price as a fifth argument.

This method returns a promise that includes a web3 transaction receipt, from which you can obtain the transaction hash, ethereum events, and other details about the transaction https://web3js.readthedocs.io/en/v1.3.4/web3-eth-contract.html#id37.

```js
let txnReceipt = await tokenBridge.relayTokens(
  "0x4F96Fe3b7A6Cf9725f59d353F723c1bDb64CA6Aa", // token address
  "0x7cc103485069bbba15799f5dac5c42e7bbb48b4d064e61548022bf04db1bfc19", // layer 2 recipient address
  new BN("1000000000000000000") // this is 1 token in wei
);
```

### `TokenBridgeForeignSide.claimBridgedTokens`
This call will allow the recipient of tokens bridge from layer 2 to layer 1 to be able to claim their bridge tokens in layer 1.

This method is invoked with the following parameters (which are output from `TokenBridgeHomeSide.waitForBridgingValidation`):
- The `messageId` of the bridging request
- The `encodedData` of the bridging request
- The `signatures` of the bridge validators

```js
let txnReceipt = await tokenBridge.claimBridgedTokens(messageId, encodedData, signatures);
```

This method returns a promise for a web3 transaction receipt.

### `TokenBridgeForeignSide.getSupportedTokens` (TBD)

## `TokenBridgeHomeSide`
The `TokenBridgeHomeSide` API is used to bridge tokens into the layer 2 network in which the Card Protocol runs. The `TokenBridgeHomeSide` API can be obtained from `getSDK()` with a `Web3` instance that is configured to operate on a layer 2 network (like xDai or Sokol).
```js
import { getSDK } from "@cardstack/cardpay-sdk";
let web3 = new Web3(myProvider); // Layer 2 web3 instance
let tokenBridge = await getSDK('TokenBridgeHomeSide', web3);
```

### `TokenBridgeHomeSide.withdrawlLimits`
This call will return the minimum and maximum withdrawal limits as a string in units of `wei` for bridging a token to layer 1. This method is invoked with the layer 2 CPXD token address of the CPXD token being withdrawn.

```js
let { min, max } = await tokenBridge.getWithdrawalLimits(daiTokenAddress);
```

This method returns:
```ts
Promise<{ min: string; max: string; }>
```

### `TokenBridgeHomeSide.relayTokens`
This call will invoke the token bridge contract to relay tokens from a layer 2 safe into the account specified in layer 1.

This method is invoked with the following parameters:
- The layer 2 safe address that contains the tokens to be relayed to layer 1
- The layer 2 token address of the tokens to be relayed
- The address of the layer 1 recipient that will receive the tokens in layer 1
- The amount of tokens to relay as a string in units of `wei`. Note that in addition to the amount of tokens being relayed, the safe will also be changed the layer 2 gas costs for performing the relay as well (the gas cost will be charged in the same tokens as is being relayed). So the safe must have a balance that includes both the amount being relayed as well as the layer 2 gas charged in order to perform the relay.

```js
let result = await tokenBridge.relayTokens(
  layer2SafeAddress,
  tokenAddress,
  layer1RecipientAddress,
  amountInWei
);
```

This method returns a promise for a web3 transaction receipt.

### `TokenBridgeHomeSide.waitForBridgingValidation`
This call waits for the token bridge validators to perform their necessary signatures on the token bridge request from layer 2 to layer 1. After the bridge validators have signed the bridging request, this call will return a `messageId`, `encodedData`, and `signatures` for the bridging request. These items can then be used to claim the bridged tokens in layer 1.

This method is invoked with:
- The block height of layer 2 before the relayTokens call was initiated on the home side of the bridge. Get it with `await layer2Web3.eth.getBlockNumber()`
- The layer 2 transaction hash for the bridging transaction (the result of `TokenBridgeHomeSide.relayTokens`).

```js
let {
  messageId,
  encodedData,
  signatures
} = await tokenBridge.waitForBridgingValidation(fromBlock, txnHash);
```

 This call returns a promise in the shape of:
```ts
Promise<{
  messageId: string,
  encodedData: string,
  signatures: string[]
}>
```



### `TokenBridgeHomeSide.waitForBridgingToLayer2Completed`
This call will listen for a `TokensBridgedToSafe` event emitted by the TokenBridge home contract that has a recipient matching the specified address. The starting layer 2 block height should be captured before the call to relayTokens is made to begin bridging. It is used to focus the search and avoid matching on a previous bridging for this user.

This method is invoked with the following parameters:
- The address of the layer 2 account that will own the resulting safe (passed as receiver to relayTokens call)
- The block height of layer 2 before the relayTokens call was initiated on the foreign side of the bridge. Get it with `await layer2Web3.eth.getBlockNumber()`

This method returns a promise that includes a web3 transaction receipt for the layer 2 transaction, from which you can obtain the transaction hash, ethereum events, and other details about the transaction https://web3js.readthedocs.io/en/v1.3.4/web3-eth-contract.html#id37.


```js
let txnReceipt = await tokenBridge.waitForBridgingToLayer2Completed(
  recipientAddress
  startingBlockHeight,
);
```

## `Safes`
The `Safes` API is used to query the card protocol about the gnosis safes in the layer 2 network in which the Card Protocol runs. This can includes safes in which bridged tokens are deposited as well as prepaid cards (which in turn are actually gnosis safes). The `Safes` API can be obtained from `getSDK()` with a `Web3` instance that is configured to operate on a layer 2 network (like xDai or Sokol).
```js
import { getSDK } from "@cardstack/cardpay-sdk";
let web3 = new Web3(myProvider); // Layer 2 web3 instance
let safes = await getSDK('Safes', web3);
```

### `Safe.viewSafe`
This call is used to view a specific safe in the layer 2 network in which the Card Protocol runs.

This method is invoked with the following parameters:
  - safe address

This method returns a promise for an object that is a `Safe` type:
Which can be called like this:
```js
let safeDetails = await safes.viewSafe(safeAddress);
```

### `Safes.view`
This call is used to view all the gnosis safes owned by a particular address in the layer 2 network in which the Card Protocol runs.

This method is invoked with the following parameters:
- Optionally the address of a safe owner. If no address is supplied, then the default account in your web3 provider's wallet will be used.

This method returns a promise that includes an array of all the gnosis safes owned by the specified address. The result is an object that is a `Safe[]` type which conforms to the `Safe` shape below:

```ts
export type Safe = DepotSafe | PrepaidCardSafe | MerchantSafe | ExternalSafe;
interface BaseSafe {
  address: string;
  tokens: TokenInfo[];
}
interface DepotSafe extends BaseSafe {
  type: 'depot';
  infoDID: string | undefined;
}
interface MerchantSafe extends BaseSafe {
  type: 'merchant';
  infoDID: string | undefined;
}
interface ExternalSafe extends BaseSafe {
  type: 'external';
}
interface PrepaidCardSafe extends BaseSafe {
  type: 'prepaid-card';
  issuingToken: string;
  spendFaceValue: number;
  issuer: string;
  reloadable: boolean;
  customizationDID: string | undefined;
}
```

Which can be called like this:
```js
let safeDetails = await safes.view();
```

### `Safes.sendTokensGasEstimate`
This call will return the gas estimate for sending tokens from a safe.

The parameters to this function are:
- The safe address to send the tokens from
- The token address of the tokens being sent
- The recipient of the tokens
- The amount of tokens that are being sent string in units of `wei`

```ts
let result = await safes.sendTokensGasEstimate(depotSafeAddress, daiCpxdAddress, aliceAddress, toWei("10"));
```

This method returns a promise for the amount of the tokens specified as the token address in the parameters that are estimated to be used to pay for gas as a string in units of `wei`.


### `Safes.sendTokens`
This call is used to send tokens from a gnosis safe to an arbitrary address in the layer 2 network. Note that the gas will be paid with the token you are transferring so there must be enough token balance in teh safe to cover both the transferred amount of tokens and gas.

This method is invoked with the following parameters:
- the address of the gnosis safe
- the address of the token contract
- the address of the recipient
- the amount of tokens to send as a string in units of `wei`
- optionally the address of a safe owner. If no address is supplied, then the default account in your web3 provider's wallet will be used.

```js
let cardCpxd = await getAddress('cardCpxd', web3);
let result = await safes.sendTokens(
  depotSafeAddress,
  cardCpxd,
  relayTxnFunderAddress
  [10000000000000000000000]
);
```

This method returns a promise for a web3 transaction receipt.

### `Safes.setSupplierInfoDID`
This call will allow a supplier to customize their appearance within the cardpay ecosystem by letting them set an info DID, that when used with a DID resolver can retrieve supplier info, such as their name, logo, URL, etc.
The parameters to this call are:
- The supplier's depot safe address (the safe that was assigned to the supplier when they bridged tokens into L2)
- The DID string that can be resolved to a DID document representing the supplier's information.
- The token address that you want to use to pay for gas for this transaction. This should be an address of a token in the depot safe.
```js
await safes.setSupplierInfoDID(supplierDepotAddress, infoDID, daiCpxdAddress);
```
This method returns a promise for a web3 transaction receipt.
## `PrepaidCard`
The `PrepaidCard` API is used to create and interact with prepaid cards within the layer 2 network in which the Card Protocol runs. The `PrepaidCard` API can be obtained from `getSDK()` with a `Web3` instance that is configured to operate on a layer 2 network (like xDai or Sokol).
```js
import { getSDK } from "@cardstack/cardpay-sdk";
let web3 = new Web3(myProvider); // Layer 2 web3 instance
let prepaidCard = await getSDK('PrepaidCard', web3);
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
- An array of face values in units of **§** SPEND as numbers. Note there is a maximum of 15 prepaid cards that can be created in a single transaction and a minimum face value of **§100** is enforced for each card.
- The address of the prepaid card market to create the prepaid card within. Set to `undefined` to not place to newly created prepaid card in the market
- A DID string that represents the customization for the prepaid card. The customization for a prepaid card can be retrieved using a DID resolver with this DID. If there is no customization an `undefined` value can be specified here.
- You can optionally provide a callback to obtain the prepaid card addresses before the creation process is complete
- You can optionally provide a TransactionOptions argument, to obtain the nonce or transaction hash of the operation before the creation process is complete
- You can optionally provide a callback to obtain a hook to know when the gas has been loaded into the prepaid card before the creation process is complete
- You can optionally provide an object that specifies the "from" address. The gas price and gas limit will be calculated by the card protocol and are not configurable.

```js
let daicpxd = await getAddress('daiCpxd', web3);
let result = await prepaidCard.create(
  safeAddress,
  daicpxd,
  [5000], // §5000 SPEND face value
  undefined,
  "did:cardstack:56d6fc54-d399-443b-8778-d7e4512d3a49"
);
```

This method returns a promise for an object shaped like:
```ts
{
  prepaidCards: PrepaidCardSafe[]; // from Safes.view
  txnReceipt: TransactionReceipt;
}
```

### `PrepaidCard.faceValue`
This call will return a promise for the most current face value of a prepaid card.
```js
let faceValue = await prepaidCard.faceValue(prepaidCardAddress);
```

### `PrepaidCard.canSplit`
This call will return a promise for a boolean indicating if the prepaid card can be split.
```js
let canSplit = await prepaidCard.canSplit(prepaidCardAddress);
```

### `PrepaidCard.split`
This call will use a prepaid card as the source of funds when creating more prepaid cards, in effect "splitting" the prepaid card being used to fund the transaction. Prepaid cards created from the split command are automatically placed in the PrepaidCardInventory. (Note that the prepaid card that is used to fund the creation of more prepaid cards may not be transferred and is considered the issuer's own personal prepaid card.) The creation mechanisms for prepaid cards created via a `PrepaidCard.split` are identical to `PrepaidCard.create` in terms of the total cost and gas charges.

This method is invoked with the following parameters:
- The address of the prepaid card that you are using to fund the creation of more prepaid cards
- An array of face values in units of **§** SPEND as numbers. Note there is a maximum of 15 prepaid cards that can be created in a single transaction and a minimum face value of **§100** is enforced for each card.
- The address of the prepaid card market to create the prepaid card within. Set to `undefined` to place the newly created prepaid cards in the default market (Cardstack issuer via Wyre). Note that all split cards must go into a market.
- A DID string that represents the customization for the prepaid card. The customization for a prepaid card can be retrieved using a DID resolver with this DID. If there is no customization an `undefined` value can be specified here.
- You can optionally provide a callback to obtain the prepaid card addresses before the creation process is complete
- You can optionally provide a callback to obtain a hook to know when the gas has been loaded into the prepaid card before the creation process is complete
- You can optionally provide an object that specifies the "from" address. The gas price and gas limit will be calculated by the card protocol and are not configurable.

```js
let result = await prepaidCard.split(
  prepaidCardAddress,
  [5000, 4000], // split into 2 cards: §5000 SPEND face value and §4000 SPEND face value
  undefined,
  "did:cardstack:56d6fc54-d399-443b-8778-d7e4512d3a49"
);
```

This method returns a promise for an object shaped like:
```ts
{
  prepaidCards: PrepaidCardSafe[]; // from Safes.view
  txReceipt: TransactionReceipt;
  sku: string; // inventory SKU of the created prepaid cards
}
```

### `PrepaidCard.canTransfer`
This call will return a promise for a boolean indicating if the prepaid card can be transferred.
```js
let canTransfer = await prepaidCard.canTransfer(prepaidCardAddress);
```

### `PrepaidCard.transfer`
This call will transfer a prepaid card from an issuer to a customer. Note that currently, once a prepaid card has been transferred to a customer (and EOA that did not create the prepaid card), then it becomes no longer transferrable. Additionally, if a prepaid card was used to fund a prepaid card split, the funding prepaid card also becomes non-transferrable, as it is considered the issuer's own personal prepaid card at that point.

This method is invoked with the following parameters:
- The address of the prepaid card to be transferred
- The address of the new prepaid card owner
- You can optionally provide an object that specifies the "from" address. The gas price and gas limit will be calculated by the card protocol and are not configurable.

```js
let result = await prepaidCard.transfer(prepaidCardAddress, newOwner);
```

This method returns a promise for a web3 transaction receipt.

### `PrepaidCard.priceForFaceValue`
This call will return the price in terms of the specified token of how much it costs to have a face value in the specified units of SPEND (**§**). This takes into account both the exchange rate of the specified token as well as gas fees that are deducted from the face value when creating a prepaid card. Note though, that the face value of the prepaid card in SPEND will drift based on the exchange rate of the underlying token used to create the prepaid card. (However, this drift should be very slight since we are using *stable* coins to purchase prepaid cards (emphasis on "stable"). Since the units of SPEND are very small relative to wei (**§** 1 === $0.01 USD), the face value input is a number type. This API returns the amount of tokens required to achieve a particular face value as a string in units of `wei` of the specified token.
```js
// You must send 'amountInDai' to the prepaidCardManager contract
// to achieve a prepaid card with §5000 face value
let amountInDAI = await prepaidCard.priceForFaceValue(daiCpxdAddress, 5000);
```

Note that if you are creating multiple cards or splitting cards, use this API to ensure the amount to provision for each prepaid card you want to create in order to achieve teh desired face values for each of the prepaid cards created.

### `PrepaidCard.gasFee`
This call will return the gas fee in terms of the specified token for the creation of a prepaid card. All prepaid cards will be seeded with some `CARD.CPXD` in order to pay our gnosis safe relayer for gas. In order to offset these costs, a small fee will be charged when creating or splitting a prepaid card. The gas fee that is charged is returned as a string value in units of `wei` of the specified token. This is the same fee that is accounted for in the `PrepaidCard.priceForFaceValue` API.
```js
let gasFeeInDai = await prepaidCard.gasFee(daiCpxdAddress);
```

### `PrepaidCard.getPaymentLimits`
This call will return the prepaid card payment limits in units of SPEND (we return a number types since it is safe to represent SPEND as a number in javascript).

```js
let { min, max } = await prepaidCard.getPaymentLimits();
```

This method returns:
```ts
Promise<{ min: number; max: number; }>
```
### `PrepaidCard.payMerchant`
This call will pay a merchant from a prepaid card.

The arguments are:
- The safe address of the merchant that will be receiving payment
- The prepaid card address to use to pay the merchant
- The amount of **§** SPEND to pay the merchant.
- You can optionally provide an object that specifies the "from" address. The gas price and gas limit will be calculated by the card protocol and are not configurable.

```js
let result = await prepaidCard.payMerchant(
  merchantSafeAddress,
  prepaidCardAddress
  5000 // Pay the merchant §5000 SPEND
);
```

This method returns a promise for a web3 transaction receipt.

## `PrepaidCardMarket`
The `PrepaidCardMarket` API is used to manage the inventory prepaid cards in the market contract, whose purpose is to provision prepaid cards to consumers who buy them. This API is used within the layer 2 network in which the Card Protocol runs. The `PrepaidCardMaket` API can be obtained from `getSDK()` with a `Web3` instance that is configured to operate on a layer 2 network (like xDai or Sokol).
```js
import { getSDK } from "@cardstack/cardpay-sdk";
let web3 = new Web3(myProvider); // Layer 2 web3 instance
let prepaidCardMarket = await getSDK('PrepaidCardMarket', web3);
```

### `PrepaidCardMarket.isPaused`
This call returns whether or not the PrepaidCardMarket contract is currently paused.
```js
let isPaused = await prepaidCardMarket.isPaused();
```

### `PrepaidCardMarket.getSKUInfo`
This call obtains the details for the prepaid cards associated with a particular SKU.
The arguments are:
- The SKU in question
- Optionally the address of the market contract (the default Cardstack market contract will be used if not provided)
```js
let {
  issuer,
  issuingToken,
  faceValue,
  customizationDID,
  askPrice // as wei in the units of the issuing token
} = await prepaidCardMarket.getSKUInfo(sku1000SPENDCards);
```

### `PrepaidCardMarket.getInventory`
This call returns the prepaid card inventory for a particular SKU.
The arguments are:
- The SKU in question
- Optionally the address of the market contract (the default Cardstack market contract will be used if not provided)
```js
let prepaidCards = await prepaidCardMarket.getInventory(sku1000SPENDCards);
```

This call returns a promise for an array of `PrepaidCardSafe` objects (from `Safes.View`).

### `PrepaidCardMarket.addToInventory`
This call adds the specified prepaid card address to the inventory.
The arguments are:
- The prepaid card that is used to pay for the gas for this transaction
- The prepaid card address to add to inventory
- Optionally the address of the market contract (the default Cardstack market contract will be used if not provided)
- You can optionally provide an object that specifies the "from" address. The gas price and gas limit will be calculated by the card protocol and are not configurable.

```js
let result = await prepaidCardsMarket.addToInventory(fundingPrepaidCard, cardToAdd);
```

This method returns a promise for a web3 transaction receipt.

### `PrepaidCardMarket.removeFromInventory`
This call removes the specified prepaid card addresses from inventory and returns them back to the prepaid card issuer.

The arguments are:
- The prepaid card that is used to pay for the gas for this transaction
- The prepaid card addresses to remove from inventory
- Optionally the address of the market contract (the default Cardstack market contract will be used if not provided)
- You can optionally provide an object that specifies the "from" address. The gas price and gas limit will be calculated by the card protocol and are not configurable.

```js
let result = await prepaidCardsMarket.removeFromInventory(fundingPrepaidCard, cardsToRemove);
```

This method returns a promise for a web3 transaction receipt.

### `PrepaidCardMarket.setAsk`
This call sets the ask price for the prepaid cards the belong to the specified SKU. The ask price is specified as a string in units of `wei` based on the issuing token for the prepaid cards in the specified SKU.

The arguments are:
- The prepaid card that is used to pay for the gas for issuing the transaction
- The SKU whose ask price you are setting
- The ask price as a string in units of `wei` of the SKU's issuing token
- Optionally the address of the market contract (the default Cardstack market contract will be used if not provided)
- You can optionally provide an object that specifies the "from" address. The gas price and gas limit will be calculated by the card protocol and are not configurable.

```js
let result = await prepaidCardMarket.setAsk(
  fundingPrepaidCard,
  sku1000SPENDCards,
  toWei("10"));
```

This method returns a promise for a web3 transaction receipt.

## `RevenuePool`
The `RevenuePool` API is used register merchants and view/claim merchant revenue from prepaid card payments within the layer 2 network in which the Card Protocol runs. The `RevenuePool` API can be obtained from `getSDK()` with a `Web3` instance that is configured to operate on a layer 2 network (like xDai or Sokol).
```js
import { getSDK } from "@cardstack/cardpay-sdk";
let web3 = new Web3(myProvider); // Layer 2 web3 instance
let revenuePool = await getSDK('RevenuePool', web3);
```
### `RevenuePool.merchantRegistrationFee`
This call will return the fee in SPEND to register as a merchant. This call returns a promise for a number which represents the amount of SPEND it costs to register as a merchant.
```js
  let registrationFeeInSpend = await revenuePool.merchantRegistrationFee();
  // registrationFee = 1000
```
### `RevenuePool.registerMerchant`
This call will register a merchant with the Revenue Pool. In order to register as a merchant a prepaid card is used to pay the merchant registration fee. As part of merchant registration a gnosis safe will be created for the merchant specifically to claim revenue from prepaid card payments from the Revenue Pool. When customers pay a merchant they must specify the merchant safe (created from this call) as the recipient for merchant payments.

The parameters to this function are:
- The merchant's prepaid card address that will be paying the merchant registration fee
- The merchant's info DID which is an identifier string that can resolve merchant details like their name, URL, logo, etc.

```js
  let { merchantSafe } = await revenuePool.registerMerchant(merchantsPrepaidCardAddress, infoDID);
```
This call takes in as a parameter the prepaid card address that the merchant is using to pay the registration fee for becoming a new merchant.

This method returns a promise for a web3 transaction receipt.

### `RevenuePool.balances`
This call returns the balance in the RevenuePool for a merchant's safe address. As customers pay merchants with their prepaid cards, the payments accumulate as revenue that the merchants can claim using their merchant safes. This function reveals the revenue that has accumulated for the merchant. This function takes in a parameter, which is the merchant's safe address and returns a promise that is a list balances aggregated by token address (a merchant can accumulate balances for all the stable coin CPXD tokens that are allowed in the cardpay protocol).

```js
let balances = await revenuePool.balances(merchantSafeAddress);
for (let balanceInfo of balances) {
  console.log(`${balanceInfo.tokenSymbol} balance is ${fromWei(balanceInfo.balance)}`)
}
```

where the result is a promise for an array of objects in the following shape:
```ts
interface RevenueTokenBalance {
  tokenSymbol: string;
  tokenAddress: string;
  balance: string; // balance is in wei
}
```

### `RevenuePool.claimGasEstimate`
This call will return the gas estimate for claiming revenue.

The parameters to this function are:
- The merchant's safe address
- The token address of the tokens the merchant is claiming
- The amount of tokens that are being claimed as a string in units of `wei`

```ts
let result = await revenuePool.claim(merchantSafeAddress, tokenAddress, claimAmountInWei);
```

This method returns a promise for the amount of the tokens specified as the token address in the parameters that are estimated to be used to pay for gas as a string in units of `wei`.

### `RevenuePool.claim`
This call will transfer unclaimed merchant revenue from the revenue pool into the merchant's safe, thereby "claiming" the merchant's revenue earned from prepaid card payments.

The parameters to this function are:
- The merchant's safe address
- The token address of the tokens the merchant is claiming
- The amount of tokens that are being claimed as a string in units of `wei`

```ts
let result = await revenuePool.claim(merchantSafeAddress, tokenAddress, claimAmountInWei);
```
This method returns a promise for a web3 transaction receipt.
## `RewardPool`

The `RewardPool` API is used to interact with tally (an offchain service similar to relayer) and the reward pool contract. As customers use their prepaid card they will be given rewards based the amount of spend they use and a reward-based algorithm.

### `RewardPool.rewardTokenBalance`
This call returns the balance of a token in the RewardPool for prepaid card owners address. This function takes in a parameter of the prepaid card owner address and , reward token address, and reward program id. This balance also accounts for the claims of a prepaid card owner in the past. The tokens that are part of the rewards are CARDPXD and DAICPXD -- federated tokens of the card protocol.

```ts
interface RewardTokenBalance {
  rewardProgramId: string,
  tokenSymbol: string;
  tokenAddress: string;
  balance: BN;
}
```

```js
let balanceForSingleToken = await rewardPool.rewardTokenBalance(address, tokenAddress, rewardProgramId);
//You can also use rewardTokenBalances()
let balanceForAllTokens = await rewardPool.rewardTokenBalances(address, rewardProgramId)
```

## `RewardPool.addRewardTokens`

The `AddRewardTokens` API is used to refill the reward pool for a particular reward program with any single owner safe. Currently, we are using single-owner safe like depot safe or merchant safe to send funds, but, in the future we will use prepaid cards to pay. If a reward program doesn't have any funds inside of the pool rewardees will be unable to claim. Anyone can call this api not only the rewardProgramAdmin.

```js
let rewardPool = await getSDK('RewardPool', web3);
await rewardPool.addRewardTokens(safe, rewardProgramId, tokenAddress, amount)
```

### `RewardPool.claim`

The `Claim` API is used by the rewardee to claim rewards for a reward program id.

Pre-requisite for this action:
- reward program has to be registered
- rewardee has to register and create safe for that particular reward program
- rewardee must get an existing proof from tally api  -- look at `rewardPool.getProofs`
- reward pool has to be filled with reward token for that reward program

This claim action is similar to `RevenuePool.claim` in that a pre-flight check is used to check that the rewards claimed will be able to cover that gas for the transaction.

```js
let rewardPool = await getSDK('RewardPool', web3);
await rewardPool.claim(safe, rewardProgramId, tokenAddress, proof,amount)
```

## `RewardManager`

The `RewardManager` API is used to interact to manage reward program. Those intending to offer or receive rewards have to register using this sdk.

## `RewardManager.registerRewardProgram`

The `RegisterRewardProgram` API is used to register a reward program using a prepaid card. The call can specify an EOA admin account -- it defaults to the owner of the prepaid card itself. The reward program admin will then be able to manage the reward program using other api functions like`lockRewardProgram`, `addRewardRule`, etc. A fee of 500 spend is charged when registering a reward program. Currently, tally only gives rewards to a single reward program (sokol: "0x4767D0D74356433d54880Fcd7f083751d64388aF").

```js
let prepaidCardAPI = await getSDK('PrepaidCard', web3);
await prepaidCardAPI.registerRewardProgram(prepaidCard, admin)
```

## `RewardManager.registerRewardee`

The `RegistereRewardee` API is used to register a rewardee for a reward program using a prepaid card. The purpose of registering is not to "be considered to receive rewards" rather to "be able to claim rewards that have been given". By registering, the owner of the prepaid card is given ownership of a reward safe that will be used to retrieve rewards from the reward pool. A rewardee/eoa is eligible to only have one reward safe for each reward program; any attempts to re-register will result in a revert error. A fee of 500 spend is charged when registering a rewardee.

```js
let prepaidCardAPI = await getSDK('PrepaidCard', web3);
await prepaidCardAPI.registerRewardee(prepaidCard , rewardProgramId)
```

## `LayerOneOracle`
The `LayerOneOracle` API is used to get the current exchange rates in USD of ETH. This rate us fed by the Chainlink price feeds. Please supply a layer 1 web3 instance obtaining an `LayerOneOracle` API from `getSDK()`.
```js
import { getSDK } from "@cardstack/cardpay-sdk";
let web3 = new Web3(myProvider); // Layer 1 web3 instance
let layerOneOracle = await getSDK('LayerOneOracle', web3);
```
### `LayerOneOracle.ethToUsd`
This call will return the USD value for the specified amount of ETH. This API requires that the amount be specified in `wei` (10<sup>18</sup> `wei` = 1 token) as a string, and will return a floating point value in units of USD. You can easily convert an ETH value to wei by using the `Web3.utils.toWei()` function.

```js
let layerOneOracle = await getSDK('LayerOneOracle', web3);
let usdPrice = await exchangelayerOneOracleRate.ethToUsd(amountInWei);
console.log(`USD value: $${usdPrice.toFixed(2)} USD`);
```
### LayerOneOracle.getEthToUsdConverter
This returns a function that converts an amount of ETH in wei to USD. The returned function accepts a string that represents an amount in wei and returns a number that represents the USD value of that amount of ETH.

```js
let layerOneOracle = await getSDK('LayerOneOracle', web3);
let converter = await layerOneOracle.getEthToUsdConverter();
console.log(`USD value: $${converter(amountInWei)} USD`);
```
### `LayerOneOracle.getUpdatedAt`
This call will return a `Date` instance that indicates the date the exchange rate was last updated.

```js
let layerOneOracle = await getSDK('LayerOneOracle', web3);
let date = await layerOneOracle.getUpdatedAt();
console.log(`The ETH / USD rate was last updated at ${date.toString()}`);
```
## `LayerTwoOracle`
The `LayerTwoOracle` API is used to get the current exchange rates in USD and ETH for the various stablecoin that we support. These rates are fed by the Chainlink price feeds for the stablecoin rates and the DIA oracle for the CARD token rates. As we onboard new stablecoin we'll add more exchange rates. The price oracles that we use reside in layer 2, so please supply a layer 2 web3 instance obtaining an `LayerTwoOracle` API from `getSDK()`.
```js
import { getSDK } from "@cardstack/cardpay-sdk";
let web3 = new Web3(myProvider); // Layer 2 web3 instance
let layerTwoOracle = await getSDK('LayerTwoOracle', web3);
```
### `LayerTwoOracle.convertToSpend`
This call will convert an amount in the specified token to a SPEND amount. This function returns a number representing the SPEND amount. The input to this function is the token amount as a string in units of `wei`.
```js
let spendAmount = await layerTwoOracle.convertFromSpend(daicpxdAddress, toWei(10)); // convert 10 DAI to SPEND
console.log(`SPEND value ${spendAmount}`);
```
### `LayerTwoOracle.convertFromSpend`
This call will convert a SPEND amount into the specified token amount, where the result is a string that represents the token in units of `wei`. Since SPEND tokens represent $0.01 USD, it is safe to represent SPEND as a number when providing the input value.
```js
let weiAmount = await layerTwoOracle.convertFromSpend(daicpxdAddress, 10000); // convert 10000 SPEND into DAI
console.log(`DAI value ${fromWei(weiAmount)}`);
```
### `LayerTwoOracle.getUSDPrice`
This call will return the USD value for the specified amount of the specified token. If we do not have an exchange rate for the token, then an exception will be thrown. This API requires that the token amount be specified in `wei` (10<sup>18</sup> `wei` = 1 token) as a string, and will return a floating point value in units of USD. You can easily convert a token value to wei by using the `Web3.utils.toWei()` function.

```js
let layerTwoOracle = await getSDK('LayerTwoOracle', web3);
let usdPrice = await layerTwoOracleRate.getUSDPrice("DAI", amountInWei);
console.log(`USD value: $${usdPrice.toFixed(2)} USD`);
```
### LayerTwoOracle.getUSDConverter
This returns a function that converts an amount of a token in wei to USD. Similar to `LayerTwoOracle.getUSDPrice`, an exception will be thrown if we don't have the exchange rate for the token. The returned function accepts a string that represents an amount in wei and returns a number that represents the USD value of that amount of the token.

```js
let layerTwoOracle = await getSDK('LayerTwoOracle', web3);
let converter = await layerTwoOracle.getUSDConverter("DAI");
console.log(`USD value: $${converter(amountInWei)} USD`);
```
### `LayerTwoOracle.getETHPrice`
This call will return the ETH value for the specified amount of the specified token. If we do not have an exchange rate for the token, then an exception will be thrown. This API requires that the token amount be specified in `wei` (10<sup>18</sup> `wei` = 1 token) as a string, and will return a string that represents the ETH value in units of `wei` as well. You can easily convert a token value to wei by using the `Web3.utils.toWei()` function. You can also easily convert units of `wei` back into `ethers` by using the `Web3.utils.fromWei()` function.

```js
let layerTwoOracle = await getSDK('LayerTwoOracle', web3);
let ethWeiPrice = await layerTwoOracle.getETHPrice("CARD", amountInWei);
console.log(`ETH value: ${fromWei(ethWeiPrice)} ETH`);
```
### `LayerTwoOracle.getUpdatedAt`
This call will return a `Date` instance that indicates the date the token rate was last updated.

```js
let layerTwoOracle = await getSDK('LayerTwoOracle', web3);
let date = await layerTwoOracle.getUpdatedAt("DAI");
console.log(`The ${token} rate was last updated at ${date.toString()}`);
```

## `HubAuth` (TODO)
## `getAddress`
`getAddress` is a utility that will retrieve the contract address for a contract that is part of the Card Protocol in the specified network. The easiest way to use this function is to just pass your web3 instance to the function, and the function will query the web3 instance to see what network it is currently using. You can also just pass in the network name.

```js
let daiCpxdToken = await getAddress("daiCpxd", web3);
let daiToken = await getAddress("daiToken", web3);
let foreignBridge = await getAddress("foreignBridge", web3);
let homeBridge = await getAddress("homeBridge", web3);
let prepaidCardManager = await getAddress("prepaidCardManager", web3);
```

## `getOracle`
`getOracle` is a utility that will retrieve the contract address for a price oracle for the specified token in the specified network. The easiest way to use this function is to just pass your web3 instance to the function, and the function will query the web3 instance to see what network it is currently using. You can also just pass in the network name. Please omit the ".CPXD" suffix in the token name that you provide.
```js
let daiOracle = await getOracle("DAI", web3);
let cardOracle = await getOracle("CARD", web3);
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
The following ABI's from the Card Protocol are also available:
```js
import {
  ERC20ABI,
  ERC677ABI,
  ForeignBridgeMediatorABI,
  HomeBridgeMediatorABI,
  PrepaidCardManagerABI } from "@cardstack/cardpay-sdk";
```
Note that we don't expose CardPay specific ABI's since these are upgradeable contracts whose interfaces can fluctuate.
