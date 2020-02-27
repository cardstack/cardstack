import logger from '@cardstack/logger';
import Session from '@cardstack/plugin-utils/session';
import { declareInjections } from '@cardstack/di';
import { todo } from '@cardstack/plugin-utils/todo-any';
import { SingleResourceDoc, CollectionResourceDoc } from 'jsonapi-typescript';
import cardUtils from '@cardstack/plugin-utils/card-utils';
import baseCard from '@cardstack/base-card';

const log = logger('cardstack/card-services');

const { adaptCardToFormat, adaptCardCollectionToFormat } = cardUtils;

// cards are not schema, so we are creating this here instead of bootstrap-schema.js
async function setupBaseCard(pgsearchClient: todo, searchers: todo, writers: todo) {
  await pgsearchClient.ensureDatabaseSetup();
  let currentInternalBaseCard: SingleResourceDoc | undefined;
  try {
    currentInternalBaseCard = await searchers.get(
      Session.INTERNAL_PRIVILEGED,
      'local-hub',
      baseCard.data.id,
      baseCard.data.id
    );
  } catch (err) {
    if (err.status !== 404) {
      throw err;
    }
  }

  if (!currentInternalBaseCard) {
    log.info(`Base card doesn't exist yet, creating @cardstack/base-card...`);
    await writers.create(Session.INTERNAL_PRIVILEGED, 'cards', baseCard);
  } else {
    log.info(`Base card exists.`);
  }
}

export = declareInjections(
  {
    writers: 'hub:writers',
    searchers: 'hub:searchers',
    currentSchema: 'hub:current-schema',
    pgsearchClient: `plugin-client:${require.resolve('@cardstack/pgsearch/client')}`,
  },

  class CardServices {
    searchers: todo;
    currentSchema: todo;
    writers: todo;
    _setupPromise: Promise<void>;

    static create(...args: todo) {
      return new this(args[0]);
    }

    constructor({ pgsearchClient, writers, searchers, currentSchema }: todo) {
      this.writers = writers;
      this.searchers = searchers;
      this.currentSchema = currentSchema;

      this._setupPromise = setupBaseCard(pgsearchClient, searchers, writers);
    }

    async get(session: Session, id: string, format: string) {
      await this._setupPromise;
      let card: SingleResourceDoc = (await this.searchers.get(session, 'local-hub', id, id, {
        format,
      })) as SingleResourceDoc;
      return await adaptCardToFormat(await this.currentSchema.getSchema(), session, card, format, this.searchers);
    }

    async search(session: Session, format: string, query: todo) {
      await this._setupPromise;
      let cards: CollectionResourceDoc = (await this.searchers.search(session, query, {
        format,
      })) as CollectionResourceDoc;
      return await adaptCardCollectionToFormat(
        await this.currentSchema.getSchema(),
        session,
        cards,
        format,
        this.searchers
      );
    }

    async create(session: Session, card: SingleResourceDoc) {
      await this._setupPromise;
      return await this.writers.create(session, 'cards', card);
    }

    async update(session: Session, id: string, card: SingleResourceDoc) {
      await this._setupPromise;
      return await this.writers.update(session, 'cards', id, card);
    }

    async delete(session: Session, id: string, version: string) {
      await this._setupPromise;
      return await this.writers.delete(session, version, 'cards', id);
    }
  }
);
