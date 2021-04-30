# cardpay-cli <!-- omit in toc -->
=============

CLI tool for basic actions in Cardpay


# Commands
- [Commands](#commands)
  - [`yarn cardpay bridge <TOKEN_ADDRESS> <AMOUNT> --network=NETWORK [--mnemonic=MNEMONIC]`](#yarn-cardpay-bridge-token_address-amount---networknetwork---mnemonicmnemonic)
  - [`yarn cardpay prepaidcard-create <SAFE_ADDRESS> <TOKEN_ADDRESS> <amounts..> --network=NETWORK [--mnemonic=MNEMONIC]`](#yarn-cardpay-prepaidcard-create-safe_address-token_address-amounts---networknetwork---mnemonicmnemonic)
  - [`yarn cardpay safes-view [ADDRESS] --network=NETWORK [--mnemonic=MNEMONIC]`](#yarn-cardpay-safes-view-address---networknetwork---mnemonicmnemonic)



## `yarn cardpay bridge <TOKEN_ADDRESS> <AMOUNT> --network=NETWORK [--mnemonic=MNEMONIC]`

Bridge tokens from L1 wallet to L2 safe

```
USAGE
  $ yarn cardpay bridge <tokenAddress> <amount> --network=NETWORK [--mnemonic=MNEMONIC]

ARGUMENTS
  TOKEN_ADDRESS   The token address of the token to bridge
  AMOUNT          Amount in ether you would like bridged
  NETWORK         The network to use ("kovan" or "mainnet")
  MNEMONIC        (Optional) Phrase for mnemonic wallet. Also can be pulled from env using MNEMONIC_PHRASE
```


## `yarn cardpay prepaidcard-create <SAFE_ADDRESS> <TOKEN_ADDRESS> <amounts..> --network=NETWORK [--mnemonic=MNEMONIC]`

Create a prepaid card using DAI CPXD tokens

```
USAGE
  $ yarn cardpay prepaidcard-create <SAFE_ADDRESS> <TOKEN_ADDRESS> <AMOUNTS..> --network=NETWORK [--mnemonic=MNEMONIC]

ARGUMENTS
  AMOUNTS           A list of amounts (separated by spaces) in ether you would like created for each prepaid card
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
