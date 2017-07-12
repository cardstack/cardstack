const { declareInjections } = require('@cardstack/di');
const log = require('@cardstack/plugin-utils/logger')('code-gen');

module.exports = declareInjections({
  schemaCache: 'hub:schema-cache',
  config: 'config:code-gen'
},

class CodeGenerators {
  async generateCode() {
    let branch = 'master'; // TODO: multibranch here
    await this.generateCodeForBranch(branch);
  }

  async generateCodeForBranch(branch) {
    log.debug(`Running code generators on branch %s`, branch);
    let schema = await this.schemaCache.schemaForBranch(branch);
    for (let name of schema.plugins.listAll('code-generators')) {
      log.debug(`Running code generator %s on branch %s`, name, branch);
      let module = schema.plugins.lookupFeatureAndAssert('code-generators', name);
      let code = await module.generateCode(branch);
    }
  }

  async triggerRebuild() {
    log.info("Triggered");
    if (this.config.broccoliConnector) {
      this.config.broccoliConnector.triggerRebuild();
    }
  }
});
