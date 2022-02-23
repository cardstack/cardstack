# ssr-web

This renders Card Pay merchant payment requests on the server!

## Prerequisites

You will need the following things properly installed on your computer.

* [Git](https://git-scm.com/)
* [Node.js](https://nodejs.org/)
* [Yarn](https://yarnpkg.com/)
* [Ember CLI](https://ember-cli.com/)
* [Google Chrome](https://google.com/chrome/)

## Installation

* `git clone <repository-url>` this repository
* `cd packages/ssr-web`
* `yarn install`

## Running / Development

* `ember serve -prod` (must be production [for now](https://github.com/embroider-build/embroider/issues/1049#issuecomment-1034079882))
* Visit your app at [http://localhost:4210](http://localhost:4210).
* Visit your tests at [http://localhost:4210/tests](http://localhost:4210/tests).

Note that you will have to run the hub for exchange rates, see [the hub README](../hub/README.md#running).

### Required environment variables

Deployed versions will use a "HUB_URL" env var, which is processed at the time ember-cl-deploy runs.

### Code Generators

Make use of the many generators for code, try `ember help generate` for more details

### Running Tests

* `ember test`
* `ember test --server`

### Linting

* `yarn lint:hbs`
* `yarn lint:js`
* `yarn lint:js --fix`

### Building

* `ember build` (development)
* `ember build --environment production` (production)

### Deploying

TBD

## Further Reading / Useful Links

* [ember.js](https://emberjs.com/)
* [ember-cli](https://ember-cli.com/)
* Development Browser Extensions
  * [ember inspector for chrome](https://chrome.google.com/webstore/detail/ember-inspector/bmdblncegkenkacieihfhpjfppoconhi)
  * [ember inspector for firefox](https://addons.mozilla.org/en-US/firefox/addon/ember-inspector/)
