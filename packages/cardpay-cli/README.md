# cardpay-cli <!-- omit in toc -->
=============

CLI tool for basic actions in Cardpay


# Commands
- [Commands](#commands)
  - [`yarn cardpay bridge <TOKEN_ADDRESS> <AMOUNT> --network=NETWORK [--mnemonic=MNEMONIC]`](#yarn-cardpay-bridge-token_address-amount---networknetwork---mnemonicmnemonic)
  - [`yarn cardpay prepaidcard-create <SAFE_ADDRESS> <TOKEN_ADDRESS> <amounts..> --network=NETWORK [--mnemonic=MNEMONIC]`](#yarn-cardpay-prepaidcard-create-safe_address-token_address-amounts---networknetwork---mnemonicmnemonic)
  - [`yarn cardpay safes-view [ADDRESS] --network=NETWORK [--mnemonic=MNEMONIC]`](#yarn-cardpay-safes-view-address---networknetwork---mnemonicmnemonic)
  - [`yarn cardpay usd-price <TOKEN> <AMOUNT> --network=NETWORK [--mnemonic=mnmonic]`](#yarn-cardpay-usd-price-token-amount---networknetwork---mnemonicmnmonic)
  - [`yarn cardpay eth-price <TOKEN> <AMOUNT> --network=NETWORK [--mnemonic=mnmonic]`](#yarn-cardpay-eth-price-token-amount---networknetwork---mnemonicmnmonic)
  - [`yarn cardpay oracle-updated-at <TOKEN> --network=NETWORK [--mnemonic=mnmonic]`](#yarn-cardpay-oracle-updated-at-token---networknetwork---mnemonicmnmonic)



## `yarn cardpay bridge <TOKEN_ADDRESS> <AMOUNT> --network=NETWORK [--mnemonic=MNEMONIC]`

Bridge tokens from L1 wallet to L2 safe

```
USAGE
  $ yarn cardpay bridge <tokenAddress> <amount> --network=NETWORK [--mnemonic=MNEMONIC]

ARGUMENTS
  TOKEN_ADDRESS   The token address of the token to bridge
  AMOUNT          Amount in ether you would like bridged (not in units of wei)
  NETWORK         The network to use ("kovan" or "mainnet")
  MNEMONIC        (Optional) Phrase for mnemonic wallet. Also can be pulled from env using MNEMONIC_PHRASE
```


## `yarn cardpay prepaidcard-create <SAFE_ADDRESS> <TOKEN_ADDRESS> <amounts..> --network=NETWORK [--mnemonic=MNEMONIC]`

Create a prepaid card using DAI CPXD tokens

```
USAGE
  $ yarn cardpay prepaidcard-create <SAFE_ADDRESS> <TOKEN_ADDRESS> <AMOUNTS..> --network=NETWORK [--mnemonic=MNEMONIC]

ARGUMENTS
  AMOUNTS           A list of amounts (separated by spaces) in ether you would like created for each prepaid card (not in units of wei)
  SAFE_ADDRESS      Layer 2 safe address with DAI CPXD tokens
  TOKEN_ADDRESS     The token address of the token to use to pay for the prepaid cards
  NETWORK           The network to use ("sokol" or "xdai")
  MNEMONIC          (Optional) Phrase for mnemonic wallet. Also can be pulled from env using MNEMONIC_PHRASE
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

## `yarn cardpay usd-price <TOKEN> <AMOUNT> --network=NETWORK [--mnemonic=mnmonic]`
Get the USD value for the specified token name in the specified amount. This returns a floating point number in units of USD.
```
USAGE
  $ yarn cardpay usd-price <TOKEN> <AMOUNT> --network=NETWORK [--mnemonic=MNEMONIC]

ARGUMENTS
  TOKEN     The token symbol (without the .CPXD suffix)
  AMOUNT    The amount of the specified token (not in units of wei)
  NETWORK   The network to use ("sokol" or "xdai")
  MNEMONIC  (Optional) Phrase for mnemonic wallet. Also can be pulled from env using MNEMONIC_PHRASE
```

## `yarn cardpay eth-price <TOKEN> <AMOUNT> --network=NETWORK [--mnemonic=mnmonic]`
Get the ETH value for the specified token name in the specified amount (in units `ether`).
```
USAGE
  $ yarn cardpay eth-price <TOKEN> <AMOUNT> --network=NETWORK [--mnemonic=MNEMONIC]

ARGUMENTS
  TOKEN     The token symbol (without the .CPXD suffix)
  AMOUNT    The amount of the specified token (not in units of wei)
  NETWORK   The network to use ("sokol" or "xdai")
  MNEMONIC  (Optional) Phrase for mnemonic wallet. Also can be pulled from env using MNEMONIC_PHRASE
```

## `yarn cardpay oracle-updated-at <TOKEN> --network=NETWORK [--mnemonic=mnmonic]`
This returns the date that the oracle was last updated for the specified token.

```
USAGE
  $ yarn cardpay oracle-updated-at <TOKEN> --network=NETWORK [--mnemonic=MNEMONIC]

ARGUMENTS
  TOKEN     The token symbol (without the .CPXD suffix)
  NETWORK   The network to use ("sokol" or "xdai")
  MNEMONIC  (Optional) Phrase for mnemonic wallet. Also can be pulled from env using MNEMONIC_PHRASE
```