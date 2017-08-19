const logger = require('@cardstack/plugin-utils/logger');
const { Pool } = require('pg');
const { partition, isEqual } = require('lodash');
const Error = require('@cardstack/plugin-utils/error');
const rowToDocument = require('./row-to-doc');

// Yes, this is slightly bananas. But it's easier to just read the
// output of the "test_decoding" plugin that ships with postgres than
// require a custom plugin.
const changePattern = /^table ([^.]+)\.([^:]+): ([^:]+): (.*)/;

// If your id contains spaces or quotes yer gonna have a bad time. Sorry not sorry.
const idPattern = /id\[[^\]]+\]:'?([^\s']+)/;

module.exports = class Indexer {
  static create(params) { return new this(params); }

  constructor({ branches, dataSource }) {
    this.branchConfig = branches;
    this.dataSourceId = dataSource.id;
    this.log = logger('postgresql');
    this.pools = Object.create(null);
  }

  async branches() {
    return Object.keys(this.branchConfig);
  }

  async beginUpdate(branch) {

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

    let client = await this.pools[branch].connect();
    return new Updater(client, this.log, this.dataSourceId);
  }

  async teardown() {
    for (let pool of Object.values(this.pools)) {
      await pool.end();
    }
  }
};

class Updater {
  constructor(client, log, dataSourceId) {
    this.client = client;
    this.log = log;
    this.dataSourceId = dataSourceId;
  }

  destroy() {
    this.client.release();
  }

  async query(statement, params) {
    try {
      return await this.client.query(statement, params);
    } catch(err) {
      throw new Error(`${err.message}, while executing ${statement}`);
    }
  }

  async schema() {
    if (!this._schema) {
      this._schema = await this._loadSchema();
    }
    return this._schema;
  }

  async _loadSchema() {
    // This is an inner join, so it will "miss" any table that has no
    // columns. But that's a silly case I don't want to support
    // anyway.
    let { rows: columns } = await this.query(`
      select table_schema, table_name, column_name, data_type
      from information_schema.tables natural join information_schema.columns
      where table_type = 'BASE TABLE'
            and table_schema != 'pg_catalog'
            and table_schema != 'information_schema';`);

    let types = Object.create(null);
    let fields = Object.create(null);

    for (let { table_schema, table_name, column_name, data_type } of columns) {
      let scopedTableName = this._typeNameFor(table_schema, table_name);

      // Every content type always has an ID field implicitly, it
      // doesn't need to be created.
      if (column_name === 'id') {
        continue;
      }

      if (column_name === 'type') {
        this.log.warn('Ignoring a column named "type" on table %s because its not a legal JSONAPI field name', scopedTableName);
        continue;
      }

      let fieldType = this._fieldTypeFor(data_type);
      if (!fieldType) {
        this.log.warn('Ignoring column "%s" because of unknown data type "%s"', column_name, data_type);
        continue;
      }

      let internalName = dasherize(column_name);

      if (!fields[internalName]) {
        fields[internalName] = this._initializeField(internalName, fieldType);
      }

      if (!types[scopedTableName]) {
        types[scopedTableName] = this._initializeContentType(scopedTableName);
      }
      types[scopedTableName].relationships.fields.data.push({ type: 'fields', id: internalName });
    }

    let { rows: relationshipColumns } = await this.query(`
      SELECT
           KCU1.constraint_schema AS fk_constraint_schema
          ,KCU1.CONSTRAINT_NAME AS fk_constraint_name
          ,KCU1.TABLE_NAME AS fk_table_name
          ,KCU1.COLUMN_NAME AS fk_column_name
          ,KCU1.ORDINAL_POSITION AS fk_ordinal_position
          ,KCU2.CONSTRAINT_NAME AS referenced_constraint_name
          ,KCU2.TABLE_NAME AS referenced_table_name
          ,KCU2.COLUMN_NAME AS referenced_column_name
          ,KCU2.ORDINAL_POSITION AS referenced_ordinal_position
      FROM INFORMATION_SCHEMA.REFERENTIAL_CONSTRAINTS AS RC

      INNER JOIN INFORMATION_SCHEMA.KEY_COLUMN_USAGE AS KCU1
          ON KCU1.CONSTRAINT_CATALOG = RC.CONSTRAINT_CATALOG
          AND KCU1.CONSTRAINT_SCHEMA = RC.CONSTRAINT_SCHEMA
          AND KCU1.CONSTRAINT_NAME = RC.CONSTRAINT_NAME

      INNER JOIN INFORMATION_SCHEMA.KEY_COLUMN_USAGE AS KCU2
          ON KCU2.CONSTRAINT_CATALOG = RC.UNIQUE_CONSTRAINT_CATALOG
          AND KCU2.CONSTRAINT_SCHEMA = RC.UNIQUE_CONSTRAINT_SCHEMA
          AND KCU2.CONSTRAINT_NAME = RC.UNIQUE_CONSTRAINT_NAME
          AND KCU2.ORDINAL_POSITION = KCU1.ORDINAL_POSITION`);

    for (let {fk_column_name, referenced_table_name, fk_constraint_schema} of relationshipColumns) {
      let field = fields[fk_column_name];
      if (!field) {
        throw new Error(`There was a problem with the relationship field ${fk_column_name}, it could not be found to turn into a relationship`);
      }

      let tableName = this._typeNameFor(fk_constraint_schema, referenced_table_name);

      if (!types[tableName]) {
        throw new Error(`Could not find the content type ${tableName}`);
      }

      field.attributes['field-type'] = "@cardstack/core-types::belongs-to";

      field.relationships = {'related-types':  { data: [ { type: 'content-types', id: tableName }]}};
    }

    return Object.values(types).concat(Object.values(fields));
  }

  async updateContent(meta, hints, ops) {
    let replicationSlot;
    if (meta && meta.replicationSlot) {
      replicationSlot = meta.replicationSlot;
    } else {
      replicationSlot = `cardstack_${Math.floor(Math.random() * Number.MAX_SAFE_INTEGER)}`;
    }

    let lastSchema;
    if (meta && meta.lastSchema) {
      lastSchema = meta.lastSchema;
    }

    let hasExistingSlot = (await this.query('SELECT * FROM pg_replication_slots where slot_name=$1', [replicationSlot])).rowCount > 0;
    if (hasExistingSlot) {
      await this._incrementalUpdate(replicationSlot, ops, lastSchema);
    } else {
      await this._fullUpdate(replicationSlot, ops);
    }

    return { replicationSlot, lastSchema: await this.schema() };
  }

  async _incrementalUpdate(replicationSlot, ops, lastSchema) {
    this.log.debug("Using existing replication slot %s", replicationSlot);

    let oldSchema = Object.create(null);
    if (lastSchema) {
      for (let model of lastSchema) {
        oldSchema[model.type + '/' + model.id] = model;
      }
    }

    // we always poll the schema models, because they're not
    // included in logical replication so we don't have a
    // fine-grained diff on them.
    for (let model of await this.schema()) {
      let prior = oldSchema[model.type + '/' + model.id];
      if (!prior || !isEqual(prior, model)) {
        await ops.save(model.type, model.id, model);
      }
      delete oldSchema[model.type + '/' + model.id];
    }

    for (let model of Object.values(oldSchema)) {
      await ops.delete(model.type, model.id);
    }

    await this._processReplicationLog(replicationSlot, ops);
  }

  async _processReplicationLog(replicationSlot, ops) {
    // This is a safety valve to keep us from getting stuck here
    // forever if the database is spewing changes faster than we are
    // indexing them.
    let cycleCount = 0;
    while (cycleCount++ < 100 ) {
      let changes = await this.query(`SELECT data FROM pg_logical_slot_get_changes($1, NULL, NULL)`, [replicationSlot]);
      if (changes.rowCount === 0) {
        break;
      }
      let dirty = this._dirtyRecords(changes.rows);
      for (let { schema, table, type, commands } of Object.values(dirty)) {
        let [deletes, rest] = partition(commands, ({ command }) => command === 'DELETE');
        for (let { id } of deletes) {
          await ops.delete(type, id);
        }
        let result = await this.query(`SELECT * from ${schema}.${underscore(table)} where id = any($1)`, [ rest.map(({id}) => id) ]);
        for (let row of result.rows) {
          await ops.save(type, row.id, await this._toDocument(type, row));
        }
      }
    }
  }

  async _fullUpdate(replicationSlot, ops) {
    await ops.beginReplaceAll();
    await this.query(`SELECT * FROM pg_create_logical_replication_slot($1, 'test_decoding')`, [replicationSlot]);
    this.log.debug("Created new replication slot %s", replicationSlot);
    for (let model of await this.schema()) {
      ops.save(model.type, model.id, model);
      if (model.type === 'content-types') {
        await this._fullUpdateType(model.id, ops);
      }
    }
    // This catches changes that happened in between the time we
    // created our replication slot above and when we finished our
    // initial crawl.
    await this._processReplicationLog(replicationSlot, ops);
    await ops.finishReplaceAll();
  }

  async _fullUpdateType(type, ops) {
    let result = await this.query(`select * from ${underscore(type)}`);
    for (let row of result.rows) {
      await ops.save(type, row.id, await this._toDocument(type, row));
    }
  }

  async _toDocument(type, row) {
    return rowToDocument(await this.schema(), type, row);
  }

  _dirtyRecords(changeRows) {
    let dirty = Object.create(null);
    for (let { data } of changeRows) {
      let m = changePattern.exec(data);
      if (m) {
        let [, schema, table, command, values] = m;
        let type = this._typeNameFor(schema, table);
        let id = idPattern.exec(values);
        if (!id) {
          this.log.warn("Found no id in change log entry: %s. Perhaps you need to set the primary key?", data);
          continue;
        } else {
          if (!dirty[type]) {
            dirty[type] = { schema, table, type, commands: [] };
          }
          dirty[type].commands.push({ command, id: id[1] });
        }
      }
    }
    return dirty;
  }

  _typeNameFor(schema, table) {
    // The default schema in postgres is called 'public'. We can
    // conventionally strip that off the type names, while keeping
    // it on for more exotic schemas. Ultimately this can become
    // more customizable via configuration.

    // json-api uses kebab case but database tables use underscores
    let tableDasherized = dasherize(table);

    if (schema !== 'public') {
      return `${schema}.${tableDasherized}`;
    } else {
      return tableDasherized;
    }
  }

  _initializeContentType(id) {
    return {
      type: 'content-types',
      id,
      relationships: {
        fields: {
          data: []
        },
        'data-source': {
          data: { type: 'data-sources', id: this.dataSourceId }
        }
      }
    };
  }

  _initializeField(id, fieldType) {
    return {
      type: 'fields',
      id,
      attributes: {
        'field-type': fieldType
      }
    };
  }

  _fieldTypeFor(pgType) {
    switch(pgType) {
    case 'character varying':
    case 'text':
      return '@cardstack/core-types::string';

    // A postgres integer is 32 bits, which always fits into a safe
    // javascript integer. The same cannot be said for bigint -- we
    // will need to do something different for that (probably treat it
    // as a cardstack/core-types::string).
    case 'integer':
      return '@cardstack/core-types::integer';

    case 'boolean':
      return '@cardstack/core-types::boolean';

    case 'timestamp without time zone':
      return '@cardstack/core-types::date';

    case 'json':
      return '@cardstack/core-types::any';
    }
  }


}

function dasherize(name) {
  return name.replace(/_/g, '-');
}

function underscore(name) {
  return name.replace(/-/g, '_');
}