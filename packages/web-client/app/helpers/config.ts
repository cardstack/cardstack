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
