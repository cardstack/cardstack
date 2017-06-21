const { declareInjections } = require('@cardstack/di');
const log = require('@cardstack/plugin-utils/logger')('code-gen');

module.exports = declareInjections({
  schemaCache: 'hub:schema-cache',
  config: 'config:code-gen'
},

class CodeGenerators {
  async generateCode(outDir) {
    let branch = 'master'; // TODO: multibranch here
    log.debug(`Running code generators on branch %s`, branch);
    let schema = await this.schemaCache.schemaForBranch(branch);
    for (let name of schema.plugins.listAll('code-generators')) {
      log.debug(`Running code generator %s on branch %s`, name, branch);
      let module = schema.plugins.lookupFeatureAndAssert('code-generators', name);
      await module.generateCode(branch, outDir);
    }
  }
  triggerRebuild() {
    if (this.config.broccoliConnector) {
      this.config.broccoliConnector.triggerRebuild();
    }
  }
});
