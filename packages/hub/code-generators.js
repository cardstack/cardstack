const { declareInjections } = require('@cardstack/di');
const log = require('@cardstack/plugin-utils/logger')('code-gen');

module.exports = declareInjections({
  schemaCache: 'hub:schema-cache',
  config: 'config:project'
},

class CodeGenerators {
  async generateCode() {
    let branch = 'master'; // TODO: multibranch here
    let outputs = new Map();
    outputs.set(branch, await this.generateCodeForBranch(branch));
    return outputs;
  }

  async generateCodeForBranch(branch) {
    log.debug(`Running code generators on branch %s`, branch);
    let schema = await this.schemaCache.schemaForBranch(branch);
    let modulePrefix = this.config.emberConfigEnv.modulePrefix;
    let results = [];
    for (let name of schema.plugins.listAll('code-generators')) {
      log.debug(`Running code generator %s on branch %s`, name, branch);
      let codeGenerator = schema.plugins.lookupFeatureAndAssert('code-generators', name);
      results.push(await codeGenerator.generateCode(modulePrefix, branch));
    }
    return results.join("");
  }

});
