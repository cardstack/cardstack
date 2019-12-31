# cardhost

The cardhost is an application container that hosts cards. The cardhost is deployed as a stand-alone ember application outside of the mono repo. Because the cardhost is deployed as an isolated module outside of the mono repo, ***if any of its mono repo peer modules change, you'll need to rev the mono repo in order for the deployed cardhost to pick up the changes.***

## Prerequisites

You will need the following things properly installed on your computer.

* [Git](https://git-scm.com/)
* [Node.js](https://nodejs.org/) (with npm)
* [Ember CLI](https://ember-cli.com/)
* [Google Chrome](https://google.com/chrome/)'
* [Docker](https://www.docker.com/products/docker-desktop)
* [yarn](https://yarnpkg.com/lang/en/)

## Installation

* `git clone <repository-url>` this repository
* `cd packages/cardhost`
* `yarn install`

## Running / Development

* `yarn start-prereqs`
* `INDEX_INTERVAL=120 yarn start-hub`
* In a new tab, `yarn start-ember`


* Visit your app at [http://localhost:4200](http://localhost:4200).
* Visit your tests at [http://localhost:4200/tests](http://localhost:4200/tests).

`INDEX_INTERVAL` determines how often the hub should reindex data, in minutes.
It is recommended to set this number high for local development.

### Code Generators

Make use of the many generators for code, try `ember help generate` for more details

### Running Tests

* `yarn start-prereqs`
* `ember test`
* `ember test --server`

### Linting

From the root of the repository:

* `yarn lint:hbs`
* `yarn lint:js`
* `yarn lint:js -- --fix`

### Building

* `ember build` (development)
* `ember build --environment production` (production)

### Deploying

Deploying is done from `master` automatically via CI/CD.

## Further Reading / Useful Links

* [ember.js](https://emberjs.com/)
* [ember-cli](https://ember-cli.com/)
* Development Browser Extensions
  * [ember inspector for chrome](https://chrome.google.com/webstore/detail/ember-inspector/bmdblncegkenkacieihfhpjfppoconhi)
  * [ember inspector for firefox](https://addons.mozilla.org/en-US/firefox/addon/ember-inspector/)

