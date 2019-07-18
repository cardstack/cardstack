import Service from '@ember/service';
import ENV from '../config/environment';

export default class CardLoaderService extends Service {
  async loadCard(name, format) {
    let { component, template } = await import(`../components/cards/${name}-${format}`);
    if (component) {
      window.define(`${ENV.modulePrefix}/components/cards/${name}-${format}`, component);
    }
    if (template) {
      window.define(`${ENV.modulePrefix}/templates/components/cards/${name}-${format}`, template);
    }
  }
}
