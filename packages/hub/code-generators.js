const { declareInjections } = require('@cardstack/di');
const log = require('@cardstack/plugin-utils/logger')('code-gen');

module.exports = declareInjections({
  plugins: 'hub:plugins'
},

class CodeGenerators {
  async generateCodeForBranch(branch, modulePrefix) {
    log.debug(`Running code generators on branch %s`, branch);
    let results = [];
    let activePlugins = await this.plugins.active();
    for (let feature of activePlugins.featuresOfType('code-generators')) {
      log.debug(`Running code generator %s on branch %s`, feature.id, branch);
      let codeGenerator = activePlugins.lookupFeatureAndAssert('code-generators', feature.id);
      results.push(await codeGenerator.generateCode(modulePrefix, branch));
    }
    return results.join("");
  }

});
