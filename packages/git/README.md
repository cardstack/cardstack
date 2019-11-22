# @cardstack/git

This is a Cardstack data source plugin for reading and writing to Git.
Always have access to see how data has changed across time.

Features:

- Just like using git for code, your data is versioned. A deleted or changed record can be retrieved!
- Card data can be saved to either local or remote git repositories
- Data can be stored in either the same repository as the project code,
or a separate repository
- Data for multiple projects can be saved to the same repository

## Installing in a Cardstack project

To use a git as a data source, include `@cardstack/git` in the `devDependencies`
of `cardhost/package.json`

```bash
yarn add --dev @cardstack/git
yarn install
```

See the "Troubleshooting" section of this README if you encounter any issues installing.

## Configuration

Data plugins are configured in `cardhost/data-sources`.
The only required configuration is to set either `repo` or `remote`.

| Parameter | Type |  Description |
|-----------|------|-------------|
| `remote` | object |  Use a remote git repository, such as one hosted on Github. The object should contain `url` and `privateKey` with type string. Example: `remote: { url: 'some-url', privateKey: process.env.GIT_PRIVATE_KEY}`|
| `repo` | string | The path to a local git repository that already exists on disk, and has an initial commit |
| `branchPrefix` | string | optional - a prefix to prepend to the git branch when saving data. This is especially useful when you are storing data in the same repository as your project, or you have one repository that holds code for multiple projects. Example: if you set `basePath: 'cs-'`, data will be stored at `cs-master`|
| `basePath` | string | optional - specify the directory within a repository where the data should be stored. Example: if you set `basePath` to `my/base` and you save an `article` Card, data will be stored at `my/base/contents/articles/`|

You can set variables such as `process.env.GIT_PRIVATE_KEY` from the command line. For the example below, substitute your own path to the key:

```bash
GIT_PRIVATE_KEY="your private key here"
```

### Example configuration

For example, the configuration below is set in `cardhost/data-sources/default.js`.
This config creates a `@cardstack/git` data source named `default` and configures it 
as the Hub's `default-data-source`.
Now, if a Card does not have its own data source defined, it will use git.

```js
let sources = [
  {
    type: 'plugin-configs',
    id: '@cardstack/hub',
    attributes: {
      'plugin-config': {
        'application-card': { type: 'app-cards', id: 'cardhost' }
      }
    },
    relationships: {
      'default-data-source': {
        data: { type: 'data-sources', id: 'default' }
      }
    }
  },
  {
    type: 'data-sources',
    id: 'default',
    attributes: {
      'source-type': '@cardstack/git',
      params: {
        repo: '/path/to/some-git-repo'
      }
    }
  }
];

module.exports = sources;
```

## Learn more

To learn more about how it can be used in your project,
see the [Cardstack Guides about git](https://docs.cardstack.com/release/data/git/).
