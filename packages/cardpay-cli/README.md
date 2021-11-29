# cardpay-cli <!-- omit in toc -->
=============

CLI tool for basic actions in Cardpay

# Install
To install the Cardpay CLI run the following command:

```sh
curl -o- -L https://install.cardstack.com/install-cardpay.sh | bash
```
This will install the Cardpay CLI to your ~/.cardpay folder, as well as add the `cardpay` bin to your $PATH env var.

# Running
To run the Cardpay CLI type:
```sh
cardpay <command> <arguments> [options]
```

The commands are listed below (which you can view using --help option). Each command has arguments specific to it. The options indicate how you wish to connect to your wallet. You can either provide your mnemonic seed (as either an environment variable `MNEMONIC_PHRASE` or using the `--mnemonic` param. Or you can specify `--walletConnect` to use the cardpay wallet app. A QR code will be displayed that you can scan in your cardwallet app, which will connect the CLI to your cardwallet.

## Running within the development environment
If you wish to run the CLI within the development environment, then you can use the `yarn cardpay` yarn script. Simple run the command in the `packages/cardpay-cli` workspace and prefix the command with `yarn`. e.g.
```sh
yarn cardpay safes-view --walletConnect
```

# Commands
- [Install](#install)
- [Running](#running)
  - [Running within the development environment](#running-within-the-development-environment)
- [Commands](#commands)
  - [`cardpay bridge-to-l2 <AMOUNT> <TOKEN_ADDRESS> [RECEIVER] --network=NETWORK [--mnemonic=MNEMONIC] [--walletConnect]`](#cardpay-bridge-to-l2-amount-token_address-receiver---networknetwork---mnemonicmnemonic---walletconnect)
  - [`cardpay await-bridged-to-l2 <FROM_BLOCK> [RECIPIENT] --network=_NETWORK [--mnemonic=MNEMONIC] [--walletConnect]`](#cardpay-await-bridged-to-l2-from_block-recipient---network_network---mnemonicmnemonic---walletconnect)
  - [`cardpay bridge-to-l1 <SAFE_ADDRESS> <AMOUNT> <TOKEN_ADDRESS> <RECEIVER> --network=NETWORK [--mnemonic=MNEMONIC] [--walletConnect]`](#cardpay-bridge-to-l1-safe_address-amount-token_address-receiver---networknetwork---mnemonicmnemonic---walletconnect)
  - [`cardpay await-bridged-to-l1 <FROM_BLOCK> <TXN_HASH> --network=NETWORK [--mnemonic=MNEMONIC] [--walletConnect]`](#cardpay-await-bridged-to-l1-from_block-txn_hash---networknetwork---mnemonicmnemonic---walletconnect)
  - [`cardpay withdrawal-limits <TOKEN> --network=NETWORK [--mnemonic=MNEMONIC] [--walletConnect]`](#cardpay-withdrawal-limits-token---networknetwork---mnemonicmnemonic---walletconnect)
  - [`cardpay claim-tokens-bridged-to-l1 <MESSAGE_ID> <ENCODED_DATA> <SIGNATURES..> --network=NETWORK [--mnemonic=MNEMONIC] [--walletConnect]`](#cardpay-claim-tokens-bridged-to-l1-message_id-encoded_data-signatures---networknetwork---mnemonicmnemonic---walletconnect)
  - [`cardpay prepaidcard-create <SAFE_ADDRESS> <TOKEN_ADDRESS> <CUSTOMIZATION_DID> <FORCE> <FACE_VALUES..> --network=NETWORK [--mnemonic=MNEMONIC] [--walletConnect]`](#cardpay-prepaidcard-create-safe_address-token_address-customization_did-force-face_values---networknetwork---mnemonicmnemonic---walletconnect)
  - [`cardpay split <PREPAID_CARD> <FACE_VALUE> <QUANTITY> --network=NETWORK [--mnemonic=MNEMONIC] [--walletConnect]`](#cardpay-split-prepaid_card-face_value-quantity---networknetwork---mnemonicmnemonic---walletconnect)
  - [`cardpay prepaidcard-split <PREPAID_CARD> <CUSTOMIZATION_DID> <FACE_VALUES..> --network=NETWORK [--mnemonic=MNEMONIC] [--walletConnect]`](#cardpay-prepaidcard-split-prepaid_card-customization_did-face_values---networknetwork---mnemonicmnemonic---walletconnect)
  - [`cardpay prepaidcard-transfer <PREPAID_CARD> <NEW_OWNER> --network=NETWORK [--mnemonic=MNEMONIC] [--walletConnect]`](#cardpay-prepaidcard-transfer-prepaid_card-new_owner---networknetwork---mnemonicmnemonic---walletconnect)
  - [`cardpay prepaidcard-provision <SKU> <RECIPIENT> <ENVIRONMENT> <SECRET> --network=NETWORK [--mnemonic=MNEMONIC] [--walletConnect]`](#cardpay-prepaidcard-provision-sku-recipient-environment-secret---networknetwork---mnemonicmnemonic---walletconnect)
  - [`cardpay price-for-face-value <TOKEN_ADDRESS> <SPEND_FACE_VALUE> --network=NETWORK [--mnemonic=MNEMONIC] [--walletConnect]`](#cardpay-price-for-face-value-token_address-spend_face_value---networknetwork---mnemonicmnemonic---walletconnect)
  - [`cardpay sku-info <SKU> --network=NETWORK [--mnemonic=MNEMONIC] [--walletConnect]`](#cardpay-sku-info-sku---networknetwork---mnemonicmnemonic---walletconnect)
  - [`cardpay prepaid-card-inventory <SKU> --network=NETWORK [--mnemonic=MNEMONIC] [--walletConnect]`](#cardpay-prepaid-card-inventory-sku---networknetwork---mnemonicmnemonic---walletconnect)
  - [`cardpay prepaid-card-inventories <ENVIRONMENT> --network=NETWORK [--mnemonic=MNEMONIC] [--walletConnect]`](#cardpay-prepaid-card-inventories-environment---networknetwork---mnemonicmnemonic---walletconnect)
  - [`cardpay add-prepaid-card-inventory <FUNDING_CARD> <PREPAID_CARD> --network=NETWORK [--mnemonic=MNEMONIC] [--walletConnect]`](#cardpay-add-prepaid-card-inventory-funding_card-prepaid_card---networknetwork---mnemonicmnemonic---walletconnect)
  - [`cardpay remove-prepaid-card-inventory <FUNDING_CARD> <PREPAID_CARDS..> --network=NETWORK [--mnemonic=MNEMONIC] [--walletConnect]`](#cardpay-remove-prepaid-card-inventory-funding_card-prepaid_cards---networknetwork---mnemonicmnemonic---walletconnect)
  - [`cardpay set-prepaid-card-ask <PREPAID_CARD> <SKU> <ASK_PRICE> --network=NETWORK [--mnemonic=MNEMONIC] [--walletConnect]`](#cardpay-set-prepaid-card-ask-prepaid_card-sku-ask_price---networknetwork---mnemonicmnemonic---walletconnect)
  - [`cardpay register-merchant <PREPAID_CARD> <INFO_DID> --network=NETWORK [--mnemonic=MNEMONIC] [--walletConnect]`](#cardpay-register-merchant-prepaid_card-info_did---networknetwork---mnemonicmnemonic---walletconnect)
  - [`cardpay payment-limits --network=NETWORK [--mnemonic=MNEMONIC] [--walletConnect]`](#cardpay-payment-limits---networknetwork---mnemonicmnemonic---walletconnect)
  - [`cardpay pay-merchant <MERCHANT_SAFE> <PREPAID_CARD> <SPEND_AMOUNT> --network=NETWORK [--mnemonic=MNEMONIC] [--walletConnect]`](#cardpay-pay-merchant-merchant_safe-prepaid_card-spend_amount---networknetwork---mnemonicmnemonic---walletconnect)
  - [`cardpay revenue-balances <MERCHANT_SAFE> --network=NETWORK [--mnemonic=MNEMONIC] [--walletConnect]`](#cardpay-revenue-balances-merchant_safe---networknetwork---mnemonicmnemonic---walletconnect)
  - [`cardpay claim-revenue <MERCHANT_SAFE> <TOKEN_ADDRESS> <AMOUNT> --network=NETWORK [--mnemonic=MNEMONIC] [--walletConnect]`](#cardpay-claim-revenue-merchant_safe-token_address-amount---networknetwork---mnemonicmnemonic---walletconnect)
  - [`cardpay claim-revenue-gas-estimate <MERCHANT_SAFE> <TOKEN_ADDRESS> <AMOUNT> --network=NETWORK [--mnemonic=MNEMONIC] [--walletConnect]`](#cardpay-claim-revenue-gas-estimate-merchant_safe-token_address-amount---networknetwork---mnemonicmnemonic---walletconnect)
  - [`cardpay new-prepaidcard-gas-fee <TOKEN_ADDRESS> --network=NETWORK [--mnemonic=MNEMONIC] [--walletConnect]`](#cardpay-new-prepaidcard-gas-fee-token_address---networknetwork---mnemonicmnemonic---walletconnect)
  - [`cardpay safes-view [ADDRESS] [SAFE_TYPE] --network=NETWORK [--mnemonic=MNEMONIC] [--walletConnect]`](#cardpay-safes-view-address-safe_type---networknetwork---mnemonicmnemonic---walletconnect)
  - [`cardpay safe-view [SAFE_ADDRESS] --network=NETWORK [--mnemonic=MNEMONIC] [--walletConnect]`](#cardpay-safe-view-safe_address---networknetwork---mnemonicmnemonic---walletconnect)
  - [`cardpay safe-transfer-tokens [SAFE_ADDRESS] [TOKEN_ADDRESS] [RECIPIENT] [AMOUNT] --network=NETWORK [--mnemonic=MNEMONIC] [--walletConnect]`](#cardpay-safe-transfer-tokens-safe_address-token_address-recipient-amount---networknetwork---mnemonicmnemonic---walletconnect)
  - [`cardpay safe-transfer-tokens-gas-estimate [SAFE_ADDRESS] [TOKEN_ADDRESS] [RECIPIENT] [AMOUNT] --network=NETWORK [--mnemonic=MNEMONIC] [--walletConnect]`](#cardpay-safe-transfer-tokens-gas-estimate-safe_address-token_address-recipient-amount---networknetwork---mnemonicmnemonic---walletconnect)
  - [`cardpay usd-price <TOKEN> [AMOUNT] --network=NETWORK [--mnemonic=MNEMONIC] [--walletConnect]`](#cardpay-usd-price-token-amount---networknetwork---mnemonicmnemonic---walletconnect)
  - [`cardpay eth-price <TOKEN> [AMOUNT] --network=NETWORK [--mnemonic=MNEMONIC] [--walletConnect]`](#cardpay-eth-price-token-amount---networknetwork---mnemonicmnemonic---walletconnect)
  - [`cardpay price-oracle-updated-at <TOKEN> --network=NETWORK [--mnemonic=MNEMONIC] [--walletConnect]`](#cardpay-price-oracle-updated-at-token---networknetwork---mnemonicmnemonic---walletconnect)
  - [`cardpay view-token-balance [TOKEN_ADDRESS] --network=NETWORK [--mnemonic=MNEMONIC] [--walletConnect]`](#cardpay-view-token-balance-token_address---networknetwork---mnemonicmnemonic---walletconnect)
  - [`cardpay hub-auth [HUB_ROOT_URL] --network=NETWORK [--mnemonic=MNEMONIC] [--walletConnect]`](#cardpay-hub-auth-hub_root_url---networknetwork---mnemonicmnemonic---walletconnect)


## `cardpay bridge-to-l2 <AMOUNT> <TOKEN_ADDRESS> [RECEIVER] --network=NETWORK [--mnemonic=MNEMONIC] [--walletConnect]`

Bridge tokens from L1 address to L2 safe

```
USAGE
  $ cardpay bridge-to-l2 <amount> <tokenAddress> [receiver] --network=NETWORK [--mnemonic=MNEMONIC] [--walletConnect]

ARGUMENTS
  AMOUNT          Amount in ether you would like bridged
  TOKEN_ADDRESS   The layer 1 token address of the token to bridge
  RECEIVER        Layer 2 address to be owner of L2 safe, defaults to same as L1 address
  NETWORK         The Layer 1 network to use ("kovan" or "mainnet")
  MNEMONIC        (Optional) Phrase for mnemonic wallet. Also can be pulled from env using MNEMONIC_PHRASE
  WALLET_CONNECT  (Optional) A flag that indicates that you wish to use wallet connect (and hence the card wallet app) for your wallet
```

## `cardpay await-bridged-to-l2 <FROM_BLOCK> [RECIPIENT] --network=_NETWORK [--mnemonic=MNEMONIC] [--walletConnect]`

Wait for token bridging from L1 to L2 to complete

```
USAGE
  $ cardpay await-bridged-to-l2 <fromBlock> [recipient] --network=NETWORK [--mnemonic=MNEMONIC] [--walletConnect]

ARGUMENTS
  FROM_BLOCK      Layer 2 block height before bridging was initiated
  RECIPIENT       Layer 2 address that is the owner of the bridged tokens, defaults to wallet address
  NETWORK         The Layer 2 network to use ("sokol" or "xdai")
  MNEMONIC        (Optional) Phrase for mnemonic wallet. Also can be pulled from env using MNEMONIC_PHRASE
  WALLET_CONNECT  (Optional) A flag that indicates that you wish to use wallet connect (and hence the card wallet app) for your wallet
```

## `cardpay bridge-to-l1 <SAFE_ADDRESS> <AMOUNT> <TOKEN_ADDRESS> <RECEIVER> --network=NETWORK [--mnemonic=MNEMONIC] [--walletConnect]`

Bridge tokens from L2 safe to L1 address

```
USAGE
  $ cardpay bridge-to-l1 <SAFE_ADDRESS> <AMOUNT> <TOKEN_ADDRESS> <RECEIVER> --network=NETWORK [--mnemonic=MNEMONIC] [--walletConnect]

ARGUMENTS
  SAFE_ADDRESS    The layer 2 safe address to bridge the tokens from
  AMOUNT          Amount in ether you would like bridged
  TOKEN_ADDRESS   The layer 2 token address of the token to bridge
  RECEIVER        Layer 1 address to receive the bridge tokens
  NETWORK         The Layer 2 network to use ("sokol" or "xdai")
  MNEMONIC        (Optional) Phrase for mnemonic wallet. Also can be pulled from env using MNEMONIC_PHRASE
  WALLET_CONNECT  (Optional) A flag that indicates that you wish to use wallet connect (and hence the card wallet app) for your wallet
```

## `cardpay await-bridged-to-l1 <FROM_BLOCK> <TXN_HASH> --network=NETWORK [--mnemonic=MNEMONIC] [--walletConnect]`

Wait for token bridging from L2 to L1 to complete validation. This will return the messageId, encodedData, and signatures that can be used to claim the bridge tokens in L1

```
USAGE
  $ cardpay await-bridged-to-l1 <TXN_HASH> --network=NETWORK [--mnemonic=MNEMONIC] [--walletConnect]

ARGUMENTS
  FROM_BLOCK      Layer 2 block height before bridging was initiated
  TXN_HASH        Layer 2 transaction hash of the bridging transaction
  NETWORK         The Layer 2 network to use ("sokol" or "xdai")
  MNEMONIC        (Optional) Phrase for mnemonic wallet. Also can be pulled from env using MNEMONIC_PHRASE
  WALLET_CONNECT  (Optional) A flag that indicates that you wish to use wallet connect (and hence the card wallet app) for your wallet
```

## `cardpay withdrawal-limits <TOKEN> --network=NETWORK [--mnemonic=MNEMONIC] [--walletConnect]`

Get the withdrawal limits for bridging a token to layer 1.

```
USAGE
  $ cardpay withdrawal-limits <TOKEN> --network=NETWORK [--mnemonic=MNEMONIC] [--walletConnect]

ARGUMENTS
  TOKEN           The layer 2 CPXD token address of the token being withdrawn
  NETWORK         The Layer 2 network to use ("sokol" or "xdai")
  MNEMONIC        (Optional) Phrase for mnemonic wallet. Also can be pulled from env using MNEMONIC_PHRASE
  WALLET_CONNECT  (Optional) A flag that indicates that you wish to use wallet connect (and hence the card wallet app) for your wallet
```

## `cardpay claim-tokens-bridged-to-l1 <MESSAGE_ID> <ENCODED_DATA> <SIGNATURES..> --network=NETWORK [--mnemonic=MNEMONIC] [--walletConnect]`

Claim tokens that have been bridged from L2 to L1

```
USAGE
  $ cardpay claim-tokens-bridged-to-l1 <MESSAGE_ID> <ENCODED_DATA> <SIGNATURES..> --network=NETWORK [--mnemonic=MNEMONIC] [--walletConnect]

ARGUMENTS
  MESSAGE_ID      The message id for the bridging (obtained from `cardpay await-bridged-to-l1`)
  ENCODED_DATA    The encoded data for the bridging (obtained from `cardpay await-bridged-to-l1`)
  SIGNATURES      The bridge validator signatures received from bridging (obtained from `cardpay await-bridged-to-l1`)
  NETWORK         The Layer 1 network to use ("kovan" or "mainnet")
  MNEMONIC        (Optional) Phrase for mnemonic wallet. Also can be pulled from env using MNEMONIC_PHRASE
  WALLET_CONNECT  (Optional) A flag that indicates that you wish to use wallet connect (and hence the card wallet app) for your wallet
```

## `cardpay prepaidcard-create <SAFE_ADDRESS> <TOKEN_ADDRESS> <CUSTOMIZATION_DID> <FORCE> <FACE_VALUES..> --network=NETWORK [--mnemonic=MNEMONIC] [--walletConnect]`

Create a prepaid card from the CPXD tokens in a depot safe

```
USAGE
  $ cardpay prepaidcard-create <SAFE_ADDRESS> <TOKEN_ADDRESS> <CUSTOMIZATION_DID> <FACE_VALUES..> --network=NETWORK [--mnemonic=MNEMONIC] [--walletConnect]

ARGUMENTS
  FACE_VALUES       A list of face values (separated by spaces) in units of § SPEND to create
  CUSTOMIZATION_DID The DID string that represents the prepaid card customization
  SAFE_ADDRESS      Layer 2 safe address with DAI CPXD tokens
  TOKEN_ADDRESS     The token address of the token to use to pay for the prepaid cards
  FORCE             Force the prepaid card to be created even when the DAI rate is not snapped to USD
  NETWORK           The network to use ("sokol" or "xdai")
  MNEMONIC          (Optional) Phrase for mnemonic wallet. Also can be pulled from env using MNEMONIC_PHRASE
  WALLET_CONNECT    (Optional) A flag that indicates that you wish to use wallet connect (and hence the card wallet app) for your wallet
```

## `cardpay split <PREPAID_CARD> <FACE_VALUE> <QUANTITY> --network=NETWORK [--mnemonic=MNEMONIC] [--walletConnect]`

Split a prepaid card into more prepaid cards with identical face values inheriting the funding card's customization

```
USAGE
  $ cardpay split <PREPAID_CARD> <FACE_VALUE> <QUANTITY> --network=NETWORK [--mnemonic=MNEMONIC] [--walletConnect]

ARGUMENTS
  PREPAID_CARD      The address of the prepaid card being split
  FACE_VALUE        The face value for the new prepaid cards
  QUANTITY          The amount of prepaid cards to create
  NETWORK           The network to use ("sokol" or "xdai")
  MNEMONIC          (Optional) Phrase for mnemonic wallet. Also can be pulled from env using MNEMONIC_PHRASE
  WALLET_CONNECT    (Optional) A flag that indicates that you wish to use wallet connect (and hence the card wallet app) for your wallet
```

## `cardpay prepaidcard-split <PREPAID_CARD> <CUSTOMIZATION_DID> <FACE_VALUES..> --network=NETWORK [--mnemonic=MNEMONIC] [--walletConnect]`

Split a prepaid card into more prepaid cards (up to a maximum of 10 prepaid cards)

```
USAGE
  $ cardpay prepaidcard-split <PREPAID_CARD> <CUSTOMIZATION_DID> <FACE_VALUES..> --network=NETWORK [--mnemonic=MNEMONIC] [--walletConnect]

ARGUMENTS
  PREPAID_CARD      The address of the prepaid card being split
  FACE_VALUES       A list of face values (separated by spaces) in units of § SPEND to create
  CUSTOMIZATION_DID The DID string that represents the prepaid card customization
  NETWORK           The network to use ("sokol" or "xdai")
  MNEMONIC          (Optional) Phrase for mnemonic wallet. Also can be pulled from env using MNEMONIC_PHRASE
  WALLET_CONNECT    (Optional) A flag that indicates that you wish to use wallet connect (and hence the card wallet app) for your wallet
```

## `cardpay prepaidcard-transfer <PREPAID_CARD> <NEW_OWNER> --network=NETWORK [--mnemonic=MNEMONIC] [--walletConnect]`

Transfer a prepaid card to a new owner

```
USAGE
  $ cardpay prepaidcard-transfer <PREPAID_CARD> <NEW_OWNER> --network=NETWORK [--mnemonic=MNEMONIC] [--walletConnect]

ARGUMENTS
  PREPAID_CARD      The address of the prepaid card to transfer
  NEW_OWNER         The address of the new owner
  NETWORK           The network to use ("sokol" or "xdai")
  MNEMONIC          (Optional) Phrase for mnemonic wallet. Also can be pulled from env using MNEMONIC_PHRASE
  WALLET_CONNECT    (Optional) A flag that indicates that you wish to use wallet connect (and hence the card wallet app) for your wallet
```

## `cardpay prepaidcard-provision <SKU> <RECIPIENT> <ENVIRONMENT> <SECRET> --network=NETWORK [--mnemonic=MNEMONIC] [--walletConnect]`

Provision a prepaid card to an EOA

```
USAGE
  $ cardpay prepaidcard-provision <SKU> <RECIPIENT> <ENVIRONMENT> <SECRET> --network=NETWORK [--mnemonic=MNEMONIC] [--walletConnect]`

ARGUMENTS
  SKU               The SKU of the prepaid card to provision
  RECIPIENT         The EOA address of the recipient of the prepaid card
  ENVIRONMENT       The environment to use (staging or production)
  SECRET            The "provisioner secret" phrase to enable provisioning
  NETWORK           The network to use ("sokol" or "xdai")
  MNEMONIC          (Optional) Phrase for mnemonic wallet. Also can be pulled from env using MNEMONIC_PHRASE
  WALLET_CONNECT    (Optional) A flag that indicates that you wish to use wallet connect (and hence the card wallet app) for your wallet
```


## `cardpay price-for-face-value <TOKEN_ADDRESS> <SPEND_FACE_VALUE> --network=NETWORK [--mnemonic=MNEMONIC] [--walletConnect]`
Get the price in the units of the specified token to achieve a prepaid card with the specified face value in SPEND. This takes into account the exchange rate for the specified token as well as the gas fee that is charged for creating a new prepaid card.

```
USAGE
  $ cardpay price-for-face-value <TOKEN_ADDRESS> <SPEND_FACE_VALUE> --network=NETWORK [--mnemonic=MNEMONIC] [--walletConnect]

ARGUMENTS
  TOKEN_ADDRESS      The token address of the token that will be used to pay for the prepaid card
  SPEND_FACE_VALUE   The desired face value in SPEND for the prepaid card
  NETWORK            The network to use ("sokol" or "xdai")
  MNEMONIC           (Optional) Phrase for mnemonic wallet. Also can be pulled from env using MNEMONIC_PHRASE
  WALLET_CONNECT     (Optional) A flag that indicates that you wish to use wallet connect (and hence the card wallet app) for your wallet
```

## `cardpay sku-info <SKU> --network=NETWORK [--mnemonic=MNEMONIC] [--walletConnect]`
Get the details for the prepaid cards available in the market contract for the specified SKU.

```
USAGE
  $ cardpay sku-info <SKU> --network=NETWORK [--mnemonic=MNEMONIC] [--walletConnect]

ARGUMENTS
  SKU                The SKU to obtain details for
  NETWORK            The network to use ("sokol" or "xdai")
  MNEMONIC           (Optional) Phrase for mnemonic wallet. Also can be pulled from env using MNEMONIC_PHRASE
  WALLET_CONNECT     (Optional) A flag that indicates that you wish to use wallet connect (and hence the card wallet app) for your wallet
```

## `cardpay prepaid-card-inventory <SKU> --network=NETWORK [--mnemonic=MNEMONIC] [--walletConnect]`
Get the inventory for a specific SKU from the market contract.

```
USAGE
  $ cardpay prepaid-card-inventory <SKU> --network=NETWORK [--mnemonic=MNEMONIC] [--walletConnect]

ARGUMENTS
  SKU                The SKU to obtain inventory for
  NETWORK            The network to use ("sokol" or "xdai")
  MNEMONIC           (Optional) Phrase for mnemonic wallet. Also can be pulled from env using MNEMONIC_PHRASE
  WALLET_CONNECT     (Optional) A flag that indicates that you wish to use wallet connect (and hence the card wallet app) for your wallet
```

## `cardpay prepaid-card-inventories <ENVIRONMENT> --network=NETWORK [--mnemonic=MNEMONIC] [--walletConnect]`
Get all the inventories available in the market contract.

```
USAGE
  $ cardpay prepaid-card-inventories <ENVIRONMENT> --network=NETWORK [--mnemonic=MNEMONIC] [--walletConnect]

ARGUMENTS
  ENVIRONMENT        Either "staging" or "production" (this field will go away after environment/network alignment has completed)
  NETWORK            The network to use ("sokol" or "xdai")
  MNEMONIC           (Optional) Phrase for mnemonic wallet. Also can be pulled from env using MNEMONIC_PHRASE
  WALLET_CONNECT     (Optional) A flag that indicates that you wish to use wallet connect (and hence the card wallet app) for your wallet
```

## `cardpay add-prepaid-card-inventory <FUNDING_CARD> <PREPAID_CARD> --network=NETWORK [--mnemonic=MNEMONIC] [--walletConnect]`
Adds a prepaid card to the inventory.

```
USAGE
  $ cardpay add-prepaid-card-inventory <FUNDING_CARD> <PREPAID_CARD> --network=NETWORK [--mnemonic=MNEMONIC] [--walletConnect]

ARGUMENTS
  FUNDING_CARD       The prepaid card that is used to pay for gas for the txn
  PREPAID_CARD       The prepaid card to add to the inventory
  NETWORK            The network to use ("sokol" or "xdai")
  MNEMONIC           (Optional) Phrase for mnemonic wallet. Also can be pulled from env using MNEMONIC_PHRASE
  WALLET_CONNECT     (Optional) A flag that indicates that you wish to use wallet connect (and hence the card wallet app) for your wallet
```

## `cardpay remove-prepaid-card-inventory <FUNDING_CARD> <PREPAID_CARDS..> --network=NETWORK [--mnemonic=MNEMONIC] [--walletConnect]`
Removes the specified prepaid cards from the inventory and returns them back to the issuer.

```
USAGE
  $ cardpay remove-prepaid-card-inventory <FUNDING_CARD> <PREPAID_CARDS> --network=NETWORK [--mnemonic=MNEMONIC] [--walletConnect]

ARGUMENTS
  FUNDING_CARD       The prepaid card that is used to pay for gas for the txn
  PREPAID_CARDS      A list of prepaid cards (separated by spaces) to remove from inventory
  NETWORK            The network to use ("sokol" or "xdai")
  MNEMONIC           (Optional) Phrase for mnemonic wallet. Also can be pulled from env using MNEMONIC_PHRASE
  WALLET_CONNECT     (Optional) A flag that indicates that you wish to use wallet connect (and hence the card wallet app) for your wallet
```

## `cardpay set-prepaid-card-ask <PREPAID_CARD> <SKU> <ASK_PRICE> --network=NETWORK [--mnemonic=MNEMONIC] [--walletConnect]`
Set the asking price for prepaid cards associated to a SKU. The ask price is in units of eth in the issuing token for prepaid cards within the SKU

```
USAGE
  $ cardpay set-prepaid-card-ask <PREPAID_CARD> <SKU> <ASK_PRICE> --network=NETWORK [--mnemonic=MNEMONIC] [--walletConnect]

ARGUMENTS
  PREPAID_CARD       The prepaid card used to pay for gas for the txn
  SKU                The SKU whose ask price is being set
  ASK_PRICE          The ask price for the prepaid cards in the SKU in units of eth in the issuing token for the prepaid cards within the SKU
  NETWORK            The network to use ("sokol" or "xdai")
  MNEMONIC           (Optional) Phrase for mnemonic wallet. Also can be pulled from env using MNEMONIC_PHRASE
  WALLET_CONNECT     (Optional) A flag that indicates that you wish to use wallet connect (and hence the card wallet app) for your wallet
```

## `cardpay register-merchant <PREPAID_CARD> <INFO_DID> --network=NETWORK [--mnemonic=MNEMONIC] [--walletConnect]`
Register a new merchant from a prepaid card. The prepaid card will be used to pay the merchant registration fee.

```
USAGE
  $ cardpay register-merchant <PREPAID_CARD> --network=NETWORK [--mnemonic=MNEMONIC] [--walletConnect]

ARGUMENTS
  PREPAID_CARD      The address of the prepaid card that is being used to pay the merchant registration fee
  INFO_DID          The DID string that can be resolved to a DID document representing the merchant's information
  NETWORK           The network to use ("sokol" or "xdai")
  MNEMONIC          (Optional) Phrase for mnemonic wallet. Also can be pulled from env using MNEMONIC_PHRASE
  WALLET_CONNECT    (Optional) A flag that indicates that you wish to use wallet connect (and hence the card wallet app) for your wallet
```

## `cardpay payment-limits --network=NETWORK [--mnemonic=MNEMONIC] [--walletConnect]`
Get the minimum and maximum prepaid card payment limits in SPEND

```
USAGE
  $ cardpay payment-limits --network=NETWORK [--mnemonic=MNEMONIC] [--walletConnect]

ARGUMENTS
  NETWORK           The network to use ("sokol" or "xdai")
  MNEMONIC          (Optional) Phrase for mnemonic wallet. Also can be pulled from env using MNEMONIC_PHRASE
  WALLET_CONNECT    (Optional) A flag that indicates that you wish to use wallet connect (and hence the card wallet app) for your wallet
```

## `cardpay pay-merchant <MERCHANT_SAFE> <PREPAID_CARD> <SPEND_AMOUNT> --network=NETWORK [--mnemonic=MNEMONIC] [--walletConnect]`
Pay a merchant from a prepaid card. The amount of tokens to send to the merchant in units of SPEND.

```
USAGE
  $ cardpay pay-merchant <MERCHANT_SAFE> <PREPAID_CARD> <SPEND_AMOUNT> --network=NETWORK [--mnemonic=MNEMONIC] [--walletConnect]

ARGUMENTS
  MERCHANT_SAFE     The address of the merchant's safe who will receive the payment
  PREPAID_CARD      The address of the prepaid card that is being used to pay the merchant
  SPEND_AMOUNT      The amount to send to the merchant in units of SPEND
  NETWORK           The network to use ("sokol" or "xdai")
  MNEMONIC          (Optional) Phrase for mnemonic wallet. Also can be pulled from env using MNEMONIC_PHRASE
  WALLET_CONNECT    (Optional) A flag that indicates that you wish to use wallet connect (and hence the card wallet app) for your wallet
```

## `cardpay revenue-balances <MERCHANT_SAFE> --network=NETWORK [--mnemonic=MNEMONIC] [--walletConnect]`
View token balances of unclaimed revenue in the revenue pool for a merchant.

```
USAGE
  $ cardpay revenue-balances <MERCHANT_SAFE> --network=NETWORK [--mnemonic=MNEMONIC] [--walletConnect]

ARGUMENTS
  MERCHANT_SAFE     The address of the merchant's safe whose revenue balances are to be viewed
  NETWORK           The network to use ("sokol" or "xdai")
  MNEMONIC          (Optional) Phrase for mnemonic wallet. Also can be pulled from env using MNEMONIC_PHRASE
  WALLET_CONNECT    (Optional) A flag that indicates that you wish to use wallet connect (and hence the card wallet app) for your wallet
```

## `cardpay claim-revenue <MERCHANT_SAFE> <TOKEN_ADDRESS> <AMOUNT> --network=NETWORK [--mnemonic=MNEMONIC] [--walletConnect]`
Claim merchant revenue earned from prepaid card payments.

```
USAGE
  $ cardpay claim-revenue <MERCHANT_SAFE> <TOKEN_ADDRESS> <AMOUNT> --network=NETWORK [--mnemonic=MNEMONIC] [--walletConnect]

ARGUMENTS
  MERCHANT_SAFE     The address of the merchant's safe whose revenue balance is being claimed
  TOKEN_ADDRESS     The address of the tokens that are being claimed as revenue
  AMOUNT            The amount of tokens that are being claimed as revenue (*not* in units of `wei`, but in `eth`)
  NETWORK           The network to use ("sokol" or "xdai")
  MNEMONIC          (Optional) Phrase for mnemonic wallet. Also can be pulled from env using MNEMONIC_PHRASE
  WALLET_CONNECT    (Optional) A flag that indicates that you wish to use wallet connect (and hence the card wallet app) for your wallet
```
## `cardpay claim-revenue-gas-estimate <MERCHANT_SAFE> <TOKEN_ADDRESS> <AMOUNT> --network=NETWORK [--mnemonic=MNEMONIC] [--walletConnect]`
Obtain a gas estimate for claiming merchant revenue.

```
USAGE
  $ cardpay claim-revenue-gas-estimate <MERCHANT_SAFE> <TOKEN_ADDRESS> <AMOUNT> --network=NETWORK [--mnemonic=MNEMONIC] [--walletConnect]

ARGUMENTS
  MERCHANT_SAFE     The address of the merchant's safe whose revenue balance is being claimed
  TOKEN_ADDRESS     The address of the tokens that are being claimed as revenue
  AMOUNT            The amount of tokens that are being claimed as revenue (*not* in units of `wei`, but in `eth`)
  NETWORK           The network to use ("sokol" or "xdai")
  MNEMONIC          (Optional) Phrase for mnemonic wallet. Also can be pulled from env using MNEMONIC_PHRASE
  WALLET_CONNECT    (Optional) A flag that indicates that you wish to use wallet connect (and hence the card wallet app) for your wallet
```

## `cardpay new-prepaidcard-gas-fee <TOKEN_ADDRESS> --network=NETWORK [--mnemonic=MNEMONIC] [--walletConnect]`
Get the gas fee in the units of the specified token for creating a new prepaid card.

```
USAGE
  $ cardpay new-prepaidcard-gas-fee <TOKEN_ADDRESS> --network=NETWORK [--mnemonic=MNEMONIC] [--walletConnect]

ARGUMENTS
  TOKEN_ADDRESS      The token address of the token that will be used to pay for the prepaid card
  NETWORK            The network to use ("sokol" or "xdai")
  MNEMONIC           (Optional) Phrase for mnemonic wallet. Also can be pulled from env using MNEMONIC_PHRASE
  WALLET_CONNECT     (Optional) A flag that indicates that you wish to use wallet connect (and hence the card wallet app) for your wallet
```
## `cardpay safes-view [ADDRESS] [SAFE_TYPE] --network=NETWORK [--mnemonic=MNEMONIC] [--walletConnect]`

View safes that your wallet is the owner of

```
USAGE
  $ cardpay safes-view [ADDRESS] [SAFE_TYPE] --network=NETWORK [--mnemonic=MNEMONIC] [--walletConnect]

ARGUMENTS
  ADDRESS         (Optional) an address of an owner whose safes you wish to view (defaults to the wallet's default account)
  SAFE_TYPE       (Optional) The type of safe to view: 'depot', 'merchant', 'prepaid-card', 'reward'
  NETWORK         The network to use ("sokol" or "xdai")
  MNEMONIC        (Optional) Phrase for mnemonic wallet. Also can be pulled from env using MNEMONIC_PHRASE
  WALLET_CONNECT  (Optional) A flag that indicates that you wish to use wallet connect (and hence the card wallet app) for your wallet
```

## `cardpay safe-view [SAFE_ADDRESS] --network=NETWORK [--mnemonic=MNEMONIC] [--walletConnect]`

View a particular safe

```
USAGE
  $ cardpay safe-view [SAFE_ADDRESS] --network=NETWORK [--mnemonic=MNEMONIC] [--walletConnect]

ARGUMENTS
  SAFE_ADDRESS    The address of a safe to view
  NETWORK         The network to use ("sokol" or "xdai")
  MNEMONIC        (Optional) Phrase for mnemonic wallet. Also can be pulled from env using MNEMONIC_PHRASE
  WALLET_CONNECT  (Optional) A flag that indicates that you wish to use wallet connect (and hence the card wallet app) for your wallet
```

## `cardpay safe-transfer-tokens [SAFE_ADDRESS] [TOKEN_ADDRESS] [RECIPIENT] [AMOUNT] --network=NETWORK [--mnemonic=MNEMONIC] [--walletConnect]`

Transfer tokens from a safe to an arbitrary recipient. The token amount specified is *not* in units of `wei`, but in `eth`. Note that the gas will be paid with the token you are transferring so there must be enough token balance in teh safe to cover both the transferred amount of tokens and gas.

```
USAGE
  $ cardpay safes-view [ADDRESS] --network=NETWORK [--mnemonic=MNEMONIC]

ARGUMENTS
  SAFE_ADDRESS     The address of the safe that is sending the tokens
  TOKEN_ADDRESS    The token address of the tokens to transfer from the safe
  RECIPIENT        The token recipient's address
  AMOUNT           The amount of tokens to transfer (*not* in units of `wei`, but in `eth`).
  NETWORK          The network to use ("sokol" or "xdai")
  MNEMONIC         (Optional) Phrase for mnemonic wallet. Also can be pulled from env using MNEMONIC_PHRASE
  WALLET_CONNECT   (Optional) A flag that indicates that you wish to use wallet connect (and hence the card wallet app) for your wallet
```

## `cardpay safe-transfer-tokens-gas-estimate [SAFE_ADDRESS] [TOKEN_ADDRESS] [RECIPIENT] [AMOUNT] --network=NETWORK [--mnemonic=MNEMONIC] [--walletConnect]`

Obtain the gas estimate to transfer tokens from a safe to an arbitrary recipient. The token amount specified is *not* in units of `wei`, but in `eth`.

```
USAGE
  $ cardpay safes-view [ADDRESS] --network=NETWORK [--mnemonic=MNEMONIC]

ARGUMENTS
  SAFE_ADDRESS     The address of the safe that is sending the tokens
  TOKEN_ADDRESS    The token address of the tokens to transfer from the safe
  RECIPIENT        The token recipient's address
  AMOUNT           The amount of tokens to transfer (*not* in units of `wei`, but in `eth`).
  NETWORK          The network to use ("sokol" or "xdai")
  MNEMONIC         (Optional) Phrase for mnemonic wallet. Also can be pulled from env using MNEMONIC_PHRASE
  WALLET_CONNECT   (Optional) A flag that indicates that you wish to use wallet connect (and hence the card wallet app) for your wallet
```

## `cardpay usd-price <TOKEN> [AMOUNT] --network=NETWORK [--mnemonic=MNEMONIC] [--walletConnect]`
Get the USD value for the specified token name in the specified amount. This returns a floating point number in units of USD.
```
USAGE
  $ cardpay usd-price <TOKEN> <AMOUNT> --network=NETWORK [--mnemonic=MNEMONIC] [--walletConnect]

ARGUMENTS
  TOKEN           The token symbol (without the .CPXD suffix)
  AMOUNT          (Optional) The amount of the specified token (not in units of wei, but in `eth`). Defaults to '1'
  NETWORK         The network to use ("sokol" or "xdai", or if pricing ETH, "kovan" or "mainnet")
  MNEMONIC        (Optional) Phrase for mnemonic wallet. Also can be pulled from env using MNEMONIC_PHRASE
  WALLET_CONNECT  (Optional) A flag that indicates that you wish to use wallet connect (and hence the card wallet app) for your wallet
```

## `cardpay eth-price <TOKEN> [AMOUNT] --network=NETWORK [--mnemonic=MNEMONIC] [--walletConnect]`
Get the ETH value for the specified token name in the specified amount (in units `eth`).
```
USAGE
  $ cardpay eth-price <TOKEN> <AMOUNT> --network=NETWORK [--mnemonic=MNEMONIC] [--walletConnect]

ARGUMENTS
  TOKEN           The token symbol (without the .CPXD suffix)
  AMOUNT          (Optional) The amount of the specified token (not in units of `wei`, but in `eth`). Defaults to '1'
  NETWORK         The network to use ("sokol" or "xdai")
  MNEMONIC        (Optional) Phrase for mnemonic wallet. Also can be pulled from env using MNEMONIC_PHRASE
  WALLET_CONNECT  (Optional) A flag that indicates that you wish to use wallet connect (and hence the card wallet app) for your wallet
```

## `cardpay price-oracle-updated-at <TOKEN> --network=NETWORK [--mnemonic=MNEMONIC] [--walletConnect]`
This returns the date that the oracle was last updated for the specified token.

```
USAGE
  $ cardpay price-oracle-updated-at <TOKEN> --network=NETWORK [--mnemonic=MNEMONIC] [--walletConnect]

ARGUMENTS
  TOKEN           The token symbol (without the .CPXD suffix)
  NETWORK         The network to use ("sokol" or "xdai", or if checking ETH price "kovan" or "mainnet")
  MNEMONIC        (Optional) Phrase for mnemonic wallet. Also can be pulled from env using MNEMONIC_PHRASE
  WALLET_CONNECT  (Optional) A flag that indicates that you wish to use wallet connect (and hence the card wallet app) for your wallet
```

## `cardpay view-token-balance [TOKEN_ADDRESS] --network=NETWORK [--mnemonic=MNEMONIC] [--walletConnect]`
This returns the token balance for the given wallet.

```
USAGE
  $ cardpay view-token-balance [TOKEN_ADDRESS] --network=NETWORK [--mnemonic=MNEMONIC] [--walletConnect]

ARGUMENTS
  TOKEN_ADDRESS     The address of the token to get the balance of. Defaults to native token for network
  NETWORK           The network to use ("kovan", "mainnet", "sokol", "xdai")
  MNEMONIC          (Optional) Phrase for mnemonic wallet. Also can be pulled from env using MNEMONIC_PHRASE
  WALLET_CONNECT    (Optional) A flag that indicates that you wish to use wallet connect (and hence the card wallet app) for your wallet
```
## `cardpay hub-auth [HUB_ROOT_URL] --network=NETWORK [--mnemonic=MNEMONIC] [--walletConnect]`
This returns the token balance for the given wallet.

```
USAGE
  $ cardpay hub-auth [HUB_ROOT_URL] --network=NETWORK [--mnemonic=MNEMONIC] [--walletConnect]

ARGUMENTS
  HUB_ROOT_URL      The root URL of the hub instance to authenticate to, e.g. "https://hub.cardstack.com"
  NETWORK           The network to use ("sokol", "xdai")
  MNEMONIC          (Optional) Phrase for mnemonic wallet. Also can be pulled from env using MNEMONIC_PHRASE
  WALLET_CONNECT    (Optional) A flag that indicates that you wish to use wallet connect (and hence the card wallet app) for your wallet
```
