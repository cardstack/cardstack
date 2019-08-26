import Session from '@cardstack/plugin-utils/session';
import { declareInjections } from '@cardstack/di';
import { todo } from '@cardstack/plugin-utils/todo-any';
import { SingleResourceDoc, CollectionResourceDoc } from 'jsonapi-typescript';


export = declareInjections({
  searchers: 'hub:searchers',
},

class CardServices {
  searchers: todo;

  async get(session: Session, id: string, format: string) {
    return await this.searchers.get(session, 'local-hub', 'cards', id, { format }) as SingleResourceDoc;
  }

  async search(session: Session, format: string, query: todo) {
    return await this.searchers.search(session, query, { format }) as CollectionResourceDoc;
  }
});