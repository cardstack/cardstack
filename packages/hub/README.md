# @cardstack/hub

The Cardstack Hub is the API server for the Cardstack project.
For more information, see the
[project-wide README](https://github.com/cardstack/cardstack/blob/main/README.md).

## Architecture

The Hub consists of API endpoints and a postgres database.

## Configuration

Below is a list of the most common environment variables that the Hub accepts:

- `SERVER_SECRET` (required) - to generate one for your machine, run `node --eval="console.log(crypto.randomBytes(32).toString('base64'))"`
- `PGHOST` - defaults to "localhost"
- `PGPORT` - defaults to "5432"
- `PGUSER` - defaults to "postgres"
- `PGPASSWORD` - defaults to "postgres"
- `LOG_LEVELS` - defaults to `*=info`

Search the mono-repo for `process.env` to see these variables in use.

## Contributing

Note that this package is written in TypeScript, so be sure to run a TypesScript
compiler as you work.
See the [project-wide README](https://github.com/cardstack/cardstack/blob/main/README.md)
for information about running the Hub and its tests locally.

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
