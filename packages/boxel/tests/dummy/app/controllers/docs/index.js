import FreestyleController from 'ember-freestyle/controllers/freestyle';
import config from '../../config/environment';
import { ensureSafeComponent } from '@embroider/util';
import { importSync } from '@embroider/macros';

function findUsageComponents() {
  let usageRegExp = new RegExp(`${config.modulePrefix}/components/.+/usage`);
  let allEntries = Object.keys(window.require.entries);
  let usageEntries = allEntries.filter((path) => usageRegExp.test(path));
  usageEntries = usageEntries.filter(
    (path) => !path.startsWith(`${config.modulePrefix}/components/freestyle`)
  );
  return usageEntries
    .map((path) =>
      path
        .replace(`${config.modulePrefix}/components/`, '')
        .replace('/usage', '')
    )
    .sort();
}

export default class DocsIndexController extends FreestyleController {
  constructor() {
    super(...arguments);
    this.usageComponents = findUsageComponents().map((c) => {
      let usageModule = importSync(`@cardstack/boxel/components/${c}/usage`);
      return {
        title: c,
        component: ensureSafeComponent(usageModule.default, this),
      };
    });
  }
}
