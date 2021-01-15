# Cardstack

## Installing

1. Install [volta](https://volta.sh/) and `volta install yarn`.
2. Clone the repo and run `yarn install`.
3. Install docker (we use it to launch supporting services like postgres).

## Orientation

`cardhost`: the Ember app
`server`: the server ("the hub")
`core`: shared code that is used by both cardhost and server
`base-cards`: the collection of framework-provided default cards that serve as the foundation for user-created cards
`demo-cards`: a collection of demo & test cards

## Architecture

By default, the server will use both the `base-cards` and `demo-cards` directories as read/write realms. Any change you make in the app will appear as (uncommitted) changes to these directories.

The server maintains its own search index over all the realms it knows about. The search index is stored in postgres.

## TODO

1. Add eslint and CI typecheck for server.
