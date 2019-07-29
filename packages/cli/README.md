# Cardstack CLI

The Cardstack CLI is a work-in-progress project to
create a smooth quickstart experience for new developers and
a straightforward way to use the Card SDK.
It handles tasks like creating new Cards, starting the Hub,
installing dependencies, and generating code from templates.

Under the hood, the CLI uses [Embroider](https://github.com/embroider-build/embroider)
for the build and [yargs](https://github.com/yargs/yargs) to manage user inputs.

## Using the CLI

To run the CLI:

```sh
yarn compile --watch
node ./bin/cardstack.js <command>
```

To see a list of commands:

```sh
yarn compile --watch
node ./bin/cardstack.js --help
```

Apps are served from `localhost:4200`.

## Contributing to the CLI

The CLI codebase uses [TypeScript](https://www.typescriptlang.org/),
so make sure you always have a compiler running while you work:

```sh
yarn compile --watch
```

To disable rebuilds of the Ember App as you make changes:

```sh
CARDSTACK_DEV=true node ./bin/cardstack.js start
```

To view the built app, follow the path printed in the console
by Embroider.

# WIP: Current Quickstart Example for while we're developing this

Launching hub from inside the blueprint (you need a local embroider checkout that is built and available for yarn linking):
 - `cd packages/cardhost`
 - `yarn link @embroider/core @embroider/compat @embroider/webpack`
 - `ember s`

Loading the first-card example:
 - `cd packages/cli`
 - `node ./bin/cardstack.js load -c ./node-tests/sample-cards/first-card -d ../cardhost`


