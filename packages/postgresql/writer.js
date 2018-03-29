const PendingChange = require('@cardstack/plugin-utils/pending-change');
const Error = require('@cardstack/plugin-utils/error');
const { Pool } = require('pg');
const { get, range }  = require('lodash');
const rowToDocument = require('./row-to-doc');
const NameMapper = require('./name-mapper');

const safeIdentifier = /^[a-zA-Z0-9._]+$/;
const pendingChanges = new WeakMap();

module.exports = class Writer {
  static create(params) {
    return new this(params);
  }
  constructor({ branches, dataSource, renameColumns, renameTables }) {
    this.branchConfig = branches;
    this.pools = Object.create(null);
    this.schemas = Object.create(null);
    this.dataSource = dataSource;
    this.mapper = new NameMapper(renameTables, renameColumns);
  }

  _getPool(branch) {
    if (!this.pools[branch]) {
      let config = this.branchConfig[branch];
      this.pools[branch] = new Pool({
        user: config.user,
        host: config.host,
        database: config.database,
        password: config.password,
        port: config.port
      });
    }
    return this.pools[branch];
  }

  async _getSchema(branch) {
    if (!this.schemas[branch]) {
      let updater = await this.dataSource.indexer.beginUpdate(branch);
      try {
        this.schemas[branch] = await updater.schema();
      } finally {
        await updater.destroy();
      }
    }
    return this.schemas[branch];
  }

  async teardown() {
    for (let pool of Object.values(this.pools)) {
      await pool.end();
    }
  }

  async prepareCreate(branch, session, type, document, isSchema) {
    let { schema, table, args, columns } = this._prepareQuery(isSchema, branch, type, document);
    if (document.id != null) {
      args.push(document.id);
      columns.push('id');
    }
    let placeholders = range(1, args.length + 1).map(n => `$${n}`).join(',');
    let client = await this._getPool(branch).connect();
    try {
      await client.query('begin');
      let result = await client.query(`insert into ${schema}.${table} (${columns.join(',')}) values (${placeholders}) returning *`, args);
      let finalDocument = rowToDocument(await this._getSchema(branch), type, result.rows[0]);
      let change = new PendingChange(null, finalDocument, finalize, abort);
      pendingChanges.set(change, { client });
      return change;
    } catch (err) {
      await client.release();
      rethrowNicerError(err);
    }
  }

  async prepareUpdate(branch, session, type, id, document, isSchema) {
    let { schema: dbschema, table, args, columns } = this._prepareQuery(isSchema, branch, type, document);
    let client = await this._getPool(branch).connect();
    let schema = await this._getSchema(branch);
    args.push(id);
    try {
      await client.query('begin');
      let result = await client.query(`select * from ${dbschema}.${table} where id=$1`, [ id ]);
      if (result.rows < 1) {
        throw new Error("Not found", { status: 404, source: { pointer: '/data/id' } });
      }
      let initialDocument = rowToDocument(schema, type, result.rows[0]);
      result = await client.query(`update ${dbschema}.${table} set ${columns.map((name,index) => `${name}=$${index+1}`).join(',')} where id=$${args.length} returning *`, args);
      let finalDocument = rowToDocument(schema, type, result.rows[0]);
      let change = new PendingChange(initialDocument, finalDocument, finalize, abort);
      pendingChanges.set(change, { client });
      return change;
    } catch (err) {
      await client.release();
      rethrowNicerError(err);
    }
  }

  async prepareDelete(branch, session, version, type, id, isSchema) {
    let { schema, table } = this._prepareQuery(isSchema, branch, type);
    let client = await this._getPool(branch).connect();
    try {
      await client.query('begin');
      let initialDocument = rowToDocument(await this._getSchema(branch), type, await client.query(`select * from ${schema}.${table} where id=$1`, [ id ]));
      await client.query(`delete from ${schema}.${table} where id=$1`, [id]);
      let change = new PendingChange(initialDocument, null, finalize, abort);
      pendingChanges.set(change, { client });
      return change;
    } catch (err) {
      await client.release();
      rethrowNicerError(err);
    }

  }

  async prepareApplyCheckpoint(branch, session, type, document/*, isSchema*/) {
    let sqlStatements = get(document, 'attributes.params.sql-statements');
    if (!sqlStatements || !Array.isArray(sqlStatements)) {
      throw new Error("The checkpoint restore for the @cardstack/postgresql data source does not specify a params.sql-statements as an array", { status: 400 });
    }

    let client = await this._getPool(branch).connect();
    try {
      await client.query('begin');
      for (let sql of sqlStatements) {
        await client.query(sql);
      }
      let change = new PendingChange(null, document, finalize, abort);
      pendingChanges.set(change, { client });
      return change;
    } catch (err) {
      await client.release();
      rethrowNicerError(err);
    }
  }

  _prepareQuery(isSchema, branch, type, document) {
    if (isSchema) {
      throw new Error("The @cardstack/postgresql data source does not support schema creation", { status: 400 });
    }
    if (!this.branchConfig[branch]) {
      throw new Error(`No such configured branch ${branch}`, { status: 400 });
    }

    let { schema, table } = this.mapper.tableForType(type);
    if (!safeIdentifier.test(table)) {
      throw new Error(`Disallowed table name ${table}`);
    }
    if (!safeIdentifier.test(schema)) {
      throw new Error(`Disallowed schema name ${schema}`);
    }

    let args = [];
    let columns = (document ? Object.entries(document.attributes || {}) : []).map(([key, value]) => {
      key = this.mapper.columnNameFor(schema, table, key);
      if (!safeIdentifier.test(key)) {
        throw new Error(`Disallowed column name ${key}`);
      }
      if (value instanceof Array) {
        // Arrays are a valid type of json to store in a json column, but they
        // are not escaped well when used with the prepared statement
        value = JSON.stringify(value);
      }
      args.push(value);
      return quoteKey(key);
    });

    // Handle relationships - TODO: no handling of polymorphism here yet
    (document ? Object.entries(document.relationships || {}) : []).map(([key, value]) => {
      key = this.mapper.columnNameFor(schema, table, key);
      if (value && value.data && value.data.id) {
        columns.push(quoteKey(key));
        args.push(value.data.id);
      }
    });
    return { table, schema, args, columns };
  }
};

function quoteKey(key) {
  return `"${key}"`;
}

async function finalize(pendingChange) {
  let { client } = pendingChanges.get(pendingChange);
  await client.query('commit');
  await client.release();
}

async function abort(pendingChange) {
  let { client } = pendingChanges.get(pendingChange);
  await client.query('rollback');
  await client.release();
}

function rethrowNicerError(err) {
  if (err.constraint) {
    throw new Error(err.message, { title: "Constraint violation", status: 401 });
  }
  throw err;
}
