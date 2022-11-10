# @cardstack/cardpay-subgraph

This project includes the subgraph necessary to generate a GraphQL based query system for the safe tools project.

The subgraph is hosted at:

- goerli: https://thegraph.com/hosted-service/subgraph/cardstack/safe-tools-goerli
- mumbai: https://thegraph.com/hosted-service/subgraph/cardstack/safe-tools-mumbai

Currently we are indexing safes that users provision using the safe tools interface. We're saving the account's address, safe address, and the scheduled payment module address and keep track of their ownership. This data is used by the safe tools for creating scheduled payments.

## Building and deploying

1. `yarn build --network <NETWORK>`
2. `yarn deploy:<NETWORK> --access-token <TOKEN>`
