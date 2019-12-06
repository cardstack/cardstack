import { declareInjections } from '@cardstack/di';
import createLog from '@cardstack/logger';
import { todo } from '@cardstack/plugin-utils/todo-any';
const log = createLog('cardstack/code-gen');

interface CodeGenerator {
  generateModules(): Promise<Map<string, string>>;
  generateAppModules(): Promise<Map<string, string>>;
}

export = declareInjections(
  {
    plugins: 'hub:plugins',
  },

  class CodeGenerators {
    async generateCode() {
      log.debug(`Running code generators`);

      let modules = new Map();
      let appModules = new Map();

      let activePlugins = await (this as todo).plugins.active();
      for (let feature of activePlugins.featuresOfType('code-generators')) {
        log.debug(`Running code generator %s `, feature.id);
        let codeGenerator = activePlugins.lookupFeatureAndAssert('code-generators', feature.id) as CodeGenerator;

        if (typeof codeGenerator.generateModules === 'function') {
          for (let [moduleName, source] of await codeGenerator.generateModules()) {
            let packageName = feature.relationships.plugin.data.id;
            modules.set(`${packageName}/${moduleName}`, source);
          }
        }

        if (typeof codeGenerator.generateAppModules === 'function') {
          for (let item of await codeGenerator.generateAppModules()) {
            appModules.set(...item);
          }
        }
      }
      return { modules, appModules };
    }
  }
);
