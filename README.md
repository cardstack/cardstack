# Cardstack Application Framework

This is the main repo for [Cardstack](https://www.cardstack.com/), an open source application architecture for building cohesive experiences on open, decentralized infrastructure.

Join the discussion around developing on the Cardstack framework on [Discord](https://discord.gg/apepFje).

## Orientation

This is a monorepo. Each directory under `packages` and `cards` is distributed as a standalone NPM package under the `@cardstack` NPM namespace.

## Developing and Testing within this Repo
We use `volta` to manage our global javascript dependencies. In this case, specifically, we use it to manage node and yarn. To use it simply install it following the instructions here: https://docs.volta.sh/guide/getting-started

In development, we use `lerna` to manage the inter-dependencies of all the packages. To get started:

 1. Install node >= 12.
 2. Install yarn >= 0.28 (earlier versions work but will not benefit from [Workspaces](https://yarnpkg.com/blog/2017/08/02/introducing-workspaces/)).
 3. `yarn global add lerna` (use >= 2.0.0 for yarn workspaces integration)
 4. `lerna bootstrap`
 5. Launch the typescript compiler with `yarn compile --watch`


### Test Suite Dependencies

There is work-in-progress to make Cardstack Hub automatically manage docker-based microservices, but for the present you need to start these things up manually to run the full test suite:

    docker run -d -p 5432:5432 --rm cardstack/pg-test
    docker run -d -p 8838:80 --rm cardstack/git-http-server

## Project-wide Policy and Community Governance

Cardstack follows semantic versioning. As a young, pre-1.0 project, this means you can continue to expect breaking changes in minor releases. Each package should endeavor to include a CHANGELOG.md once it begins to have a non-trivial number of external users.

We intend to adopt a community RFC governance process for public API changes, based on the Rust and Ember projects. At this pre-1.0 stage, RFCs are optional and changes may still be fast and furious.

Cardstack follows the [Ember Community Guidelines](https://emberjs.com/guidelines/), both because we are a proper subset of the existing Ember community and because we wholeheartedly endorse the same values.

