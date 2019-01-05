@cardstack/sftp
==============================================================================


SFTP data source that allows for reading files from and SFTP server. Currently
only implements a searcher.

To use, add a data source to your app:

```js
factory.addResource('data-sources', 'sftp')
  .withAttributes({
    'source-type': '@cardstack/sftp',
    params: {
      contentType: 'sftp-files',
      branches: {
        master: {
          host: '1.2.3.4',
          port: 22,
          username: 'someuser',
          privateKey: require('fs').readFileSync('/path/to/private/key')
        }
      }
    }
  });

```

Config is passed through to [ssh2](https://github.com/mscdex/ssh2) so see there
if you want different connection options.

What you pass to the `contentType` option is the name of the content type that
is created. So if you pass `sftp-files`, your files are accessible at
e.g. `/api/sftp-files/foo.jpg`

Normal grants are respected.

Use url encoding to access non-root-level files, e.g. if you want to access `foo/bar.jpg`:

`/api/sftp-files/foo%2fbar.jpg`


Installation
------------------------------------------------------------------------------

```
ember install @cardstack/sftp
```


Usage
------------------------------------------------------------------------------

[Longer description of how to use the addon in apps.]


Contributing
------------------------------------------------------------------------------

### Installation

* `git clone <repository-url>`
* `cd @cardstack/sftp`
* `npm install`

### Linting

* `npm run lint:js`
* `npm run lint:js -- --fix`

### Running tests

* `ember test` – Runs the test suite on the current Ember version
* `ember test --server` – Runs the test suite in "watch mode"
* `npm test` – Runs `ember try:each` to test your addon against multiple Ember versions

### Running the dummy application

* `ember serve`
* Visit the dummy application at [http://localhost:4200](http://localhost:4200).

For more information on using ember-cli, visit [https://ember-cli.com/](https://ember-cli.com/).

License
------------------------------------------------------------------------------

This project is licensed under the [MIT License](LICENSE.md).
