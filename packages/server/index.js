const { makeServer } = require('./main');
const path = require('path');

module.exports = {
  name: '@cardstack/server',
  serverMiddleware({ app, options }) {
    let { project, environment } = options;

    let seedPath = path.join(path.dirname(project.configPath()), '..', 'cardstack', 'seeds');
    let seedFile = path.join(seedPath, environment + '.js');
    let seedModels = [];
    try {
      seedModels = require(seedFile);
    } catch (err) {
      project.ui.writeWarnLine(`Unable to load your seed models (looking for ${seedFile})`);
    }
    makeServer(seedModels).then(server => {
      app.use('/cardstack', server.callback());
    });

    // Without this node 7 swallows stack traces within the native
    // promises I'm using.
    process.on('warning', (warning) => {
      process.stderr.write(warning.stack);
    });
  }
};
