/*
  This module is scaffolding until we have a safe and dynamic plugin
  loader.
*/

const denodeify = require('denodeify');
const fs = require('fs');
const path = require('path');
const readdir = denodeify(fs.readdir);

module.exports = class Plugins {
  static async load() {
    return new this(await this._loadFieldTypes(), await this._loadConstraintTypes());
  }
  static async _loadFieldTypes() {
    let fieldTypes = new Map();
    let files = await readdir(path.dirname(require.resolve('@cardstack/core-field-types')));
    for (let file of files) {
      let m = /(.*)\.js$/.exec(file);
      if (m) {
        fieldTypes.set(m[1], { __cardstack_plugin_load_path: `@cardstack/core-field-types/${m[1]}` });
      }
    }
    return fieldTypes;
  }
  static async _loadConstraintTypes() {
    let constraintTypes = new Map();
    let files = await readdir(path.dirname(require.resolve('@cardstack/core-constraint-types')));
    for (let file of files) {
      let m = /(.*)\.js$/.exec(file);
      if (m) {
        constraintTypes.set(m[1], { __cardstack_plugin_load_path: `@cardstack/core-constraint-types/${m[1]}` });
      }
    }
    return constraintTypes;
  }
  constructor(fieldTypes, constraintTypes) {
    this.fieldTypes = fieldTypes;
    this.constraintTypes = constraintTypes;
  }
  fieldType(name) {
    return this._lookup(name, this.fieldTypes);
  }
  constraintType(name) {
    return this._lookup(name, this.constraintTypes);
  }
  _lookup(name, where) {
    let entry = where.get(name);
    if (!entry) {
      throw new Error(`No such field type ${name}`);
    }
    if (entry.__cardstack_plugin_load_path) {
      let module = require(entry.__cardstack_plugin_load_path);
      where.set(name, module);
      return module;
    } else {
      return entry;
    }
  }
};
