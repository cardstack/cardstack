# @cardstack/hub

The Cardstack Hub is the API server for the Cardstack project.
For more information, see the
[project-wide README](https://github.com/cardstack/cardstack/blob/main/README.md).

- [@cardstack/hub](#cardstackhub)
  - [Architecture](#architecture)
  - [Configuration](#configuration)
  - [Setting up Discord](#setting-up-discord)
  - [Getting Started](#getting-started)
    - [Running the hub](#running-the-hub)
  - [Database migrations](#database-migrations)
  - [Application console](#application-console)
    - [Make a DB query (call installed modules)](#make-a-db-query-call-installed-modules)
    - [Call a service (call application modules)](#call-a-service-call-application-modules)
  - [Connecting to the database staging|production database on AWS](#connecting-to-the-database-stagingproduction-database-on-aws)
    - [Setup AWS Session Manager ssh config](#setup-aws-session-manager-ssh-config)
  - [Provided APIs](#provided-apis)
    - [GET /api/exchange-rates](#get-apiexchange-rates)
    - [GET /api/prepaid-card-patterns](#get-apiprepaid-card-patterns)
    - [GET /api/prepaid-card-color-schemes](#get-apiprepaid-card-color-schemes)
    - [POST /api/prepaid-card-customizations](#post-apiprepaid-card-customizations)
    - [POST /api/merchant-infos](#post-apimerchant-infos)
    - [GET /api/merchant-infos/validate-slug/:slug](#get-apimerchant-infosvalidate-slugslug)
  - [The Hub CLI](#the-hub-cli)
  - [The Card Compiler](#the-card-compiler)
  - [Contributing](#contributing)

## Architecture

The Hub consists of API endpoints and a postgres database.

The app uses a Postgresql-based background task queue built on [graphile/worker](https://github.com/graphile/worker)

## Configuration

Below is a list of the most common environment variables that the Hub accepts:

- `SERVER_SECRET` (required) - to generate one for your machine, run `node --eval="console.log(crypto.randomBytes(32).toString('base64'))"`
- `FIXER_API_KEY` (required for `/api/exchange-rates`) - API key for currency exchange rates, we use https://fixer.io/
- `EXCHANGE_RATES_ALLOWED_DOMAINS` - domains from which a request to `/api/exchange-rates` is allowed
- `HUB_AWS_ACCESS_KEY_ID`
- `HUB_AWS_SECRET_ACCESS_KEY`
- `HUB_AWS_REGION`
- `AWS_PROFILE` - if none of the HUB*AWS*\* variables are defined, no credentials or region will be passed to the aws-sdk. This will make the aws-sdk's default behavior take effect, which includes using an AWS_PROFILE env var if it is set
- `HUB_DATABASE_URL` - defaults in development to postgres://postgres:postgres@localhost:5432/hub_development
- `LOG_LEVELS` - defaults to `*=info`

Search the mono-repo for `process.env` and check the config directory to see these variables referenced.

To use the variables, create a file named `.env` in the hub's folder, and put in the variables you want to use.

For example:

```
SERVER_SECRET=7TmgY1xFo/WrYTnAFSvAemZtFB8wQVMd8IkoeQKBboE=
AWS_PROFILE=cardstack
```

## Setting up Discord

Some of the packages in this mono repo support the operation of a discord bot that uses the hub's DI system. We leverage [CordeJS](https://cordejs.org/docs/cordebot/) for our unit tests. CordeJS uses a discord bot running in discord to test the bot functionality by emulating a discord user and sending commands to the bot under test. In order to run the cordejs tests, you'll need to setup a discord server and install the cordebot with full permissions as well as the cardbot into the discord server.

The instructions for setting up the cordebot (and cardbot) are here: https://cordejs.org/docs/creatingdiscordbot. In these instructions you need to setup 2 bots (the instructions outline how to setup a single bot). One bot that you setup will be the cardbot, the other bot that you setup will be the cordebot (used to test the cardbot).

At the time of this writing the cardbot requires the following OAuth scopes:
![](https://user-images.githubusercontent.com/61075/141373061-f16ffc2c-7139-4572-8c75-5eba75a0d47c.png)

Once the cardbot and cordebot bots are setup, you can then configure environment variables for running the bot tests. Specifically:

- `CORDE_BOT_ID`: The bot ID for the cordebot
- `CORDE_BOT_TOKEN`: The bot token for the cordebot
- `CARDBOT_ID`: The bot ID for the cardbot
- `CARDBOT_TOKEN`: The bot token for the cardbot
- `CARDBOT_ALLOWED_GUILDS`: A comma separated list of the discord server IDs that the cardbot is allowed to communicate on. This should be the server(s) that you added the cardbot to.
- `CARDBOT_ALLOWED_CHANNELS`: A comma separated list of channel IDs the cardbot is allowed to communicate in.

(Note: to easily obtain server and channel ID's enable `User Settings -> Advanced -> Enable Developer Mode` in Discord. This will reveal a "Copy ID" item in the settings panel for servers and channels to retrieve these ID's.)

## Getting Started

You need to build the hub via `yarn build`, or start watching for live rebuilds with `yarn rebuild`.

The following command will create a hub_development database on your locally running postgres server

```sh
    createdb hub_development
    yarn db:migrate up
    node dist/hub.js db seed
    node dist/hub.js db dump
    NODE_ENV=test node dist/hub.js db init
```

### Running the hub

```sh
# Starts the server on port 3000
node dist/hub.js server

# Starts the worker process
node dist/hub.js worker

# Starts the discord bot
node dist/hub.js bot

# If you want to run both in the same terminal you can run
yarn start
```

## Database migrations

```sh
# Run available migrations
yarn db:migrate up

#To reverse the last migration:
yarn db:migrate down

#To redo the last migration (i.e. down + up):
yarn db:migrate redo

## Creating database migrations
yarn db:migrate create <migration-name>`
```

Documentation on how to create migration scripts is available at https://salsita.github.io/node-pg-migrate/#/migrations

After you have completed running your new DB migration script create a pg_dump of the DB in the `config/structure.sql` file using:

    node dist/hub.js db dump

## Application console

To test, debug and call isolated parts of the application within its context.

`yarn console` starts the application console.

Examples:

### Make a DB query (call installed modules)

```js
Hub > const { Client } = require('pg');
Hub > const config = require('config');
Hub > const client = new Client(config.db.url);
Hub > await client.connect();
Hub > await client.query('SELECT * FROM merchant_infos');
```

### Call a service (call application modules)

```js
Hub > const workerClient = await container.lookup('worker-client');
Hub > await workerClient.addJob('persist-off-chain-merchant-info', { id: 1 });
```

To connect to a console in a remote environment (staging/production), use waypoint:

```sh
waypoint exec -app=hub sh
node --no-deprecation --experimental-repl-await ./dist/hub.js console

Hub >
```

## Connecting to the database staging|production database on AWS

### Setup AWS Session Manager ssh config

Install the [AWS Session Manager plugin](https://docs.aws.amazon.com/systems-manager/latest/userguide/session-manager-working-with-install-plugin.html) if you don’t already have it.

Add the following to your `~/.ssh/config` file:

```
# SSH over Session Manager
host i-* mi-*
    ProxyCommand sh -c "aws ssm start-session --target %h --document-name AWS-StartSSHSession --parameters 'portNumber=%p'"
```

Lookup the tunneling command and database password:

```
cd [PROJECTS]/cardstack/infra/configs/hub/[staging|production]
AWS_PROFILE=cardstack terraform output | grep tunnel_to_database
AWS_PROFILE=cardstack terraform output | grep postgres_password
```

Run the command, open a postgres client, and connect to localhost, port 55432 with username cardstack, password as looked up in previous step.

## Provided APIs

APIs conform to the [JSON API specification](https://jsonapi.org/).

### GET /api/exchange-rates

### GET /api/prepaid-card-patterns

### GET /api/prepaid-card-color-schemes

### POST /api/prepaid-card-customizations

### POST /api/merchant-infos

### GET /api/merchant-infos/validate-slug/:slug

## The Hub CLI

The hub CLI can be invoked from within the hub package

    node dist/hub.js

The files that support the CLI are in the `cli/` directory. You can add your own by [following these instructions](https://github.com/yargs/yargs/blob/master/docs/advanced.md#commanddirdirectory-opts). The full `yargs` api [can be found here](https://github.com/yargs/yargs/blob/master/docs/api.md).

## The Card Compiler

All compiler functionality is currently hidden behind the COMPILER feature flag. So to start the server with card compiling and related routes, use that flag.

```
COMPILER=true node dist/hub.js server
```

## Contributing

Note that this package is written in TypeScript, so be sure to run a TypesScript
compiler as you work.
See the [project-wide README](https://github.com/cardstack/cardstack/blob/main/README.md)
for information about running the Hub and its tests locally.
