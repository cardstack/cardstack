# web-client

This README outlines the details of collaborating on this Ember application.

## Prerequisites

You will need the following things properly installed on your computer.

* [Git](https://git-scm.com/)
* [Node.js](https://nodejs.org/)
* [Yarn](https://yarnpkg.com/)
* [Ember CLI](https://cli.emberjs.com/release/)
* [Google Chrome](https://google.com/chrome/)

## Installation

* `git clone <repository-url>` this repository
* `cd packages/web-client`
* `yarn install`

## Running / Development

* `ember serve`
* Visit your app at [http://localhost:4200](http://localhost:4200).
* Visit your tests at [http://localhost:4200/tests](http://localhost:4200/tests).

Note that you will have to run the hub for some functionality of this app, see [the hub README](../hub/README.md#running).

### Required environment variables
Connecting to the Kovan Testnet with WalletConnect requires an Infura project id. This should be specified in a `.env` file in this package's root as:
```
INFURA_ID=<your infura project id here>
```

Deployed versions will use a "HUB_URL" env var, which is processed at the time ember-cl-deploy runs.

### Thread animation interval environment variable
As a convenience for development, you can set the `THREAD_ANIMATION_INTERVAL` environment variable to control how quickly messages in workflows are shown. 

### Code Generators

Make use of the many generators for code, try `ember help generate` for more details

### Running Tests

* `ember test`
* `ember test --server`

### Linting

* `yarn lint`
* `yarn lint:fix`

### Building

* `ember build` (development)
* `ember build --environment production` (production)

### Deploying

This app is deployed using ember-cli-deploy. CI automatically deploys passing builds of the main branch to staging.

## Further Reading / Useful Links

* [ember.js](https://emberjs.com/)
* [ember-cli](https://cli.emberjs.com/release/)
* Development Browser Extensions
  * [ember inspector for chrome](https://chrome.google.com/webstore/detail/ember-inspector/bmdblncegkenkacieihfhpjfppoconhi)
  * [ember inspector for firefox](https://addons.mozilla.org/en-US/firefox/addon/ember-inspector/)
