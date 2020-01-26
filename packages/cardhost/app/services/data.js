import Service from '@ember/service';
import { inject as service } from '@ember/service';
import { UnsavedCard } from '@cardstack/core/card';

export default class DataService extends Service {
  @service cardstackSession;

  async instantiate(/*jsonapi, imposeIdentity*/) {
    // TODO make a "reader" object to pass into the card
  }

  async createCard(realm, doc) {
    let moduleLoader = {
      load(/*card, localModulePath, exportedName = 'default'*/) {
        // let module = await import(join(cardDir, localModulePath));
        // return module[exportedName];
        return () => {
          throw new Error(`Browser module loading not implemented`);
        };
      },
    };
    let container = {
      instantiate(factory, ...args) {
        return new factory(...args); // TODO instantiate from the container
      },
    };
    let unsavedCard = new UnsavedCard(doc, realm, this, moduleLoader, container, this);
    // TODO post new card to server
    return unsavedCard;
  }
}
