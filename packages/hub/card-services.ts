import Session from '@cardstack/plugin-utils/session';
import { declareInjections } from '@cardstack/di';
import { todo } from '@cardstack/plugin-utils/todo-any';
import {
  SingleResourceDoc,
  CollectionResourceDoc,
} from 'jsonapi-typescript';
import cardUtils from './indexing/card-utils';

const {
  adaptCardToFormat,
  adaptCardCollectionToFormat
} = cardUtils;

export = declareInjections({
  writers: 'hub:writers',
  searchers: 'hub:searchers',
  currentSchema: 'hub:current-schema'
},

class CardServices {
  searchers: todo;
  currentSchema: todo;
  writers: todo;

  async get(session: Session, id: string, format: string) {
    let card: SingleResourceDoc = await this.searchers.get(session, 'local-hub', id, id, { format }) as SingleResourceDoc;
    return await adaptCardToFormat(await this.currentSchema.getSchema(), session, card, format, this);
  }

  async search(session: Session, format: string, query: todo) {
    let cards: CollectionResourceDoc = await this.searchers.search(session, query, { format }) as CollectionResourceDoc;
    return await adaptCardCollectionToFormat(await this.currentSchema.getSchema(), session, cards, format, this);
  }

  async create(session: Session, card: SingleResourceDoc) {
    // console.log("herecreate", JSON.stringify(card, null, 2));
    let created = await this.writers.create(session, 'cards', card);
    // console.log('donecreate');
    let id = card.data.id;
    let format = 'isolated';
    let card2: SingleResourceDoc = await this.searchers.get(session, 'local-hub', id, id, { format }) as SingleResourceDoc;

    // console.log("card2", JSON.stringify(card2, null, 2));


    return created;
  }

  async update(session: Session, id: string, card: SingleResourceDoc) {
    return await this.writers.update(session, 'cards', id, card);
  }

  async delete(session: Session, id: string, version: string) {
    return await this.writers.delete(session, version, 'cards', id);
  }
});