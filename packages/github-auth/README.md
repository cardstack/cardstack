# @cardstack/github-auth

The `github-auth` plugin is a feature of the Card SDK that enables GitHub OAuth for authenticating users.
It is one of the easiest ways to add real login functionality to a Cardstack project, as well as creating a way to track who has made changes to data over time.

## Installation

* `cd your-cardstack-project-name/cardhost`
* `yarn add @cardstack/github-auth`

## Configuration

1. Using the `@cardstack/git` plugin, set up a GitHub repository to hold your Card data
2. Register a new OAuth app via https://github.com/settings/developers, which will get you a client ID and secret. You will use these as environment variables `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET`. If you are developing locally, use `http://localhost:4200/` for the callback URL.
3. Create a [Personal Access Token](https://github.com/settings/tokens) on GitHub. Check the boxes that allow `repo` and `user` scope. You will use this token as `GITHUB_TOKEN` in environment variables. Also make sure that your account has push permissions for the GitHub repos that are hosting your Card data. Note that in order to get access to a github user's email address, the GitHub user *must* set a public email address in their GitHub profile settings. By default, new users do not have a public email address.

## Sample configuration

Here is an example of how to use the plugin, in `project-name/cardstack/data-sources/github.js`:

```js
const JSONAPIFactory = require('@cardstack/test-support/jsonapi-factory');

let factory = new JSONAPIFactory();

factory.addResource('data-sources', 'github').withAttributes({
  sourceType: '@cardstack/github-auth',
  params: {
    'client-id': process.env.GITHUB_CLIENT_ID,
    'client-secret': process.env.GITHUB_CLIENT_SECRET,
    token: process.env.GITHUB_TOKEN,
    permissions: [
      { repo: 'myusername/my-project-data', permission: 'read' },
      { repo: 'myusername/my-project-data', permission: 'write' },
    ]
  }
});

module.exports = factory.getModels();
```

Then, if you want to run the project locally, you can pass in the environment variables through the command line when you start the server:

```sh
GITHUB_CLIENT_ID=abc GITHUB_CLIENT_SECRET=123 GITHUB_TOKEN=xyz yarn start
```

## Running Tests

* `npm test` (Runs `ember try:each` to test your addon against multiple Ember versions)
* `ember test`
* `ember test --server`

## Building

* `ember build`

For more information on using ember-cli, visit [https://ember-cli.com/](https://ember-cli.com/).
