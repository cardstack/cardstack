import Service from '@ember/service';
import { inject as service } from '@ember/service';
import { UnsavedCard, CardId, Card } from '@cardstack/core/card';
import { CardstackSession } from './cardstack-session';
import { SingleResourceDoc } from 'jsonapi-typescript';
import { CardInstantiator } from '@cardstack/core/card-instantiator';
import { ModuleLoader } from '@cardstack/core/module-loader';
import { Container } from '@cardstack/core/container';
import { Factory } from '@cardstack/core/container';

export default class DataService extends Service implements CardInstantiator {
  @service cardstackSession!: CardstackSession;

  // TODO this should return Promise<AddressableCard>
  async instantiate(_jsonapi: SingleResourceDoc, _imposeIdentity?: CardId): Promise<any> {
    // TODO make a "reader" object to pass into the card
  }

  // TODO this should return Promise<AddressableCard>
  async createCard(realm: string, doc: SingleResourceDoc): Promise<any> {
    let moduleLoader: ModuleLoader = {
      async load(_card: Card, _localModulePath: string, _exportedName?: string): Promise<any> {
        // let module = await import(join(cardDir, localModulePath));
        // return module[exportedName];
        return () => {
          throw new Error(`Browser module loading not implemented`);
        };
      },
    };
    let container: Container = {
      async instantiate<T, A extends unknown[]>(factory: Factory<T, A>, ...args: A): Promise<T> {
        return new factory(...args); // TODO instantiate from the container
      },
    };
    let unsavedCard = new UnsavedCard(doc, realm, this, moduleLoader, container, this);
    // TODO post new card to server
    return unsavedCard;
  }
}
