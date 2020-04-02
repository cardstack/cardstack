# cardhost

The cardhost, aka Card Builder, is an application container that hosts cards. The cardhost is deployed as a stand-alone ember application outside of the mono repo.
It works together with the Hub.

## Prerequisites

You will need the following things properly installed on your computer.

* [Git](https://git-scm.com/)
* [Node.js](https://nodejs.org/) version 12.x (with npm)
* [Ember CLI](https://ember-cli.com/)
* [Google Chrome](https://google.com/chrome/)'
* [Docker](https://www.docker.com/products/docker-desktop)
* [yarn](https://yarnpkg.com/lang/en/)
* [volta](https://volta.sh/)

## Installation

* `git clone <repository-url>` this repository
* `cd packages/cardhost`
* `yarn install`

## Running / Development

* `yarn start-prereqs`
* `yarn start-hub`
* In a new tab, `yarn start-ember`
* Alternately, start both the back and front end with `yarn start`

* Visit your app at [http://localhost:4200](http://localhost:4200).
* Visit your tests at [http://localhost:4200/tests](http://localhost:4200/tests).

The cardhost app can only function if it is run together with the back end.
Both local development and the test suite rely on having access to the full stack.

### Common server configuration

#### `DEV_DIR`

If you would like your cards to be saved to a git repository on your hard drive, specify the path to an existing, separate git repository when you start the servers.
Add `cards` to the end of the  path, since that's where cards will be saved.

```sh
yarn stop-prereqs # clear realms and ephemeral cards
DEV_DIR="path/to/your/git/repo/cards" yarn start
```

#### `HUB_URL`

Use a back end other than the default of `localhost:3000`:

```sh
HUB_URL=http://localhost:8080 npx ember serve
```

### Running Tests

* `yarn start-prereqs`
* `yarn test` to run all tests, including linters
* `ember test`
* `ember test --server` to run tests continuously
* `ember test --filter "some-test-name"` to run specific tests

### Writing tests

See CONTRIBUTING.md

### Linting

From the root of the repository:

* `yarn lint:hbs`
* `yarn lint:js`
* `yarn lint:js -- --fix`

### Building

* `ember build` (development)
* `ember build --environment production` (production)

### Deploying

Deploying is done from `master` automatically via CI/CD with GitHub Actions.

If `DEVICE_CARDS_ONLY` is set to true for a target env, such as `production_DEVICE_CARDS_ONLY`,
the Library will only show cards whose IDs are in local storage, as oppopsed to all cards
created. This can be useful for demos.

## Further Reading / Useful Links

* [ember.js](https://emberjs.com/)
* [ember-cli](https://ember-cli.com/)
* Development Browser Extensions
  * [ember inspector for chrome](https://chrome.google.com/webstore/detail/ember-inspector/bmdblncegkenkacieihfhpjfppoconhi)
  * [ember inspector for firefox](https://addons.mozilla.org/en-US/firefox/addon/ember-inspector/)
