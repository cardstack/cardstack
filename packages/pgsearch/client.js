
const { Pool, Client } = require('pg');
const Cursor = require('pg-cursor');
const migrate = require('node-pg-migrate').default;
const log = require('@cardstack/logger')('cardstack/pgsearch');
const Session = require('@cardstack/plugin-utils/session');
const EventEmitter = require('events');
const postgresConfig = require('@cardstack/plugin-utils/postgres-config');
const { join } = require('path');
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

  async readUpstreamDocument({ type, id }) {
    let sql = 'select upstream_doc from documents where type=$1 and id=$2';
    let response = await this.query(sql, [type, id]);
    if (response.rowCount > 0) {
      return response.rows[0].upstream_doc;
    }
  }

  beginBatch(schema, searchers) {
    return new Batch(this, schema, searchers);
  }

  async deleteOlderGenerations(sourceId, nonce) {
    let sql = 'delete from documents where (generation != $1 or generation is null) and source=$2';
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
        'select upstream_doc, refs from documents where refs && $1',
        [queryRefs],
        async (row) => await fn(row.upstream_doc, row.refs)
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
    let { type, id, sourceId, generation, upstreamDoc } = context;
    if (id == null) {
      log.warn(`pgsearch cannot save document without id ${JSON.stringify(upstreamDoc)}`);
      return;
    }

    let searchDoc = await context.searchDoc();
    let pristineDoc = await context.pristineDoc();
    let refs = await context.references();
    let realms = await context.realms();

    this._touched[`${type}/${id}`] = this._touchCounter++; //TODO we'll eventually need to use a touched key that is sensitive to source/pkg/card_id

    if (!searchDoc) { return; }

    let document = {
      type: param(type),
      id: param(id),
      search_doc: param(searchDoc),
      q: [`to_tsvector('english',`, param(searchDoc), ')'],
      pristine_doc: param(pristineDoc),
      upstream_doc: param(upstreamDoc),
      source: param(sourceId),
      refs: param(refs),
      realms: param(realms),
      expires: expirationExpression(opts.maxAge)
    };

    if (generation != null) {
      document.generation = param(generation);
    }

    await this.client.query(queryToSQL(upsert('documents', 'documents_pkey', document)));
    await this.client.emitEvent('add', context);
    log.debug("save %s %s", type, id);

    await this._handleGrantOrGroupsTouched(context);
  }

  async deleteDocument(context) {
    let { type, id } = context;
    let { rows } = await this.client.query('select type, id, source, generation, upstream_doc as "upstreamDoc" from documents where type=$1 and id=$2', [type, id]);
    let [ row={} ] = rows;
    let { upstreamDoc } = row;

    this._touched[`${type}/${id}`] = this._touchCounter++;
    let sql = 'delete from documents where type=$1 and id=$2';

    await this.client.query(sql, [type, id]);
    await this.client.emitEvent('delete', { id, type, upstreamDoc });
    log.debug("delete %s %s", type, id);

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
      'select id, type, source, upstream_doc from documents', [],
      async ({ id, upstream_doc:upstreamDoc, type, source:sourceId }) => {
        let schema = await this._currentSchema.getSchema();
        let context = this._searchers.createDocumentContext({
          schema,
          type,
          id,
          sourceId,
          upstreamDoc
        });
        let realms = await schema.authorizedReadRealms(type, context);
        const sql = 'update documents set realms=$1 where id=$2 and type=$3';
        await this.client.query(sql, [realms, id, type]);
      });
    }

  async _recalculateUserRealms() {
    let schema = await this._currentSchema.getSchema();
    await this.client._iterateThroughRows(
      `select id, type, source, upstream_doc, generation from documents where type != 'user-realms'`, [],
      async ({ id, type, source:sourceId, upstream_doc:upstreamDoc, generation }) => {
          let context = this._searchers.createDocumentContext({
            type,
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
  async _invalidations() {
    await this.client._iterateThroughRows(
      'select id, type from documents where expires < now()', [], async({ id, type }) => {
        this._touched[`${type}/${id}`] = this._touchCounter++;
      });
    await this.client.query('delete from documents where expires < now()');
    await this.client.docsThatReference(Object.keys(this._touched), async (doc, refs) => {
      let { type, id } = doc.data;

      if (this._isInvalidated(type, id, refs)) {
        let schema = await this._currentSchema.getSchema();
        let sourceId = schema.types.get(type).dataSource.id;

        // intentionally not setting the 'generation', as we dont want external data source
        // triggered invalidation to effect the nonce, which is an internal data source consideration
        let context = this._searchers.createDocumentContext({
          schema,
          type,
          id,
          sourceId,
          upstreamDoc: doc
        });

        if (type === 'user-realms') {
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
