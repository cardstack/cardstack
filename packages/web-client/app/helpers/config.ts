// Adapted from https://github.com/nvdk/ember-config-helper/blob/6a9891afce1ef68c1a42fb5e5fc54ce02f5ae811/addon/helpers/config.js
import { getOwner } from '@ember/application';
import Helper from '@ember/component/helper';
import { get } from '@ember/object';

export default class extends Helper {
  config: any | undefined;

  constructor() {
    super(...arguments);

    this.config = getOwner(this).resolveRegistration('config:environment');
  }

  compute([path]: [string]) {
    let configValue = get(this.config as any, path);

    if (configValue === undefined || configValue === null) {
      throw new Error(`Unknown config property: ${path}`);
    }

    return configValue;
  }
}
