# cardpay-sdk <!-- omit in toc -->
This is a package that provides an SDK to use the Cardpay protocol. The SDK is divided into two main parts currently Cardpay and Champer.

- [Full Documentation](https://cardstack.github.io/cardstack/stable/modules/_cardstack_cardpay_sdk.html)

### Champer

Champer is the newer part of the SDK that interact with our [safe modules](https://help.safe.global/en/articles/4934378-what-is-a-module). 
- [ScheduledPaymentModule](https://cardstack.github.io/cardstack/stable/classes/_cardstack_cardpay_sdk.ScheduledPaymentModule.html): Allows a safe to schedule a payment. See module [here](https://github.com/cardstack/cardstack-module-scheduled-payment)  
- [ClaimSettlementModule](https://cardstack.github.io/cardstack/stable/classes/_cardstack_cardpay_sdk.ClaimSettlementModule.html): Allows a safe to create claims and allow others to claim from it. See module [here](https://github.com/cardstack/safe-module-claim-settlement)

### Cardpay 

Cardpay is the older part of the SDK that interact with our protocol [smart contracts](https://github.com/cardstack/card-pay-protocol) and [token bridge](https://github.com/cardstack/tokenbridge-contracts).

- [Assets](https://cardstkck.github.io/cardstack/stable/classes/_cardstack_cardpay_sdk.AssetsClass.html): Utility to query native and ERC20 token balances
- [Safes](https://cardstack.github.io/cardstack/stable/classes/_cardstack_cardpay_sdk.Safes.html): Utility to query safes in our protocol 
- [LayerOneOracle](https://cardstack.github.io/cardstack/stable/classes/_cardstack_cardpay_sdk.LayerOneOracle.html): Utility to get the current exchange rates in USD and ETH on layer 1
- [LayerTwoOracle](https://cardstack.github.io/cardstack/stable/classes/_cardstack_cardpay_sdk.LayerTwoOracle.html): Utility get the current exchange rates in USD and ETH on layer 2

- [TokenBridgeForeignSide](https://cardstkck.github.io/cardstack/stable/classes/_cardstack_cardpay_sdk.TokenBridgeForeignSideClass.html): Interact with the foreign-side bridge ie the bridge contract receiving the tokens on layer 1
- [TokenBridgeHomeSide](https://cardstkck.github.io/cardstack/stable/classes/_cardstack_cardpay_sdk.TokenBridgeHomeSideClass.html): Interact with the home-side bridge ie the bridge contract minting the tokens on layer 2

- [PrepaidCard](https://cardstack.github.io/cardstack/stable/classes/_cardstack_cardpay_sdk.PrepaidCardClass.html): Create and interact with prepaid cards that are used to pay merchants
- [RevenuePool](https://cardstack.github.io/cardstack/stable/classes/_cardstack_cardpay_sdk.RevenuePoolClass.html): Register merchants and claim revenue

- [PrepaidCardMarket](https://cardstack.github.io/cardstack/stable/classes/_cardstack_cardpay_sdk.PrepaidCardMarketClass.html): Provision prepaid cards to people who buy them
- [PrepaidCardMarketV2](https://cardstack.github.io/cardstack/stable/classes/_cardstack_cardpay_sdk.PrepaidCardMarketV2Class.html): Similar as PrepaidCardMarket but using updated v2 pattern where prepaid cards are provisioned before being created 
- [RewardManager](https://cardstack.github.io/cardstack/stable/classes/_cardstack_cardpay_sdk.RewardManagerClass.html): Register and manage reward program 
- [RewardPool](https://cardstack.github.io/cardstack/stable/classes/_cardstack_cardpay_sdk.RewardPoolClass.html): Submit rewards with merkle roots and claim rewards as a user

## Installation

```
yarn add @cardstack/cardpay-sdk
```

## Usage 

```
yarn add @cardstack/cardpay-sdk@1.0.47 ethers@5.7.2 node-fetch@2.6.1
```

```
import fetch from "node-fetch";
import { getSDK, JsonRpcProvider } from "@cardstack/cardpay-sdk";
import { Wallet } from "ethers";

//@ts-ignore polyfilling fetch
global.fetch = fetch;

(async () => {
  const mnemonic =
    "<Your mnemonic>";
  const signer = Wallet.fromMnemonic(mnemonic);
  const rpcUrl = "https://eth-goerli.public.blastapi.io";
  const networkId = 5; // 5 for goerli
  const ethersProvider = new JsonRpcProvider(rpcUrl, networkId);
  const scheduledPaymentModule = await getSDK(
    "ScheduledPaymentModule",
    ethersProvider,
    signer
  );
  const { safeAddress } =
    await scheduledPaymentModule.createSafeWithModuleAndGuard(
      undefined,
      undefined,
      { from: signer.address }
    );
  console.log(`Your new safe ${safeAddress} has been created`);
})();
```

### Special Considerations <!-- omit in toc -->
 One item to note that all token amounts that are provided to the API must strings and be in native units of the token (usually `wei`) unless otherwise noted. All token amounts returned by the API will also be in native units (again, this usually means `wei`). You can use `Web3.utils.toWei()` and `Web3.utils.fromWei()` to convert to and from units of `wei`. Because ethereum numbers can be so large, it is unsafe to represent these natively in Javascript, and in fact it is very common for a smart contract to return numbers that are simply too large to be represented natively in Javascript. For this reason, within Javascript the only safe way to natively handle numbers coming from Ethereum is as a `string`. If you need to perform math on a number coming from Ethereum use the `BigNumber` feature of the ethers library.
