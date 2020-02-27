import logger from '@cardstack/logger';
import Session from '@cardstack/plugin-utils/session';
import { declareInjections } from '@cardstack/di';
import { todo } from '@cardstack/plugin-utils/todo-any';
import { get, set, isEqual, unset, isEmpty } from 'lodash';
import { SingleResourceDoc, CollectionResourceDoc, RelationshipsWithData } from 'jsonapi-typescript';
import cardUtils from '@cardstack/plugin-utils/card-utils';
import baseCard from '@cardstack/base-card';

const log = logger('cardstack/card-services');

const { adaptCardToFormat, adaptCardCollectionToFormat, cardComputedFields } = cardUtils;

// cards are not schema, so we are creating this here instead of bootstrap-schema.js
async function setupBaseCard(pgsearchClient: todo, searchers: todo, writers: todo, currentSchema: todo) {
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
    let version = get(currentInternalBaseCard, 'data.meta.version');
    let source = get(currentInternalBaseCard, 'data.meta.source');
    let schema = await currentSchema.getSchema();
    let dataSource = schema.getDataSource(source);

    if (dataSource && dataSource.sourceType === '@cardstack/ephemeral') {
      // the currentBaseCard actually doesn't exist--it's left over from the last time the index was running
      log.info(`Base card doesn't exist yet, creating @cardstack/base-card...`);
      await writers.create(Session.INTERNAL_PRIVILEGED, 'cards', baseCard);
    } else {
      let currentBaseCard: SingleResourceDoc = await adaptCardToFormat(
        schema,
        Session.INTERNAL_PRIVILEGED,
        currentInternalBaseCard,
        'isolated',
        searchers
      );
      unset(currentBaseCard, 'data.attributes.metadata-summary');
      for (let resource of (currentBaseCard.included || []).concat(currentBaseCard.data)) {
        delete resource.meta;
        if (isEmpty(resource.attributes || {})) {
          delete resource.attributes;
        }
        if (isEmpty(resource.relationships || {})) {
          delete resource.relationships;
        }
      }
      for (let computedField of cardComputedFields) {
        unset(currentBaseCard, `data.attributes.${computedField}`);
        unset(currentBaseCard, `data.relationships.${computedField}`);
      }
      for (let rel of Object.keys(baseCard.data.relationships || {})) {
        if (!(baseCard.data.relationships![rel] as RelationshipsWithData).data) {
          unset(baseCard.data.relationships, rel);
        }
      }
      unset(currentBaseCard, 'data.attributes.field-order');
      if (!isEqual(currentBaseCard, baseCard)) {
        log.debug('the current base card:', JSON.stringify(currentBaseCard, null, 2));
        log.debug('new base card:', JSON.stringify(baseCard, null, 2));
        log.info(`Base card is out of date, updating @cardstack/base-card...`);
        set(baseCard, 'data.meta.version', version);
        await writers.update(Session.INTERNAL_PRIVILEGED, 'cards', baseCard.data.id, baseCard);
      } else {
        log.info(`Base card is up to date.`);
      }
    }
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

      this._setupPromise = setupBaseCard(pgsearchClient, searchers, writers, currentSchema);
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
