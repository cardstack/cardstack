# cardpay-cli <!-- omit in toc -->
=============

CLI tool for basic actions in Cardpay


# Commands
- [Commands](#commands)
  - [`yarn cardpay bridge <AMOUNT> <TOKEN_ADDRESS> [RECEIVER] --network=NETWORK [--mnemonic=MNEMONIC]`](#yarn-cardpay-bridge-amount-token_address-receiver---networknetwork---mnemonicmnemonic)
  - [`yarn cardpay await-bridged <FROM_BLOCK> [RECIPIENT] --network=_NETWORK [--mnemonic=MNEMONIC]`](#yarn-cardpay-await-bridged-from_block-recipient---network_network---mnemonicmnemonic)
  - [`yarn cardpay prepaidcard-create <SAFE_ADDRESS> <TOKEN_ADDRESS> <FACE_VALUES..> --network=NETWORK [--mnemonic=MNEMONIC]`](#yarn-cardpay-prepaidcard-create-safe_address-token_address-face_values---networknetwork---mnemonicmnemonic)
  - [`yarn cardpay price-for-face-value <TOKEN_ADDRESS> <SPEND_FACE_VALUE> --network=NETWORK [--mnemonic=MNEMONIC]`](#yarn-cardpay-price-for-face-value-token_address-spend_face_value---networknetwork---mnemonicmnemonic)
  - [`yarn cardpay pay-merchant <MERCHANT_SAFE> <PREPAID_CARD> <AMOUNT> --network=NETWORK [--mnemonic=MNEMONIC]`](#yarn-cardpay-pay-merchant-merchant_safe-prepaid_card-amount---networknetwork---mnemonicmnemonic)
  - [`yarn cardpay new-prepaidcard-gas-fee <TOKEN_ADDRESS> --network=NETWORK [--mnemonic=MNEMONIC]`](#yarn-cardpay-new-prepaidcard-gas-fee-token_address---networknetwork---mnemonicmnemonic)
  - [`yarn cardpay safes-view [ADDRESS] --network=NETWORK [--mnemonic=MNEMONIC]`](#yarn-cardpay-safes-view-address---networknetwork---mnemonicmnemonic)
  - [`yarn cardpay safe-transfer-tokens [TOKEN_ADDRESS] [RECIPIENT] [AMOUNT] --network=NETWORK [--mnemonic=MNEMONIC]`](#yarn-cardpay-safe-transfer-tokens-token_address-recipient-amount---networknetwork---mnemonicmnemonic)
  - [`yarn cardpay usd-price <TOKEN> [AMOUNT] --network=NETWORK [--mnemonic=MNEMONIC]`](#yarn-cardpay-usd-price-token-amount---networknetwork---mnemonicmnemonic)
  - [`yarn cardpay eth-price <TOKEN> [AMOUNT] --network=NETWORK [--mnemonic=MNEMONIC]`](#yarn-cardpay-eth-price-token-amount---networknetwork---mnemonicmnemonic)
  - [`yarn cardpay price-oracle-updated-at <TOKEN> --network=NETWORK [--mnemonic=MNEMONIC]`](#yarn-cardpay-price-oracle-updated-at-token---networknetwork---mnemonicmnemonic)
  - [`yarn cardpay view-token-balance [TOKEN_ADDRESS] --network=NETWORK [--mnemonic=MNEMONIC]`](#yarn-cardpay-view-token-balance-token_address---networknetwork---mnemonicmnemonic)
  - [`yarn cardpay hub-auth <HUB_HOST> --network=NETWORK [--mnemonic=MNEMONIC]` ]
  (#yarn-cardpay-hub-auth-hub_host---networknetwork---mnemonicmnemonic)


## `yarn cardpay bridge <AMOUNT> <TOKEN_ADDRESS> [RECEIVER] --network=NETWORK [--mnemonic=MNEMONIC]`

Bridge tokens from L1 wallet to L2 safe

```
USAGE
  $ yarn cardpay bridge <amount> <tokenAddress> [receiver] --network=NETWORK [--mnemonic=MNEMONIC]

ARGUMENTS
  AMOUNT          Amount in ether you would like bridged
  TOKEN_ADDRESS   The token address of the token to bridge
  RECEIVER        Layer 2 address to be owner of L2 safe, defaults to same as L1 address
  NETWORK         The Layer 1 network to use ("kovan" or "mainnet")
  MNEMONIC        (Optional) Phrase for mnemonic wallet. Also can be pulled from env using MNEMONIC_PHRASE
```

## `yarn cardpay await-bridged <FROM_BLOCK> [RECIPIENT] --network=_NETWORK [--mnemonic=MNEMONIC]`

Wait for token bridging to complete on L2

```
USAGE
  $ yarn cardpay await-bridged <fromBlock> [recipient] --network=NETWORK [--mnemonic=MNEMONIC]

ARGUMENTS
  FROM_BLOCK      Layer 2 block height before bridging was initiated
  RECIPIENT       Layer 2 address that is the owner of the bridged tokens, defaults to wallet address
  NETWORK         The Layer 2 network to use ("sokol" or "xdai")
  MNEMONIC        (Optional) Phrase for mnemonic wallet. Also can be pulled from env using MNEMONIC_PHRASE
```

## `yarn cardpay prepaidcard-create <SAFE_ADDRESS> <TOKEN_ADDRESS> <FACE_VALUES..> --network=NETWORK [--mnemonic=MNEMONIC]`

Create a prepaid card using DAI CPXD tokens

```
USAGE
  $ yarn cardpay prepaidcard-create <SAFE_ADDRESS> <TOKEN_ADDRESS> <FACE_VALUES..> --network=NETWORK [--mnemonic=MNEMONIC]

ARGUMENTS
  FACE_VALUES       A list of face values (separated by spaces) in units of § SPEND to create
  SAFE_ADDRESS      Layer 2 safe address with DAI CPXD tokens
  TOKEN_ADDRESS     The token address of the token to use to pay for the prepaid cards
  NETWORK           The network to use ("sokol" or "xdai")
  MNEMONIC          (Optional) Phrase for mnemonic wallet. Also can be pulled from env using MNEMONIC_PHRASE
```

## `yarn cardpay price-for-face-value <TOKEN_ADDRESS> <SPEND_FACE_VALUE> --network=NETWORK [--mnemonic=MNEMONIC]`
Get the price in the units of the specified token to achieve a prepaid card with the specified face value in SPEND. This takes into account the exchange rate for the specified token as well as the gas fee that is charged for creating a new prepaid card.

```
USAGE
  $ yarn cardpay price-for-face-value <TOKEN_ADDRESS> <SPEND_FACE_VALUE> --network=NETWORK [--mnemonic=MNEMONIC]

ARGUMENTS
  TOKEN_ADDRESS      The token address of the token that will be used to pay for the prepaid card
  SPEND_FACE_VALUE   The desired face value in SPEND for the prepaid card
  NETWORK            The network to use ("sokol" or "xdai")
  MNEMONIC           (Optional) Phrase for mnemonic wallet. Also can be pulled from env using MNEMONIC_PHRASE
```

## `yarn cardpay pay-merchant <MERCHANT_SAFE> <PREPAID_CARD> <AMOUNT> --network=NETWORK [--mnemonic=MNEMONIC]`
Pay a merchant from a prepaid card. The amount of tokens to send to the merchant in units of SPEND.

```
USAGE
  $ yarn cardpay pay-merchant <MERCHANT_SAFE> <PREPAID_CARD> <AMOUNT> --network=NETWORK [--mnemonic=MNEMONIC]

ARGUMENTS
  MERCHANT_SAFE     The address of the merchant's safe who will receive the payment
  PREPAID_CARD      The address of the prepaid card that is being used to pay the merchant
  AMOUNT            The amount to send to the merchant in units of SPEND
  NETWORK           The network to use ("sokol" or "xdai")
  MNEMONIC          (Optional) Phrase for mnemonic wallet. Also can be pulled from env using MNEMONIC_PHRASE
```

## `yarn cardpay new-prepaidcard-gas-fee <TOKEN_ADDRESS> --network=NETWORK [--mnemonic=MNEMONIC]`
Get the gas fee in the units of the specified token for creating a new prepaid card.

```
USAGE
  $ yarn cardpay new-prepaidcard-gas-fee <TOKEN_ADDRESS> --network=NETWORK [--mnemonic=MNEMONIC]

ARGUMENTS
  TOKEN_ADDRESS      The token address of the token that will be used to pay for the prepaid card
  NETWORK            The network to use ("sokol" or "xdai")
  MNEMONIC           (Optional) Phrase for mnemonic wallet. Also can be pulled from env using MNEMONIC_PHRASE
```
## `yarn cardpay safes-view [ADDRESS] --network=NETWORK [--mnemonic=MNEMONIC]`

View safes that your wallet is the owner of

```
USAGE
  $ yarn cardpay safes-view [ADDRESS] --network=NETWORK [--mnemonic=MNEMONIC]

ARGUMENTS
  ADDRESS   (Optional) an address of an owner whose safes you wish to view (defaults to the wallet's default account)
  NETWORK   The network to use ("sokol" or "xdai")
  MNEMONIC  (Optional) Phrase for mnemonic wallet. Also can be pulled from env using MNEMONIC_PHRASE
```

## `yarn cardpay safe-transfer-tokens [SAFE_ADDRESS] [TOKEN_ADDRESS] [RECIPIENT] [AMOUNT] --network=NETWORK [--mnemonic=MNEMONIC]`

Transfer tokens from a safe to an arbitrary recipient. The token amount specified is *not* in units of `wei`. Note that the gas will be paid with the token you are transferring so there must be enough token balance in teh safe to cover both the transferred amount of tokens and gas.

```
USAGE
  $ yarn cardpay safes-view [ADDRESS] --network=NETWORK [--mnemonic=MNEMONIC]

ARGUMENTS
  SAFE_ADDRESS     The address of the safe that is sending the tokens
  TOKEN_ADDRESS    The token address of the tokens to transfer from the safe
  RECIPIENT        The token recipient's address
  AMOUNT           The amount of tokens to transfer (*not* in units of `wei`).
  NETWORK   The network to use ("sokol" or "xdai")
  MNEMONIC  (Optional) Phrase for mnemonic wallet. Also can be pulled from env using MNEMONIC_PHRASE
```

## `yarn cardpay usd-price <TOKEN> [AMOUNT] --network=NETWORK [--mnemonic=MNEMONIC]`
Get the USD value for the specified token name in the specified amount. This returns a floating point number in units of USD.
```
USAGE
  $ yarn cardpay usd-price <TOKEN> <AMOUNT> --network=NETWORK [--mnemonic=MNEMONIC]

ARGUMENTS
  TOKEN     The token symbol (without the .CPXD suffix)
  AMOUNT    (Optional) The amount of the specified token (not in units of wei).
  NETWORK   The network to use ("sokol" or "xdai")
  MNEMONIC  (Optional) Phrase for mnemonic wallet. Also can be pulled from env using MNEMONIC_PHRASE
```

## `yarn cardpay eth-price <TOKEN> [AMOUNT] --network=NETWORK [--mnemonic=MNEMONIC]`
Get the ETH value for the specified token name in the specified amount (in units `ether`).
```
USAGE
  $ yarn cardpay eth-price <TOKEN> <AMOUNT> --network=NETWORK [--mnemonic=MNEMONIC]

ARGUMENTS
  TOKEN     The token symbol (without the .CPXD suffix)
  AMOUNT    The amount of the specified token (not in units of wei)
  AMOUNT    (Optional) The amount of the specified token (not in units of wei).
  NETWORK   The network to use ("sokol" or "xdai")
  MNEMONIC  (Optional) Phrase for mnemonic wallet. Also can be pulled from env using MNEMONIC_PHRASE
```

## `yarn cardpay price-oracle-updated-at <TOKEN> --network=NETWORK [--mnemonic=MNEMONIC]`
This returns the date that the oracle was last updated for the specified token.

```
USAGE
  $ yarn cardpay price-oracle-updated-at <TOKEN> --network=NETWORK [--mnemonic=MNEMONIC]

ARGUMENTS
  TOKEN     The token symbol (without the .CPXD suffix)
  NETWORK   The network to use ("sokol" or "xdai")
  MNEMONIC  (Optional) Phrase for mnemonic wallet. Also can be pulled from env using MNEMONIC_PHRASE
```

## `yarn cardpay view-token-balance [TOKEN_ADDRESS] --network=NETWORK [--mnemonic=MNEMONIC]`
This returns the token balance for the given wallet.

```
USAGE
  $ yarn cardpay view-token-balance [TOKEN_ADDRESS] --network=NETWORK [--mnemonic=MNEMONIC]

ARGUMENTS
  TOKEN_ADDRESS     The address of the token to get the balance of. Defaults to native token for network
  NETWORK           The network to use ("kovan", "mainnet", "sokol", "xdai")
  MNEMONIC          (Optional) Phrase for mnemonic wallet. Also can be pulled from env using MNEMONIC_PHRASE
```
## `yarn cardpay hub-auth [HUB_HOST] --network=NETWORK [--mnemonic=MNEMONIC]`
This returns the token balance for the given wallet.

```
USAGE
  $ yarn cardpay hub-auth [HUB_HOST] --network=NETWORK [--mnemonic=MNEMONIC]

ARGUMENTS
  HUB_HOST          The host name of the hub instance to authenticate to
  NETWORK           The network to use ("sokol", "xdai")
  MNEMONIC          (Optional) Phrase for mnemonic wallet. Also can be pulled from env using MNEMONIC_PHRASE
```