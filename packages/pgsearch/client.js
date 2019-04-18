
const { Pool, Client } = require('pg');
const Cursor = require('pg-cursor');
const migrate = require('node-pg-migrate').default;
const log = require('@cardstack/logger')('cardstack/pgsearch');
const Session = require('@cardstack/plugin-utils/session');
const EventEmitter = require('events');
const postgresConfig = require('@cardstack/plugin-utils/postgres-config');
const { currentVersionLabel, cardContextFromId, isCard, cardIdFromId } = require('@cardstack/plugin-utils/card-context');
const { join } = require('path');
const { get } = require('lodash');
const { upsert, queryToSQL, param } = require('./util');

const config = postgresConfig({ database: `pgsearch_${process.env.PGSEARCH_NAMESPACE}` });

module.exports = class PgClient extends EventEmitter {
  static create(...args) {
    return new this(...args);
  }

  constructor(){
    super();

    this.pool = new Pool({
      user: config.user,
      host: config.host,
      database: config.database,
      password: config.password,
      port: config.port
    });

    this._migrateDbPromise = null;
    this._didEnsureDatabaseSetup = false;
  }

  static async teardown(instance) {
    if (instance.pool) {
      await instance.pool.end();
    }
  }

  async ensureDatabaseSetup() {
    if (this._didEnsureDatabaseSetup) { return; }

    if (!this._migrateDbPromise) {
      this._migrateDbPromise = this._migrateDb();
    }
    await this._migrateDbPromise;

    this._didEnsureDatabaseSetup = true;
  }

  async _migrateDb() {
    let client = new Client(Object.assign({}, config, { database: 'postgres' }));
    try {
      await client.connect();
      let response = await client.query(`select count(*)=1 as has_database from pg_database where datname=$1`, [config.database]);
      if (!response.rows[0].has_database) {
        await client.query(`create database ${safeDatabaseName(config.database)}`);
      }
    } finally {
      client.end();
    }

    await migrate({
      direction: 'up',
      migrationsTable: 'migrations',
      singleTransaction: true,
      checkOrder: false,
      databaseUrl: {
        user: config.user,
        host: config.host,
        database: config.database,
        password: config.password,
        port: config.port
      },
      dir: join(__dirname, 'migrations'),
      log: (...args) => log.debug(...args)
    });
  }

  static async deleteSearchIndexIHopeYouKnowWhatYouAreDoing() {
    let client = new Client(Object.assign({}, config, { database: 'postgres' }));
    try {
      await client.connect();
      await client.query(`drop database if exists ${safeDatabaseName(config.database)}`);
    } finally {
      client.end();
    }
  }

  async accomodateSchema(/* schema */){
    await this.ensureDatabaseSetup();
    // TODO: add specialized indices to postgres?
  }

  async query(...args) {
    let client = await this.pool.connect();
    try {
      return await client.query(...args);
    }
    finally {
      client.release();
    }
  }

  async loadMeta({ id }) {
    let response = await this.query('SELECT params from meta where id=$1', [id]);
    if (response.rowCount > 0){
      return response.rows[0].params;
    }
  }

  async readUpstreamDocument({ sourceId, packageName, id }) {
    let sql = `select upstream_doc from documents where source=$1 and package_name=$2 and id=$3 and snapshot_version='${currentVersionLabel}'`;
    let response = await this.query(sql, [sourceId, packageName, id]);
    if (response.rowCount > 0) {
      return response.rows[0].upstream_doc;
    }
  }

  beginBatch(schema, searchers) {
    return new Batch(this, schema, searchers);
  }

  async deleteOlderGenerations(sourceId, nonce) {
    let sql = `delete from documents where (generation != $1 or generation is null) and source=$2 and snapshot_version='${currentVersionLabel}'`;
    await this.query(sql, [nonce, sourceId ]);
  }

  async saveMeta({id, params}) {
    let sql = 'insert into meta (id, params) values ($1, $2) on conflict on constraint meta_pkey do UPDATE SET params = EXCLUDED.params';
    await this.query(sql, [id, params]);
  }

  async emitEvent(operation, context) {
    let { type, id, upstreamDoc:doc } = context;
    this.emit(operation, { type, id, doc });
  }

  async docsThatReference(references, fn){
    let refs = [];
    references.forEach(key => {
      let [type, id] = key.split('/');
      refs.push(`${type}/${id}`);
    });

    const queryBatchSize = 100;
    for (let i = 0; i < refs.length; i += queryBatchSize) {
      let queryRefs = refs.slice(i, i + queryBatchSize);
      await this._iterateThroughRows(
        `select source, upstream_doc, refs from documents where refs && $1 and snapshot_version='${currentVersionLabel}'`,
        [queryRefs],
        async (row) => await fn(row.source, row.upstream_doc, row.refs)
      );
    }
  }

  async _iterateThroughRows(sql, params, fn) {
    const rowBatchSize = 100;
    let client = await this.pool.connect();
    try {
      let cursor = client.query(new Cursor(sql, params));
      let rows;
      do {
        rows = await readCursor(cursor, rowBatchSize);
        for (let row of rows){
          await fn(row);
        }
      } while (rows.length > 0);
    }
    finally {
      client.release();
    }
  }
};

class Batch {
  constructor(client, currentSchema, searchers) {
    this.client = client;
    this._searchers = searchers;
    this._currentSchema = currentSchema;
    this._touched = Object.create(null);
    this._touchCounter = 0;
    this._grantsTouched = false;
    this._groupsTouched = false;
    this._cache = [];
  }

  async saveDocument(context, opts = {}) {
    let {
      type,
      id,
      generation,
      upstreamDoc,
      packageVersion
    } = context;
    let { packageName, sourceId } = cardContextFromId(id);

    // TODO stop hard coding this
    packageVersion = 'x.x.x';

    if (id == null) {
      log.warn(`pgsearch cannot save document without id ${JSON.stringify(context.upstreamDoc)}`);
      return;
    }

    if (isCard(id) && type !== 'cards' && !this._searchers.ownTypes.includes(type)) {
      id = context.cardId;
      upstreamDoc = await context.upstreamCard();
      context = await context.deriveDocumentContextForDocument(upstreamDoc, ['all-models']);
    }

    let pristineDoc = await context.pristineDoc();
    let searchDoc = await context.searchDoc();
    let refs = await context.references();
    let realms = await context.realms();

    this._touched[`${isCard(id) ? 'cards' : type}/${context.cardId}`] = this._touchCounter++;

    if (!searchDoc) { return; }

    let currentDocument = {
      source: param(sourceId),
      package_name: param(packageName || type),
      id: param(id),
      snapshot_version: param(currentVersionLabel),
      package_version: param(packageVersion),
      search_doc: param(searchDoc),
      q: [`to_tsvector('english',`, param(searchDoc), ')'],
      pristine_doc: param(pristineDoc),
      upstream_doc: param(upstreamDoc),
      refs: param(refs),
      realms: param(realms),
      expires: expirationExpression(opts.maxAge)
    };

    if (generation != null) {
      currentDocument.generation = param(generation);
    }

    await this.client.query(queryToSQL(upsert('documents', 'documents_pkey', currentDocument)));

    // TODO create snapshot record of card

    await this.client.emitEvent('add', context);
    log.debug("save %s %s %s", sourceId, packageName, id);

    await this._handleGrantOrGroupsTouched(context);
  }

  // Note this only eliminates the current version of document, snapshot versions are untouched
  async deleteDocument(context) {
    let { type, id, schema } = context;
    let { sourceId, packageName } = cardContextFromId(id);

    if (isCard(id) && type !== 'cards' && type !== schema.getCardDefinition(id).modelContentType.id) {
      // This is an internal model that is being deleted, which is not actually a deletion of a row in the documents table
      let upstreamDoc = await context.upstreamCard();
      let allModels = get(upstreamDoc, 'data.relationships.all-models.data');
      allModels = allModels.filter(i => `${i.type}/${i.id}` !== `${type}/${id}`);
      let included = upstreamDoc.included;
      included = included.filter(i => `${i.type}/${i.id}` !== `${type}/${id}`);
      upstreamDoc.data.relationships['all-models'].data = allModels;
      removeReferenceFromRelationships(included, type, id);
      upstreamDoc.included = included;

      return await this.saveDocument(this._searchers.createDocumentContext({
        type: 'cards',
        id: context.cardId,
        sourceId,
        upstreamDoc,
        schema,
        includePaths: [ 'all-models' ]
      }));
    }

    let { rows } = await this.client.query(`select package_name, id, source, generation, upstream_doc as "upstreamDoc" from documents where source=$1 and package_name=$2 and id=$3 and snapshot_version='${currentVersionLabel}'`, [sourceId, packageName, id]);
    let [ row={} ] = rows;
    let { upstreamDoc } = row;

    this._touched[`${isCard(id) ? 'cards' : type}/${context.cardId}`] = this._touchCounter++;
    let sql = `delete from documents where source=$1 and package_name=$2 and id=$3 and snapshot_version='${currentVersionLabel}'`;

    await this.client.query(sql, [sourceId, packageName, id]);
    await this.client.emitEvent('delete', { sourceId, packageName, id, type, upstreamDoc }); // TODO make sure to find and update all listeners of this event (I think @cardstack/ethereum is one example)
    log.debug("delete %s %s %s %s", sourceId, type, packageName, id);

    await this._handleGrantOrGroupsTouched(context);
  }

  async done() {
    await this._invalidations();

    if (this._grantsTouched) {
      await this._recalcuateRealms();
      // recalculate the user-realms, as the hub optimizes realms assigned
      // to users to only "in-use" realms. which may have changed by
      // recalculating realms above
      await this._recalculateUserRealms();
    } else if (this._groupsTouched) {
      await this._recalculateUserRealms();
    }
  }

  async _handleGrantOrGroupsTouched(context) {
    let { type } = context;

    this._grantsTouched = this._grantsTouched || type === 'grants';
    this._groupsTouched = this._groupsTouched || type === 'groups';
    await this._maybeUpdateRealms(context);
  }

  async _recalcuateRealms() {
    await this.client._iterateThroughRows(
      `select id, package_name, source, upstream_doc from documents where snapshot_version='${currentVersionLabel}'`, [],
      async ({ id, upstream_doc:upstreamDoc, package_name:packageName, source:sourceId }) => {
        let schema = await this._currentSchema.getSchema();
        let context = this._searchers.createDocumentContext({
          schema,
          type:packageName,
          id,
          sourceId,
          upstreamDoc
        });
        let realms = await schema.authorizedReadRealms(packageName, context); //TODO we'll probably need to include source in the authorized read realms params (?)...
        const sql = `update documents set realms=$1 where source=$2 and package_name=$3 and id=$4 and snapshot_version='${currentVersionLabel}'`;
        await this.client.query(sql, [realms, sourceId, packageName, id]);
      });
    }

  async _recalculateUserRealms() {
    let schema = await this._currentSchema.getSchema();
    await this.client._iterateThroughRows(
      `select id, package_name, source, upstream_doc, generation from documents where package_name != 'user-realms' and snapshot_version='${currentVersionLabel}'`, [],
      async ({ id, package_name:packageName, source:sourceId, upstream_doc:upstreamDoc, generation }) => {
          let context = this._searchers.createDocumentContext({
            type:packageName,
            id,
            sourceId,
            generation,
            upstreamDoc,
            schema
          });
          await this._maybeUpdateRealms(context);
      });
  }

  // This method does not need to recursively invalidate, because each
  // document stores a complete, rolled-up picture of which other
  // documents it references.
  // Note: that we are only invalidating down to the card level. We do not
  // currently have finer-grained card internal-models invalidation. As such modifying any card internal
  // model invalidates the entire card.
  async _invalidations() {
    await this.client._iterateThroughRows(
      `select source, package_name, id from documents where expires < now() and snapshot_version='${currentVersionLabel}'`, [], async({ package_name:packageName, id }) => {
        let type = isCard(id) ? 'cards' : packageName;
        this._touched[`${type}/${cardIdFromId(id)}`] = this._touchCounter++;
      });
    await this.client.query(`delete from documents where expires < now() and snapshot_version='${currentVersionLabel}'`);
    await this.client.docsThatReference(Object.keys(this._touched), async (sourceId, doc, refs) => {
      let { type, id } = doc.data;
      let { packageName } = cardContextFromId(id);

      if (this._isInvalidated(type, id, refs)) {
        let schema = await this._currentSchema.getSchema();
        let _sourceId = schema.types.get(type).dataSource.id; // TODO need to reconcile this after we support multi-hub

        // intentionally not setting the 'generation', as we dont want external data source
        // triggered invalidation to effect the nonce, which is an internal data source consideration
        let contextArgs = {
          schema,
          type,
          id,
          sourceId: _sourceId,
          upstreamDoc: doc,
        };
        if (type === 'cards') {
          contextArgs.includePaths = ['all-models'];
        }
        let context = this._searchers.createDocumentContext(contextArgs);

        if (packageName === 'user-realms') {
          // if we have an invalidated user-realms and it hasn't
          // already been touched, that's because the corresponding
          // user was delete, so we should also delete the
          // user-realms.
          await this.deleteDocument({ type, id });
        } else {
          let searchDoc = await context.searchDoc();
          if (!searchDoc) {
            // bad documents get ignored. The DocumentContext logs these for
            // us, so all we need to do here is nothing.
            return;
          }
          await this.saveDocument(context);
        }
      }
    });
  }

  _isInvalidated(type, id, refs) {
    let key = `${type}/${id}`;
    let docTouchedAt = this._touched[key];
    if (docTouchedAt == null) {
      // our document hasn't been updated at all, so it definitely needs to be redone
      return true;
    }
    for (let ref of refs) {
      let refTouchedAt = this._touched[`${ref}`];
      if (refTouchedAt != null && refTouchedAt > docTouchedAt) {
        // we found one of our references that was touched later than us, so we
        // need to be redone
        return true;
      }
    }
    return false;
  }

  async _maybeUpdateRealms(context) {
    let { id, type, sourceId, generation, schema, upstreamDoc:doc } = context;
    if (!doc) { return; }

    let realms = await schema.userRealms(doc.data);
    if (realms) {
      let userRealmsId = Session.encodeBaseRealm(type, id);
      let userRealmContext = this._searchers.createDocumentContext({
        type: 'user-realms',
        id: userRealmsId,
        sourceId,
        generation,
        schema,
        upstreamDoc: {
          data: {
            type: 'user-realms',
            id: userRealmsId,
            attributes: {
              realms
            },
            relationships: {
              user: {
                data: { type, id }
              }
            }
          }
        }
      });

      await this.saveDocument(userRealmContext);
    }
  }

}

function readCursor(cursor, rowCount){
  return new Promise((resolve, reject) => {
    cursor.read(rowCount, (err, rows) => {
      if (err) {
        reject(err);
      } else {
        resolve(rows);
      }
    });
  });
}

function safeDatabaseName(name){
  if (!/^[a-zA-Z_0-9]+$/.test(name)){
    throw new Error(`unsure if db name ${name} is safe`);
  }
  return name;
}

function expirationExpression(maxAge) {
  if (maxAge == null) {
    return ['NULL'];
  } else {
    // this has string mangling of a potentially-user-provided argument but it's
    // safe because we're doing that _inside_ of param().
    return ['now() + cast(', param(maxAge + ' seconds'), 'as interval)'];
  }
}

function removeReferenceFromRelationships(resources, type, id) {
  for (let resource of resources) {
    if (!resource.relationships) { continue; }
    for (let relationship of Object.keys(resource.relationships)) {
      if (!resource.relationships[relationship].data) { continue; }

      if (Array.isArray(resource.relationships[relationship].data)) {
        resource.relationships[relationship].data = resource.relationships[relationship].data.filter(i => `${i.type}/${i.id}` !== `${type}/${id}`);
      } else {
        let relObj = resource.relationships[relationship].data;
        if (relObj.type === type && relObj.id === id) {
          resource.relationships[relationship].data = null;
        }
      }
    }
  }
}