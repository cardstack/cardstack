/* eslint-env node */

module.exports = [
  {
    type: 'data-sources',
    id: 'cardstack-git-default',
    attributes: {
      'source-type': '@cardstack/git',
      params: {
        // Location of our git repository
        repo: __dirname + '/../../..',

        // Path within git repository that's reserved for us to read
        // and write our content.
        basePath: 'cardstack',

        // Keep all of the branches we manage segregated under this
        // prefix. So when the user queries 'master' they will really
        // be querying cs-master in our repo.
        //
        // This is intended as a development-mode feature for people
        // who are actively managing their own local git
        // repository. In production or in friendly-desktop mode, this
        // feature should not be needed.
        branchPrefix: 'cs-'
      }
    }
  }
];
