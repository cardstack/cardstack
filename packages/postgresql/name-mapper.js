const { kebabCase, snakeCase } = require('lodash');

module.exports = class NameMapper {
  constructor(renameTables, renameColumns) {
    this.renameTables = renameTables || Object.create(null);
    this.renameColumns = renameColumns || Object.create(null);
  }

  typeNameFor(schema, table) {
    // The default schema in postgres is called 'public'. We can
    // conventionally strip that off the type names, while keeping
    // it on for more exotic schemas.

    // json-api uses kebab case but database tables use underscores
    let tableDasherized = kebabCase(table);
    let defaultName;
    if (schema !== 'public') {
      defaultName = `${schema}.${tableDasherized}`;
    } else {
      defaultName = tableDasherized;
    }
    let renamed = this.renameTables[defaultName];
    if (renamed != null) {
      return renamed;
    } else {
      return defaultName;
    }
  }

  tableForType(type) {
    let originalName = Object.keys(this.renameTables).find(k => this.renameTables[k] === type) || type;
    let m = /([^.]+)\.([^.]+)/.exec(originalName);
    if (m) {
      return { schema: m[1], table: snakeCase(m[2]) };
    } else {
      return { schema: 'public', table: snakeCase(originalName) };
    }
  }

  fieldNameFor(schema, table, column) {
    let key = table;
    if (schema !== 'public') {
      key = `${schema}.${table}`;
    }
    let tableSection = this.renameColumns[key];
    if (tableSection) {
      let renamed = tableSection[column];
      if (renamed) {
        return renamed;
      }
    }
    return kebabCase(column);
  }

  columnNameFor(schema, table, fieldName) {
    let key = table;
    if (schema !== 'public') {
      key = `${schema}.${table}`;
    }
    let remappedColumns = this.renameColumns[key];
    if (remappedColumns) {
      let renamed = Object.keys(remappedColumns).find(k => remappedColumns[k] === fieldName);
      if (renamed) {
        return renamed;
      }
    }
    return snakeCase(fieldName);
  }

};
