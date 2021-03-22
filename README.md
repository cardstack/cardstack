# Cardstack App Suite

This is the main repo for [Cardstack](https://www.cardstack.com/), an open source application architecture for building cohesive experiences, including payments, on open, decentralized infrastructure.

Join the discussion around developing on the Cardstack framework on [Discord](https://discord.gg/apepFje), and read our documentation on [docs.cardstack.com](https://docs.cardstack.com).

## Orientation

This is a monorepo. Each directory under `packages` and `cards` is distributed as a standalone NPM package under the `@cardstack` NPM namespace.
More information is available in the `README.md` within each `package`.

## Developing and Testing within this Repo

### Local host names

Set up `app.cardstack.test` and `app-assets.cardstack.test` to resolve to localhost (127.0.0.1). There are a variety of ways to accomplish this, with the most direct being to [edit your /etc/hosts file](https://linuxize.com/post/how-to-edit-your-hosts-file/).

### Javascript dependencies & Typescript compilation

We use `volta` to manage our global javascript dependencies. In this case, specifically, we use it to manage node and yarn. To use it simply install it following the instructions here: https://docs.volta.sh/guide/getting-started

In development, we use `lerna` to manage the inter-dependencies of all the packages. To get started:

 1. Install node and yarn via volta.
 2. `yarn global add lerna` (use >= 2.0.0 for yarn workspaces integration)
 3. `lerna bootstrap`
 4. Launch the typescript compiler with `yarn compile --watch`
 5. Start ember-cli and the hub node server with `yarn start` and/or run tests with `yarn test`

## Project-wide Policy and Community Governance

Cardstack follows semantic versioning. As a young, pre-1.0 project, this means you can continue to expect breaking changes in minor releases. Each package should endeavor to include a CHANGELOG.md once it begins to have a non-trivial number of external users.

We intend to adopt a community RFC governance process for public API changes, based on the Rust and Ember projects. At this pre-1.0 stage, RFCs are optional and changes may still be fast and furious.

Cardstack follows the [Ember Community Guidelines](https://emberjs.com/guidelines/), both because we are a proper subset of the existing Ember community and because we wholeheartedly endorse the same values.

