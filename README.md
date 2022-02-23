# Cardstack App Suite

This is the main repo for [Cardstack](https://www.cardstack.com/), an open source application architecture for building cohesive experiences, including payments, on open, decentralized infrastructure.

Join the discussion around developing on the Cardstack framework on [Discord](https://discord.gg/apepFje), and read our documentation on [docs.cardstack.com](https://docs.cardstack.com). (Note: documentation refers to [Cardstack v2](https://github.com/cardstack/cardstack/tree/cardstack-v2-eol). The main branch of this respository has in-progress work on v3 of Cardstack.)

## Orientation

This is a monorepo. Each directory under `packages` and `cards` is distributed as a standalone NPM package under the `@cardstack` NPM namespace.
More information is available in the `README.md` within each `package`.

## Developing and Testing within this Repo

### Local host names

Set up `app.cardstack.test` and `app-assets.cardstack.test` to resolve to localhost (127.0.0.1). There are a variety of ways to accomplish this, with the most direct being to [edit your /etc/hosts file](https://linuxize.com/post/how-to-edit-your-hosts-file/).

### Hub environment variables

See the [README in the hub package](./packages/hub/README.md) for environment variables that you'll need to setup.

### Fetching waypoint config

To retrieve environment variables for waypoint in a more readable way as an alternative to `waypoint config get`, you can use the convenience script `yarn waypoint-vars`. 

```
// prints a table of variables, with values truncated for readability
yarn waypoint-vars
// prints JSON of variables that contain any of the strings provided (case-insensitive), full values
yarn waypoint-vars VAR_NAME1 VAR_NAME2
```

### Javascript dependencies & Typescript compilation

We use `volta` to manage our global javascript dependencies. In this case, specifically, we use it to manage node and yarn. To use it simply install it following the instructions here: https://docs.volta.sh/guide/getting-started

In development, we use `lerna` to manage the inter-dependencies of all the packages. To get started:

 1. Install node and yarn via volta.
 2. `yarn global add lerna` (use >= 2.0.0 for yarn workspaces integration)
 3. `lerna bootstrap`
 4. Launch the typescript compiler with `yarn compile --watch`
 5. Start ember-cli and the hub node server with `yarn start` and/or run tests with `yarn test`

## Understanding the respositories under the Cardstack organization

The following summary offers an overview of where development is currently ongoing at Cardstack. (Note: any projects linked below that are not currently public will become public soon.)

[cardstack/card-protocol-xdai](https://github.com/cardstack/card-protocol-xdai)
- The Layer 2 contracts for the card protocol live here including
  - PrepaidCardManager contract
  - RevenuePool contract
  - L2 Token contract
  - SPEND token contract
  - BridgeUtilities contract (facilitates token bridge contract)

[cardstack/tokenbridge-contracts](https://github.com/cardstack/tokenbridge-contracts)
  - The home bridge and foreign bridge token contracts

https://github.com/cardstack/card-protocol-relay-service
  - our gnosis relay service, forked to provide additional prepaid card manager
    API's that support gasless interactions with our PrepaidCardManager contract

[cardstack/safe-transaction-service](https://github.com/cardstack/safe-transaction-service)
  - our gnosis transaction service, this was forked to provide transaction
    service for Sokol (xDai uses the gnosis hosted transaction service)

[cardstack/cardstack](https://github.com/cardstack/cardstack)
  - this one! It is our monorepo that contains our CardPay Dapp (as well as eventually
    cardstack hub runtime). Work on the "card compiler" is also occurring in PRs
    of this repository. A proof-of-concept for the dapp was developed
    here: https://github.com/cardstack/card-pay/tree/update-UI-depot

[cardstack/cardwallet](https://github.com/cardstack/cardwallet)
  - our rainbow wallet fork that supplies our mobile client experience.
    Currently it is focused around interacting with Layer 1 contracts,
    eventually we see it as interacting with the Layer2 protocol as well.
    A proof-of-concept was developed here: https://github.com/cardstack/rainbow/branches

[cardstack/infra](https://github.com/cardstack/infra)
  - Holds our terraform scripts to provision AWS and cloudflare (and
    eventually GCP) services for our infrastructure.

[cardstack/boxel](https://github.com/cardstack/boxel)
  - our web UI component library

[cardstack/catalog-experiment](https://github.com/cardstack/catalog-experiment)
  - our planned Javascript build tooling and CDN that eliminates the need for running
    npm/yarn and eliminates the need to maintain a node_modules folder in your web projects

[cardstack/animations-experiment](https://github.com/cardstack/animations-experiment)
  - proof of concept for an animation library that works well with Ember and meets Boxel's
    motion needs

## Project-wide Policy and Community Governance

Cardstack follows semantic versioning. As a young, pre-1.0 project, this means you can continue to expect breaking changes in minor releases. Each package should endeavor to include a CHANGELOG.md once it begins to have a non-trivial number of external users.

We intend to adopt a community RFC governance process for public API changes, based on the Rust and Ember projects. At this pre-1.0 stage, RFCs are optional and changes may still be fast and furious.

Cardstack follows the [Ember Community Guidelines](https://emberjs.com/guidelines/), both because we are a proper subset of the existing Ember community and because we wholeheartedly endorse the same values.

