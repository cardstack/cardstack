const { declareInjections } = require('@cardstack/di');
const log = require('@cardstack/logger')('cardstack/code-gen');

module.exports = declareInjections({
  plugins: 'hub:plugins'
},

class CodeGenerators {
  async generateCode(modulePrefix) {
    log.debug(`Running code generators`);
    let results = [];
    let activePlugins = await this.plugins.active();
    for (let feature of activePlugins.featuresOfType('code-generators')) {
      log.debug(`Running code generator %s `, feature.id);
      let codeGenerator = activePlugins.lookupFeatureAndAssert('code-generators', feature.id);
      results.push(await codeGenerator.generateCode(modulePrefix));
    }
    return results.join("");
  }

});
