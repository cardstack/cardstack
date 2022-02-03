// Adapted from https://github.com/nvdk/ember-config-helper/blob/6a9891afce1ef68c1a42fb5e5fc54ce02f5ae811/addon/helpers/config.js
import { getOwner } from '@ember/application';
import Helper from '@ember/component/helper';
import { get } from '@ember/object';

export default class extends Helper {
  config: Config | undefined;

  constructor() {
    super(...arguments);

    this.config = getOwner(this).resolveRegistration('config:environment');
  }

  compute([path]: [string]) {
    // @ts-ignore FIXME, can’t figure it out right now
    return get(this.config, path);
  }
}
