# @cardstack/hub

The Cardstack Hub is the API server for the Cardstack project.
For more information, see the
[project-wide README](https://github.com/cardstack/cardstack/blob/main/README.md).

- [@cardstack/hub](#cardstackhub)
  - [Architecture](#architecture)
  - [Configuration](#configuration)
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
- `AWS_PROFILE` - if none of the HUB_AWS_* variables are defined, no credentials or region will be passed to the aws-sdk. This will make the aws-sdk's default behavior take effect, which includes using an AWS_PROFILE env var if it is set
- `DATABASE_URL` - defaults in development to postgres://postgres:postgres@localhost:5432/hub_development
- `LOG_LEVELS` - defaults to `*=info`

Search the mono-repo for `process.env` and check the config directory to see these variables referenced.

To use the variables, create a file named `.env` in the hub's folder, and put in the variables you want to use.

For example:

```
SERVER_SECRET=7TmgY1xFo/WrYTnAFSvAemZtFB8wQVMd8IkoeQKBboE=
AWS_PROFILE=cardstack
```

## Getting Started

The following command will create a hub_development database on your locally running postgres server, run migrations, and load seed data. It will then create a hub_test database, and clone the structure of the development database to it.

    bin/hub db setup

Load the database with seed data

    bin/hub db seed

### Running the hub

```sh
# Starts the server on port 3000
bin/hub server

# Starts the worker process
bin/hub worker

# Starts the discord bot
bin/hub bot

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

    bin/hub db dump

## Application console

To test, debug and call isolated parts of the application within its context.

`bin/hub console` starts the application console.

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

## Connecting to the database staging|production database on AWS

### Setup AWS Session Manager ssh config

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

    bin/hub

_💡 Tip: Add `export PATH="./bin:$PATH"` to your `.zshenv` or `.bash_profile` to be to invoke `hub` directly (without the `bin/`)_

The files that support the CLI are in the `cli/` directory. You can add your own by [following these instructions](https://github.com/yargs/yargs/blob/master/docs/advanced.md#commanddirdirectory-opts). The full `yargs` api [can be found here](https://github.com/yargs/yargs/blob/master/docs/api.md).

## The Card Compiler

All compiler functionality is currently hidden behind the COMPILER feature flag. So to start the server with card compiling and related routes, use that flag.

```
COMPILER=true bin/hub server
```

## Contributing

Note that this package is written in TypeScript, so be sure to run a TypesScript
compiler as you work.
See the [project-wide README](https://github.com/cardstack/cardstack/blob/main/README.md)
for information about running the Hub and its tests locally.
