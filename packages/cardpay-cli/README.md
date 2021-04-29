# cardpay-cli <!-- omit in toc -->
=============

CLI tool for basic actions in Cardpay


# Commands
- [Commands](#commands)
  - [`yarn bridge --network=NETWORK --amount=AMOUNT [--mnemonic=MNEMONIC]`](#yarn-bridge---networknetwork---amountamount---mnemonicmnemonic)
  - [`yarn createPrepaidCard --network=NETWORK --amount=AMOUNT --safe=SAFE_ADDRESS [--mnemonic=MNEMONIC]`](#yarn-createprepaidcard---networknetwork---amountamount---safesafe_address---mnemonicmnemonic)
  - [`yarn viewSafes --network=NETWORK [--mnemonic=MNEMONIC]`](#yarn-viewsafes---networknetwork---mnemonicmnemonic)



## `yarn bridge --network=NETWORK --amount=AMOUNT [--mnemonic=MNEMONIC]`

Bridge tokens from L1 wallet to L2 safe

```
USAGE
  $ yarn bridge --network=NETWORK --amount=AMOUNT [--mnemonic=MNEMONIC]

ARGUMENTS
  NETWORK   The network to use ("kovan" or "mainnet")
  AMOUNT    Amount in ether you would like bridged
  MNEMONIC  (Optional) Phrase for mnemonic wallet. Also can be pulled from env using MNEMONIC_PHRASE
```


## `yarn createPrepaidCard --network=NETWORK --amount=AMOUNT --safe=SAFE_ADDRESS [--mnemonic=MNEMONIC]`

Create a prepaid card using DAI CPXD tokens

```
USAGE
  $ yarn createPrepaidCard --network=NETWORK --amount=AMOUNT --safe=SAFE_ADDRESS [--mnemonic=MNEMONIC]

ARGUMENTS
  NETWORK           The network to use ("sokol" or "xdai")
  AMOUNT            Amount in ether you would like bridged
  SAFE_ADDRESS      Layer 2 safe address with DAI CPXD tokens
  MNEMONIC          (Optional) Phrase for mnemonic wallet. Also can be pulled from env using MNEMONIC_PHRASE
```



## `yarn viewSafes --network=NETWORK [--mnemonic=MNEMONIC]`

View safes that your wallet is the owner of

```
USAGE
  $ yarn viewSafes --network=NETWORK [--mnemonic=MNEMONIC]

ARGUMENTS
  NETWORK   The network to use ("sokol" or "xdai")
  MNEMONIC  (Optional) Phrase for mnemonic wallet. Also can be pulled from env using MNEMONIC_PHRASE
```
