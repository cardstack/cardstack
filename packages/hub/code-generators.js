const { declareInjections } = require('@cardstack/di');
const log = require('@cardstack/plugin-utils/logger')('code-gen');
const fs = require('fs');
const denodeify = require('denodeify');
const mkdir = denodeify(fs.mkdir);

module.exports = declareInjections({
  schemaCache: 'hub:schema-cache',
  config: 'config:code-gen'
},

class CodeGenerators {
  constructor() {
    process.on('SIGUSR2', () => this.triggerRebuild());
  }

  async generateCode(outDir) {
    let branch = 'master'; // TODO: multibranch here

    log.debug(`Running code generators on branch %s`, branch);
    let schema = await this.schemaCache.schemaForBranch(branch);

    await mkdir(`${outDir}/${branch}`);
    await mkdir(`${outDir}/${branch}/app`);
    await mkdir(`${outDir}/${branch}/addon`);

    for (let name of schema.plugins.listAll('code-generators')) {
      log.debug(`Running code generator %s on branch %s`, name, branch);
      let module = schema.plugins.lookupFeatureAndAssert('code-generators', name);
      await module.generateCode(branch, outDir + '/' + branch);
    }
  }
  async triggerRebuild() {
    log.info("Triggered");
    if (this.config.broccoliConnector) {
      log.info("Running");
      await this.config.broccoliConnector.triggerRebuild();
      log.info("Finished");
    }
  }
});
