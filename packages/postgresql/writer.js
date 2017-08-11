const PendingChange = require('@cardstack/plugin-utils/pending-change');
const Error = require('@cardstack/plugin-utils/error');
const { Pool } = require('pg');
const { range }  = require('lodash');

const safeIdentifier = /^[a-zA-Z0-9._]+$/;
const pendingChanges = new WeakMap();

/*
const logger = require('@cardstack/plugin-utils/logger');
*/

module.exports = class Writer {
  static create(params) {
    return new this(params);
  }
  constructor({ branches }) {
    this.branchConfig = branches;
    this.pools = Object.create(null);
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
      let result = await client.query(`insert into ${tableName} (${columns.join(',')}) values (${placeholders}) returning id`, args);
      let finalDocument = {
        id: String(result.rows[0].id),
        type,
        attributes: document.attributes
      };
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
    args.push(id);
    try {
      await client.query('begin');
      let result = await client.query(`update ${tableName} set ${columns.map((name,index) => `${name}=$${index+1}`).join(',')} where id=$${args.length} returning *`, args);
      let finalDocument = {
        id: String(result.rows[0].id),
        type,
        attributes: document.attributes
      };
      let change = new PendingChange(null, finalDocument, finalize, abort);
      pendingChanges.set(change, { client });
      return change;
    } catch (err) {
      await client.release();
      throw err;
    }

  }

  async prepareDelete(/* branch, session, version, type, id, isSchema */) {
  }

  _prepareQuery(isSchema, branch, type, document) {
    if (isSchema) {
      throw new Error("The @cardstack/postgresql data source does not support schema creation", { status: 400 });
    }
    if (!this.branchConfig[branch]) {
      throw new Error(`No such configured branch ${branch}`, { status: 400 });
    }

    let tableName = type;
    if (!safeIdentifier.test(tableName)) {
      throw new Error(`Disallowed table name ${tableName}`);
    }
    let args = [];
    let columns = Object.entries(document.attributes).map(([key, value]) => {
      if (!safeIdentifier.test(key)) {
        throw new Error(`Disallowed column name ${key}`);
      }
      args.push(value);
      return key;
    });
    return { tableName, args, columns };
  }
};

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
