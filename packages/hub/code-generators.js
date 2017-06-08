const { declareInjections } = require('@cardstack/di');
const Error = require('@cardstack/plugin-utils/error');
const log = require('@cardstack/plugin-utils/logger')('code-gen');

module.exports = declareInjections({
  schemaCache: 'hub:schema-cache',
  config: 'config:code-gen'
},

class CodeGenerators {
  async generateCode(branch) {
    log.debug(`Running code generators on branch %s`, branch);
    let outDir = this.config.directory;
    if (!outDir) {
      throw new Error("No code generation directory is configured");
    }
    let schema = await this.schemaCache.schemaForBranch(branch);
    for (let name of schema.plugins.listAll('code-generators')) {
      log.debug(`Running code generator %s on branch %s`, name, branch);
      let module = schema.plugins.lookupFeatureAndAssert('code-generators', name);
      await module.generateCode(branch, outDir);
    }
  }
});
