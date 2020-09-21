import Service from '@ember/service';
import { getOwner } from '@ember/application';

export default class IsComponentService extends Service {
  test(name?: string) {
    name = (name || '').trim();

    if (!name) {
      return false;
    }

    const owner = getOwner(this);
    const lookup = owner.lookup('component-lookup:main');
    return !!(lookup.componentFor(name, owner) || lookup.layoutFor(name, owner));
  }
}
