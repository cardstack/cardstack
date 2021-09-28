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
    - [GET /api/prepaid-card-patterns](#get-apiprepaid-card-patterns)
    - [GET /api/prepaid-card-color-schemes](#get-apiprepaid-card-color-schemes)
    - [POST /api/prepaid-card-customizations](#post-apiprepaid-card-customizations)
    - [POST /api/merchant-infos](#post-apimerchant-infos)
    - [GET /api/merchant-infos/validate-slug/:slug](#get-apimerchant-infosvalidate-slugslug)
  - [The Hub CLI](#the-hub-cli)
  - [Deployment](#deployment)
    - [Overview](#overview)
    - [Step 1: Releasing a new version of the packages in the monorepo](#step-1-releasing-a-new-version-of-the-packages-in-the-monorepo)
    - [Step 2: Creating a changelog](#step-2-creating-a-changelog)
    - [Step 3: Deploy using Cardie in the #releases-internal channel](#step-3-deploy-using-cardie-in-the-releases-internal-channel)
    - [Step 4: Run migrations (if any)](#step-4-run-migrations-if-any)
  - [Contributing](#contributing)

## Architecture

The Hub consists of API endpoints and a postgres database.

The app uses a Postgresql-based background task queue built on [graphile/worker](https://github.com/graphile/worker)

## Configuration

Below is a list of the most common environment variables that the Hub accepts:

- `HUB_AWS_ACCESS_KEY_ID`
- `HUB_AWS_SECRET_ACCESS_KEY`
- `HUB_AWS_REGION`
- `AWS_PROFILE` - if none of the HUB_AWS_* variables are defined, no credentials or region will be passed to the aws-sdk. This will make the aws-sdk's default behavior take effect, which includes using an AWS_PROFILE env var if it is set
- `SERVER_SECRET` (required) - to generate one for your machine, run `node --eval="console.log(crypto.randomBytes(32).toString('base64'))"`
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
# Starts the server on port 300
bin/hub server

# Starts the worker process
bin/hub worker

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

### GET /api/prepaid-card-patterns

### GET /api/prepaid-card-color-schemes

### POST /api/prepaid-card-customizations

### POST /api/merchant-infos

### GET /api/merchant-infos/validate-slug/:slug

## The Hub CLI
The hub CLI can be invoked from within the hub package

    bin/hub

*💡 Tip: Add `export PATH="./bin:$PATH"` to your `.zshenv` or `.bash_profile` to be to invoke `hub` directly (without the `bin/`)*

The files that support the CLI are in the `cli/` directory. You can add your own by [following these instructions](https://github.com/yargs/yargs/blob/master/docs/advanced.md#commanddirdirectory-opts). The full `yargs` api [can be found here](https://github.com/yargs/yargs/blob/master/docs/api.md).

## Deployment

Green builds of the main branch deploy hub to staging if the commit contains changes to the hub package or its dependencies. The deploy uses waypoint.

### Overview

1. Release a new version of packages in the monorepo. This should create a tag that you will use in steps 2 and 3.

1. Create a changelog for the beta team to understand progress on the dApp by reviewing changes since last deploy.

1. Deploy hub and/or web-client to production using Cardie in the #releases-internal channel

1. Run migrations (if any)

1. Verify everything is working in prod

1. Post your changelog to #releases-internal, making sure to include the tag that was deployed.

See sections below for details on steps 1, 2, and 3.

### Step 1: Releasing a new version of the packages in the monorepo

The following instructions are based on our monorepo's maintainers' guide and will release all monorepo packages in lockstep. We should not update the changelog in the monorepo root for now, until  is resolved.

1. Get the latest code on main: git checkout main, git pull origin main

1. Make sure your history is clean with git status

1. Update all package versions, publish to npm, and push to GitHub with this command: 
   ```sh
   npx lerna publish --force-publish="*" --exact
   ```
   Copy the new tag, you will use this in the next steps.

### Step 2: Creating a changelog

Changelogs posted in the #releases-internal discord channel should be focused on user-facing parts of deployments, as they are primarily for the beta team to understand progress on the DApp. The current process of creating a changelog is quite manual:

1. Check #releases-internal channel for the last tag that was deployed. (finding the last deployed tag may become easier if we have CS-1384)

1. Go through commits/changes since that tag for relevant information. For convenience: `https://github.com/cardstack/cardstack/compare/<last-deployed-version>...<your-version>`

1. Do the writeup

Examples

https://discord.com/channels/584043165066199050/866667164764471346/868092003999703050

https://discord.com/channels/584043165066199050/866667164764471346/869492690826444820

### Step 3: Deploy using Cardie in the #releases-internal channel

Type the following commands in #releases-internal on Discord and Cardie B should tell you what's up. Copied from

https://discord.com/channels/584043165066199050/866667164764471346/883379195533754378:

Usage:
```
!deploy APP[:ref] [environment]
```

 Examples:
```
!deploy cardie:feature-branch-123 staging  (checkout to feature branch, deploy cardie to staging)
!deploy hub:hotfix-5678                    (checkout to hotfix branch, deploy hub to production)
!deploy web-client                         (checkout to main branch, deploy web-client to production)
```

### Step 4: Run migrations (if any)

Connect to the instance where the app is deployed:
```sh
waypoint exec -app=hub bash
```

Then, add node to the PATH and run the migrations:
```sh
heroku@ip-10-91-1-8:/ cd /workspace
heroku@ip-10-91-1-8:/workspace$ PATH=$PATH:/layers/heroku_nodejs-engine/nodejs/bin/;
heroku@ip-10-91-1-8:/workspace$ npm run db:migrate up
```

## Contributing

Note that this package is written in TypeScript, so be sure to run a TypesScript
compiler as you work.
See the [project-wide README](https://github.com/cardstack/cardstack/blob/main/README.md)
for information about running the Hub and its tests locally.
