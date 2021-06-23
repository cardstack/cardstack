# @cardstack/hub

The Cardstack Hub is the API server for the Cardstack project.
For more information, see the
[project-wide README](https://github.com/cardstack/cardstack/blob/main/README.md).

## Architecture

The Hub consists of API endpoints and a postgres database.

## Configuration

Below is a list of the most common environment variables that the Hub accepts:

- `SERVER_SECRET` (required) - to generate one for your machine, run `node --eval="console.log(crypto.randomBytes(32).toString('base64'))"`
- `DATABASE_URL` - defaults in development to postgres://postgres:postgres@localhost:5432/hub_development
- `LOG_LEVELS` - defaults to `*=info`

Search the mono-repo for `process.env` and check the config directory to see these variables referenced.

## Setting up a local database for the first time

The following command will create a hub_development database on your locally running postgres server, run migrations, and load seed data. It will then create a hub_test database, and clone the structure of the development database to it.

`yarn db:setup:local`

## Contributing

Note that this package is written in TypeScript, so be sure to run a TypesScript
compiler as you work.
See the [project-wide README](https://github.com/cardstack/cardstack/blob/main/README.md)
for information about running the Hub and its tests locally.


## Running database migrations

`yarn db:migrate up`

To reverse the last migration:

`yarn db:migrate down`

To redo the last migration (i.e. down + up):

`yarn db:migrate redo`

## Loading database seed data

`yarn db:seed`



## Deploying to staging

Green builds of the main branch deploy hub to staging if the commit contains changes to the hub package or its dependencies. The deploy uses waypoint.

## Connecting to the database

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
