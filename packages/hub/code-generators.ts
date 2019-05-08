import { declareInjections }  from '@cardstack/di';
import createLog from '@cardstack/logger';
import { todo } from '@cardstack/plugin-utils/todo-any';
const log = createLog('cardstack/code-gen');

export = declareInjections({
  plugins: 'hub:plugins'
},

class CodeGenerators {
  async generateCode(modulePrefix: string) {
    log.debug(`Running code generators`);
    let results = [];
    let activePlugins = await (this as todo).plugins.active();
    for (let feature of activePlugins.featuresOfType('code-generators')) {
      log.debug(`Running code generator %s `, feature.id);
      let codeGenerator = activePlugins.lookupFeatureAndAssert('code-generators', feature.id);
      results.push(await codeGenerator.generateCode(modulePrefix));
    }
    return results.join("");
  }

});
