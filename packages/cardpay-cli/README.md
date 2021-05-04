# cardpay-cli <!-- omit in toc -->
=============

CLI tool for basic actions in Cardpay


# Commands
- [Commands](#commands)
  - [`yarn cardpay bridge <AMOUNT> <TOKEN_ADDRESS> --receiver=<RECEIVER> --network=NETWORK [--mnemonic=MNEMONIC]`](#yarn-cardpay-bridge-amount-token_address---receiverreceiver---networknetwork---mnemonicmnemonic)
  - [`yarn cardpay await-bridged <FROM_BLOCK> [RECIPIENT] --network=NETWORK [--mnemonic=MNEMONIC]`](#yarn-cardpay-await-bridged-from_block-recipient---networknetwork---mnemonicmnemonic)
  - [`yarn cardpay prepaidcard-create <SAFE_ADDRESS> <TOKEN_ADDRESS> <amounts..> --network=NETWORK [--mnemonic=MNEMONIC]`](#yarn-cardpay-prepaidcard-create-safe_address-token_address-amounts---networknetwork---mnemonicmnemonic)
  - [`yarn cardpay safes-view [ADDRESS] --network=NETWORK [--mnemonic=MNEMONIC]`](#yarn-cardpay-safes-view-address---networknetwork---mnemonicmnemonic)



## `yarn cardpay bridge <AMOUNT> <TOKEN_ADDRESS> --receiver=RECEIVER --network=NETWORK [--mnemonic=MNEMONIC]`

Bridge tokens from L1 wallet to L2 safe

```
USAGE
  $ yarn cardpay bridge <amount> <tokenAddress> --receiver=RECEIVER --network=NETWORK [--mnemonic=MNEMONIC]

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
