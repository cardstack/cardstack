import FreestyleController from 'ember-freestyle/controllers/freestyle';
import config from '../../config/environment';

function findUsageComponents() {
  let usageRegExp = new RegExp(`${config.modulePrefix}/components/.+/usage`);
  return Object.keys(window.require.entries)
    .filter(path => usageRegExp.test(path))
    .map(path => path.replace(`${config.modulePrefix}/components/`,'').replace('/usage',''))
    .sort();
}

export default class DocsIndexController extends FreestyleController {
  constructor() {
    super(...arguments);
    this.usageComponents = findUsageComponents();
  }
}
