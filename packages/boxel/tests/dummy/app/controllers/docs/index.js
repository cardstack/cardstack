import FreestyleController from 'ember-freestyle/controllers/freestyle';
import config from '../../config/environment';

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
    this.usageComponents = findUsageComponents();
  }
}
