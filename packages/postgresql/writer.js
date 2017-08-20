const PendingChange = require('@cardstack/plugin-utils/pending-change');
const Error = require('@cardstack/plugin-utils/error');
const { Pool } = require('pg');
const { range, snakeCase }  = require('lodash');
const rowToDocument = require('./row-to-doc');

const safeIdentifier = /^[a-zA-Z0-9._]+$/;
const pendingChanges = new WeakMap();

/*
const logger = require('@cardstack/plugin-utils/logger');
*/

module.exports = class Writer {
  static create(params) {
    return new this(params);
  }
  constructor({ branches, dataSource }) {
    this.branchConfig = branches;
    this.pools = Object.create(null);
    this.schemas = Object.create(null);
    this.dataSource = dataSource;
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
    let { tableName, args, columns } = this._prepareQuery(isSchema, branch, type, document);
    if (document.id != null) {
      args.push(document.id);
      columns.push('id');
    }
    let placeholders = range(1, args.length + 1).map(n => `$${n}`).join(',');
    let client = await this._getPool(branch).connect();
    try {
      await client.query('begin');
      let result = await client.query(`insert into ${tableName} (${columns.join(',')}) values (${placeholders}) returning *`, args);
      let finalDocument = rowToDocument(await this._getSchema(branch), type, result.rows[0]);
      let change = new PendingChange(null, finalDocument, finalize, abort);
      pendingChanges.set(change, { client });
      return change;
    } catch (err) {
      await client.release();
      throw err;
    }
  }

  async prepareUpdate(branch, session, type, id, document, isSchema) {
    let { tableName, args, columns } = this._prepareQuery(isSchema, branch, type, document);
    let client = await this._getPool(branch).connect();
    let schema = await this._getSchema(branch);
    args.push(id);
    try {
      await client.query('begin');
      let initialDocument = rowToDocument(schema, type, await client.query(`select * from ${tableName} where id=$1`, [ id ]));
      let result = await client.query(`update ${tableName} set ${columns.map((name,index) => `${name}=$${index+1}`).join(',')} where id=$${args.length} returning *`, args);
      let finalDocument = rowToDocument(schema, type, result.rows[0]);
      let change = new PendingChange(initialDocument, finalDocument, finalize, abort);
      pendingChanges.set(change, { client });
      return change;
    } catch (err) {
      await client.release();
      throw err;
    }
  }

  async prepareDelete(branch, session, version, type, id, isSchema) {
    let { tableName } = this._prepareQuery(isSchema, branch, type);
    let client = await this._getPool(branch).connect();
    try {
      await client.query('begin');
      let initialDocument = rowToDocument(await this._getSchema(branch), type, await client.query(`select * from ${tableName} where id=$1`, [ id ]));
      await client.query(`delete from ${tableName} where id=$1`, [id]);
      let change = new PendingChange(initialDocument, null, finalize, abort);
      pendingChanges.set(change, { client });
      return change;
    } catch (err) {
      await client.release();
      throw err;
    }

  }

  _prepareQuery(isSchema, branch, type, document) {
    if (isSchema) {
      throw new Error("The @cardstack/postgresql data source does not support schema creation", { status: 400 });
    }
    if (!this.branchConfig[branch]) {
      throw new Error(`No such configured branch ${branch}`, { status: 400 });
    }

    let tableName = snakeCase(type);
    if (!safeIdentifier.test(tableName)) {
      throw new Error(`Disallowed table name ${tableName}`);
    }
    let args = [];
    let columns = (document ? Object.entries(document.attributes || {}) : []).map(([key, value]) => {
      key = snakeCase(key);
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
      if (value && value.data && value.data.id) {
        columns.push(quoteKey(key));
        args.push(value.data.id);
      }
    });
    return { tableName, args, columns };
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