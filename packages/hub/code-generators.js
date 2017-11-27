const { declareInjections } = require('@cardstack/di');
const log = require('@cardstack/plugin-utils/logger')('code-gen');

module.exports = declareInjections({
  schemaCache: 'hub:schema-cache'
},

class CodeGenerators {
  async generateCodeForBranch(branch, modulePrefix) {
    log.debug(`Running code generators on branch %s`, branch);
    let schema = await this.schemaCache.schemaForBranch(branch);
    let results = [];
    for (let feature of schema.plugins.featuresOfType('code-generators')) {
      log.debug(`Running code generator %s on branch %s`, feature.id, branch);
      let codeGenerator = schema.plugins.lookupFeatureAndAssert('code-generators', feature.id);
      results.push(await codeGenerator.generateCode(modulePrefix, branch));
    }
    return results.join("");
  }

});
