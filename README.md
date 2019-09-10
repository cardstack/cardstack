# Cardstack Application Framework

This is the main repo for [Cardstack](https://www.cardstack.com/), an open source application architecture for building cohesive experiences on open, decentralized infrastructure.

Join the discussion around developing on the Cardstack framework on [Discord](https://discord.gg/apepFje).

## Orientation

This is a monorepo. Each directory under `packages` is distributed as a standalone NPM package under the `@cardstack` NPM namespace. Each package is a Cardstack plugin. A family of Cardstack plugins comes together to provide both browser-side and server-side functionality of a Cardstack application.

Many Cardstack plugins are also [Ember addons](https://ember-cli.com/extending/#developing-addons-and-blueprints), which is the standard way for a Cardstack plugin to provide client-side functionality.

### Cardstack Plugin Features

A Cardstack Plugin is any npm package with "cardstack-plugin" in its `package.json`'s `keywords` list. It may export any number of *features*. Each feature falls into one of the following feature types.

| Feature Type              | Description              |
| --------------------------|--------------------------|
| authenticator             | Server-side functions and client-side components for authenticating users against some authentication sources. Examples: @cardstack/github-auth, @cardstack/drupal-auth, @cardstack/email-auth                  |
| code-generator            | Allows a cardstack plugin to emit dynamically changing Javascript that can be both precompiled into an app and dynamically reloaded on demand. Examples: @cardstack/models, @cardstack/hub::environment        |
| constraint-type           | A logical constraint that users may configure and apply to their data models. Examples: @cardstack/core-types::max-length |
| field-type                | Validation, formatting, and editor components for a scalar data type. Examples: @cardstack/core-types::string, @cardstack/mobiledoc       |
| indexer                   | Indexes content from some arbitrary external data source into Cardstack Hub's fast cache. Examples: @cardstack/git, @cardstack/postgresql, @cardstack/drupal |
| messenger                 | Implements a way to send messages out to some arbitrary data sink. Example: @cardstack/email |
| middleware                | Allows a plugin to install arbitrary server-side middleware. This is a fairly low-level feature -- often you can implement more specific feature types instead, relying on standard middleware like @cardstack/jsonapi. Examples: @cardstack/jsonapi, @cardstack/authentication |
| searcher                  | Provides deep searches in some data source (as opposed to an indexer, which pre-indexes external data sources for fast local searches). An example is the @cardstack/pgsearch searcher, which is the default searcher used internally by Cardstack Hub.
| writers                   | Writes content back out to some arbitrary external data source. Works in tandem with an indexer or searcher to provide full round-trip integration. Examples: @cardstack/git, @cardstack/postgresql. |


### Cardstack Plugins in this Repo

While third-party Cardstack plugins are heartily encouraged, the plugins in this repo (and distributed under the `@cardstack/` NPM namespace) comprise the core Cardstack framework and are therefore subject to Cardstack's community governance and stability policies.

| NPM Package               | Directory                 | Description  |
| --------------------------|---------------------------|--------------|
| @cardstack/authentication | ./packages/authentication | Core infrastructure for user authentication. Authenticator plugins like @cardstack/github-auth or @cardstack/drupal-auth depend on this package. |
| @cardstack/codegen        | ./packages/codegen        | Core infrastructure for injecting dynamically generated Javascript into applications. Used by packages like @cardstack/models |
| @cardstack/core-types     | ./packages/core-types     | A family of field types and constraints that almost any app will need.|
| @cardstack/di             | ./packages/di             | Dependency injection library, based on [@glimmer/di](https://github.com/glimmerjs/glimmer-di), used within the Cardstack Hub server.|
| @cardstack/email          | ./packages/email          | Messenger plugin for sending email via direct SMTP, sendmail, or Amazon SES.|
| @cardstack/email-auth     | ./packages/email-auth     | User authentication via email (or any other messenger plugin) verification. |
| @cardstack/ephemeral      | ./packages/ephemeral      | An in-memory data source that is very useful in testing and development. Implements both indexer and writer features.|
| @cardstack/eslint-config  | ./packages/eslint-config  | Standard [eslint](https://eslint.org/) rules used throughout the Cardstack packages. |
| @cardstack/ethereum       | ./packages/ethereum       | Data source plugin for indexing Ethereum smart contracts. Provides incremental indexing via blockheight, as well as indexing based on configured Ethereum events. Indexes smart contracts, address based mappings within smart contracts, and Ethereum events fired from smart contracts.|
| @cardstack/git            | ./packages/git            | Data source plugin for indexing and writing a Git repository. |
| @cardstack/github-auth    | ./packages/github-auth    | An authenticator plugin for authenticating users against GitHub via OAuth2. |
| @cardstack/handlebars     | ./packages/handlebars     | A field-type plugin for manipulating [Handlebars](http://handlebarsjs.com/) templates.|
| @cardstack/hub            | ./packages/hub            | The main entrypoint for the Cardstack Hub server. It finds and coordinates all the server-side features of all the Cardstack plugins that you have installed and configured.|
| @cardstack/image          | ./packages/image          | A field-type plugin for managing images.|
| @cardstack/jsonapi        | ./packages/jsonapi        | A middleware plugin that implements a [JSONAPI spec](http://jsonapi.org/)-compliant web API. This is the most conventional way to speak to Cardstack Hub. |
| @cardstack/mobiledoc      | ./packages/mobiledoc      | A field-type plugin for [Mobiledoc](https://bustle.github.io/mobiledoc-kit/demo/)-formatted content. Mobiledoc is Cardstack's preferred way to store rich user-editable content.|
| @cardstack/models         | ./packages/models         | A code-generator plugin that provides automatic [Ember Data](https://github.com/emberjs/data) models to match your current user-defined schema. |
| @cardstack/pgsearch       | ./packages/pgsearch       | A library used manage the backing index in postgres. Provides reference invalidation logic to accurately update resources and referenced resources from the index.|
| @cardstack/plugin-utils   | ./packages/plugin-utils   | Library used by most other Cardstack plugins for common things like Hub-friendly logging, standard Error formatting, etc. |
| @cardstack/postgresql     | ./packages/postgresql     | Data source plugin for read/write connectivity to [PostgreSQL](https://www.postgresql.org/). Provides reliable incremental indexing via [Logical Decoding](https://www.postgresql.org/docs/9.6/static/logicaldecoding.html).|
| @cardstack/queue          | ./packages/queue          | A library that provides a job queuing service for async tasks leveraging pg-boss |
| @cardstack/rendering      | ./packages/rendering      | Fundamental client-side components for rendering Cardstack-managed content.|
| @cardstack/routing        | ./packages/routing        | Standardized client-side routing to all Cardstack-managed content.|
| @cardstack/search         | ./packages/search         | Client-side components for querying arbitrary sets of Cardstack Content.|
| @cardstack/test-support   | ./packages/test-support   | Helps authors of Cardstack apps and Cardstack plugins write automated tests.|


## Developing and Testing within this Repo

In development, we use `lerna` to manage the inter-dependencies of all the packages. To get started:

 1. Install node >= 8.
 2. Install yarn >= 0.28 (earlier versions work but will not benefit from [Workspaces](https://yarnpkg.com/blog/2017/08/02/introducing-workspaces/)).
 3. `yarn global add lerna` (use >= 2.0.0 for yarn workspaces integration)
 4. `lerna bootstrap`
 5. Launch the typescript compiler with `yarn compile --watch`


### Test Suite Dependencies

There is work-in-progress to make Cardstack Hub automatically manage docker-based microservices, but for the present you need to start these things up manually to run the full test suite:

    docker run -d -p 5432:5432 --rm cardstack/pg-test
    docker run -d -p 9022:22 --rm cardstack/git-test

Additionally, for the Ethereum tests, you'll need to start a private blockchain. We use [truffle](http://truffleframework.com/docs/) to orchestrate our private blockchain and clear on-chain state
in between the tests. You can start a private blockchain by executing:
```
yarn run blockchain &
```

If you want to run a public blockchain node locally, use the following docker command:
```
docker run -d --name ethereum-node -v /your/blockchain/data/dir:/root \
     -p 8545:8545 -p 8546:8546 -p 30303:30303 \
     ethereum/client-go --rinkeby --fast --rpc --rpcapi eth,net,web3 --ws --wsorigins '*' --wsapi eth,net,web3
```

Where `/your/bockchain/data/dir` is a directory on your docker host that will persist the downloaded blocks in between docker restarts.
Additionaly you can omit the `--rinkeby` flag to run on the ethereum mainnet. The Cardstack hub is most interested in the
websocket API from geth, which will be running on `ws://localhost:8546`. After you start geth for the first time, it will take a few hours
to download all the blocks. You can keep track of the downloaded block numbers and compare it with the current block height to monitor progress.

### Development in Windows

If you are building the Cardstack `ethereum` plugin, either standalone or as a dependency in another project, you will need to have the Windows C++ binaries (akin to having XCode installed on macOS) and the Python executable available. If you do not, you will likely encounter an error similar to the following:

```
node_modules\\scrypt\\build\\scrypt_wrapper.vcxproj(20,3): error MSB4019: The imported project \"C:\\Microsoft.Cpp.Default.props\" was not found. Confirm that the path in the <Import> declaration is correct, and that the file exists on disk.
gyp ERR! build error
gyp ERR! stack Error: `C:\\Windows\\Microsoft.NET\\Framework\\v4.0.30319\\msbuild.exe` failed with exit code: 1

```

Fortunately, you do *not* need to install the entire Visual Studio suite to accomplish this, there is a very helpful npm package called `windows-build-tools`, tl;dr, do this (it takes a *long* time):

```
npm install --global --production windows-build-tools
```

Refer to the [repo](https://github.com/felixrieseberg/windows-build-tools) for more info.


## Project-wide Policy and Community Governance

Cardstack follows semantic versioning. As a young, pre-1.0 project, this means you can continue to expect breaking changes in minor releases. Each package should endeavor to include a CHANGELOG.md once it begins to have a non-trivial number of external users.

We intend to adopt a community RFC governance process for public API changes, based on the Rust and Ember projects. At this pre-1.0 stage, RFCs are optional and changes may still be fast and furious.

Cardstack follows the [Ember Community Guidelines](https://emberjs.com/guidelines/), both because we are a proper subset of the existing Ember community and because we wholeheartedly endorse the same values.

