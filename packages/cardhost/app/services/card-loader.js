import Service from '@ember/service';
import ENV from '../config/environment';

export default class CardLoaderService extends Service {
  async loadCard(name, format) {
    let { component, template } = await import(`../components/cards/${name}-${format}`);
    if (component) {
      window.define(`${ENV.modulePrefix}/components/cards/${name}-${format}`, () => {
        let mod = { default: component };
        Object.defineProperty(mod, '__esModule', { value: true });
        return mod;
      });
    }
    if (template) {
      window.define(`${ENV.modulePrefix}/templates/components/cards/${name}-${format}`, () => {
        let mod = { default: template };
        Object.defineProperty(mod, '__esModule', { value: true });
        return mod;
      });
    }
  }
}
