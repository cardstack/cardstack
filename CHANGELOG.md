# Changelog

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).
Since this is a pre-1.0 project,
it will track only significant breaking changes
and features, and is not intended to be an exhaustive list.

## [v0.19.0]
This version introduces a newer hub, where our cards are actually backed
by an javascript serialization stead of a JSON serialization and we have a
card compiler that can compile card hbs files into javascript. We are also
introducing a new web-client, and an SDK to use the card protocol for cardpay.

## [v0.18.0]

This version included the work for the "new Hub" aka "Hub v2,"
a card-centric rewrite of Cardstack internals, APIs, and mental models.
This is a significant breaking change.

See https://github.com/cardstack/cardstack/pull/1432 to view the change
in source code.

## [v0.17.0]

This release concludes a series of 409 conflict bugfixes
for the base card and seeded featured cards.
The bugfix work starteds in `v0.16.27`. See #1437

### Changed

- Breaking - Seeds no longer run for production deployments.
You must create seed data via the Card Builder UI
or in a data source directly. This fixes some 409 conflict issues
for featured cardsin deployed environments. See #1411

## [v0.16.22]

### Added
- core type `link` #1255
- core type `cta` #1255

## [v0.16.13]

### Added

- Feature: image core type

## [v0.14.22] - 2019-08-15

When upgrading, `@cardstack/eslint-config/browser` should become `@cardstack/eslint-config/ember-addon`
throughout a project. Then, `babel-eslint` should be added as a peer dependency in the top level
`package.json` with `yarn add -D -W babel-eslint`

### Added

- Commits for the WIP Cardstack CLI

### Changed

- Bugfix for tools package - enable string field editor #813
- error logging
- docs for git plugins
- more linting configuration to support using TypeScript
- Breaking - eslint plugin rules have changed filepaths for imports. See migration instructions above. #824

## [v0.14.21] - 2019-07-18

This is a summary of breaking changes and new features since `v0.13`.

To upgrade a project from `v0.13` to `v0.14`, follow
[these steps](https://github.com/cardstack/cardboard/issues/95)

Affected APIs include:
- `searchers.get()`
- `searchers.getFromControllingBranch()`
- `searchers.searchFromControllingBranch()`
- `searchers.search()`
- `indexers.beginUpdate()`,
- `controlling-branch` dependency injection
- `forBranch()`
- `forControllingBranch()`
- `writers.create()`
- `writers.update()`
- linting config

### Changed
- [FEATURE] Improved UX and designs for the Right Edge #752

### Removed
- [BREAKING] remove concept of `branches` #747

## Prior versions

See the [Releases](https://github.com/cardstack/cardstack/releases) and git commit
history for changes prior to `v0.14`.
