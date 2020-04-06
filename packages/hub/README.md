# @cardstack/hub

The Cardstack Hub is the API server for the Cardstack project.
For more information, see the
[project-wide README](https://github.com/cardstack/cardstack/blob/master/README.md).

## Architecture

The Hub consists of API endpoints, a postgres database, and an in-memory index of
cards within realms.

## Configuration

Below is a list of the most common environment variables that the Hub accepts:

- `DEV_DIR` - when in Dev Mode, this is a path to a git repository on your hard drive, in the form `path/to/your/git/repo/cards` with `cards` at the end.
- `META_REALM_URL` - takes the form `https://<username>:<token>@github.com/<org>/<reponame>.git` if it is a GitHub URL. See [Generating `GIT REPO` urls](https://github.com/cardstack/cardstack/wiki/Generating-GIT_REPO-urls)
- `DEFAULT_REALM_URL - - takes the form `https://<username>:<token>@github.com/<org>/<reponame>.git` if it is a GitHub URL. See [Generating `GIT REPO` urls](https://github.com/cardstack/cardstack/wiki/Generating-GIT_REPO-urls)
- `LOG_LEVELS` - defaults to `*=info`
- `PGHOST`
- `PGPORT`
- `PGUSER`
- `PGPASSWORD`

See the `cardhost` deploy scripts for a listing of cloud-provider-specific variables.
Also search the mono-repo for `process.env` to see these variables in use.

## Contributing

Note that this package is written in TypeScript, so be sure to run a TypesScript
compiler as you work.
See the [project-wide README](https://github.com/cardstack/cardstack/blob/master/README.md)
for information about running the Hub and its tests locally.
