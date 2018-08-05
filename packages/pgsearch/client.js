
const { Pool, Client } = require('pg');
const Cursor = require('pg-cursor');
const migrate = require('node-pg-migrate').default;
const log = require('@cardstack/logger')('cardstack/pgsearch');
const DocumentContext = require('@cardstack/hub/indexing/document-context');
const Session = require('@cardstack/plugin-utils/session');
const { declareInjections } = require('@cardstack/di');
const EventEmitter = require('events');
const parse = require('pg-connection-string');
const { join } = require('path');

const dbSuffix = process.env.PGSEARCH_NAMESPACE || 'content';

let config;
if (process.env.PGHOST && process.env.PGPORT && process.env.PGUSER) {
	config = {
		host: process.env.PGHOST,
		port: process.env.PGPORT,
		user: process.env.PGUSER,
    password: process.env.PGPASSWORD
	};
} else if (process.env.DB_URL) {
  config = parse(process.env.DB_URL);
} else {
	config = {
		host: 'localhost',
		port: 5444,
		user: 'postgres',
	};
}
config.database = `pgsearch_${dbSuffix}`;

module.exports = declareInjections({
  controllingBranch: 'hub:controlling-branch',
},

class PgClient extends EventEmitter {
  static create(args) {
    return new this(args);
  }

  constructor({ controllingBranch }){
    super();

    this.controllingBranch = controllingBranch;

    this.pool = new Pool({
      user: config.user,
      host: config.host,
      database: config.database,
      password: config.password,
      port: config.port
    });

    this._didEnsureDatabaseSetup = false;
  }

  static async teardown(instance) {
    if (instance.pool) {
      await instance.pool.end();
    }
  }

  async ensureDatabaseSetup() {
    if (this._didEnsureDatabaseSetup){
      return;
    }

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

    try {
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
    } catch (err) {
      if (err.message && err.message.indexOf('migration is already running') > -1) {
        log.warn("Migration is already running");
      } else {
        throw err;
      }
    }
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

  async accomodateSchema(/* branch, schema */){
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

  async loadMeta({ branch, id }) {
    let response = await this.query('SELECT params from meta where branch=$1 and id=$2', [branch, id]);
    if (response.rowCount > 0){
      return response.rows[0].params;
    }
  }

  async readUpstreamDocument({ branch, type, id }) {
    let sql = 'select upstream_doc from documents where branch=$1 and type=$2 and id=$3';
    let response = await this.query(sql, [branch, type, id]);
    if (response.rowCount > 0) {
      return response.rows[0].upstream_doc;
    }
  }

  beginBatch() {
    return new Batch(this);
  }

  async deleteOlderGenerations(branch, sourceId, nonce) {
    let sql = 'delete from documents where (generation != $1 or generation is null) and source=$2 and branch=$3';
    await this.query(sql, [nonce, sourceId, branch]);
  }

  async saveMeta({branch, id, params}) {
    let sql = 'insert into meta (branch, id, params) values ($1, $2, $3) on conflict on constraint meta_pkey do UPDATE SET params = EXCLUDED.params';
    await this.query(sql, [branch, id, params]);
  }

  async emitEvent(operation, context) {
    let { type, id, upstreamDoc:doc } = context;
    this.emit(operation, { type, id, doc });
  }

  async docsThatReference(branch, references, fn){
    const queryBatchSize = 100;
    for (let i = 0; i < references.length; i += queryBatchSize){
      let queryRefs = references.slice(i, i + queryBatchSize);
      await this._iterateThroughRows(
        'select upstream_doc, refs from documents where branch=$1 and refs && $2',
        [branch, queryRefs],
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
});

class Batch {
  constructor(client) {
    this.client = client;
    this._touched = Object.create(null);
    this._touchCounter = 0;
    this._schema = null;
    this._read = null;
    this._branch = null;
    this._grantsTouched = false;
    this._groupsTouched = false;
  }

  async saveDocument(context) {
    let { schema, branch, type, id, sourceId, generation, upstreamDoc, _read:read } = context;
    if (id == null) {
      log.warn(`pgsearch cannot save document without id ${JSON.stringify(upstreamDoc)}`);
      return;
    }

    let searchDoc = await context.searchDoc();
    let pristineDoc = await context.pristineDoc();
    let refs = await context.references();
    let realms = await context.realms();

    this._schema = schema;
    this._read = read;
    this._branch = branch;

    this._touched[`${type}/${id}`] = this._touchCounter++;

    if (!searchDoc) { return; }

    let sql = 'insert into documents (branch, type, id, search_doc, pristine_doc, upstream_doc, source, generation, refs, realms) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) on conflict on constraint documents_pkey do UPDATE SET search_doc = EXCLUDED.search_doc, pristine_doc = EXCLUDED.pristine_doc, upstream_doc = EXCLUDED.upstream_doc, source = EXCLUDED.source, generation = EXCLUDED.generation, refs = EXCLUDED.refs, realms = EXCLUDED.realms';

    await this.client.query(sql, [branch, type, id, searchDoc, pristineDoc, upstreamDoc, sourceId, generation, refs, realms]);
    await this.client.emitEvent('add', context);
    log.debug("save %s %s", type, id);

    await this._handleGrantOrGroupsTouched(context);
  }

  async deleteDocument(context) {
    let { branch, type, id, schema, _read:read } = context;

    this._schema = schema;
    this._read = read;
    this._branch = branch;

    this._touched[`${type}/${id}`] = this._touchCounter++;
    let sql = 'delete from documents where branch=$1 and type=$2 and id=$3';

    await this.client.query(sql, [branch, type, id]);
    await this.client.emitEvent('delete', { type, id });
    log.debug("delete %s %s", type, id);

    await this._handleGrantOrGroupsTouched(context);
  }

  async done() {
    await this._invalidations(this._schema, this._branch, this._read);

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
    let { branch, type } = context;

    if (this.client.controllingBranch.name === branch) {
      this._grantsTouched = this._grantsTouched || type === 'grants';
      this._groupsTouched = this._groupsTouched || type === 'groups';
      await this._maybeUpdateRealms(context);
    }
  }

  async _recalcuateRealms() {
    let branch = this.client.controllingBranch.name;
    await this.client._iterateThroughRows(
      'select id, type, upstream_doc from documents where branch=$1',
      [branch],
      async ({ id, upstream_doc:upstreamDoc, type }) => {
        let realms = this._schema.authorizedReadRealms(type, upstreamDoc.data);
        const sql = 'update documents set realms=$1 where id=$2 and type=$3 and branch=$4';
        await this.client.query(sql, [realms, id, type, branch]);
      });
  }

  async _recalculateUserRealms() {
    let branch = this.client.controllingBranch.name;
    await this.client._iterateThroughRows(
      `select id, type, source, upstream_doc, generation from documents where branch=$1 and type != 'user-realms'`,
      [branch],
      async ({ id, type, source:sourceId, upstream_doc:upstreamDoc, generation }) => {
          let context = new DocumentContext({
            branch,
            type,
            id,
            sourceId,
            generation,
            upstreamDoc,
            schema: this._schema,
            read: this._read
          });
          await this._maybeUpdateRealms(context);
      });
  }

  // This method does not need to recursively invalidate, because each
  // document stores a complete, rolled-up picture of which other
  // documents it references.
  async _invalidations(schema, branch, read) {
    await this.client.docsThatReference(branch, Object.keys(this._touched), async (doc, refs) => {
      let { type, id } = doc.data;

      if (this._isInvalidated(type, id, refs)) {
        let sourceId = schema.types.get(type).dataSource.id;
        // this is correct because IF this document's data source is currently
        // doing a replace-all operation, it was either already touched (so
        // this code isn't running) or it's old (so it's correct to have a
        // non-current nonce).
        let nonce = 0;
        let context = new DocumentContext({
          schema,
          branch,
          type,
          id,
          sourceId,
          generation: nonce,
          upstreamDoc: doc,
          read
        });

        if (type === 'user-realms') {
          // if we have an invalidated user-realms and it hasn't
          // already been touched, that's because the corresponding
          // user was delete, so we should also delete the
          // user-realms.
          await this.deleteDocument({ branch, type, id });
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
      let refTouchedAt = this._touched[ref];
      if (refTouchedAt != null && refTouchedAt > docTouchedAt) {
        // we found one of our references that was touched later than us, so we
        // need to be redone
        return true;
      }
    }
    return false;
  }

  async _maybeUpdateRealms(context) {
    let { id, type, branch, sourceId, generation, schema, read, upstreamDoc:doc } = context;
    if (!doc) { return; }

    let realms = await schema.userRealms(doc.data);
    if (realms) {
      let userRealmsId = Session.encodeBaseRealm(type, id);
      let userRealmContext = new DocumentContext({
        type: 'user-realms',
        id: userRealmsId,
        branch,
        sourceId,
        generation,
        schema,
        read,
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
