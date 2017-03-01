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
    let fieldTypes = new Map();
    let files = await readdir(path.dirname(require.resolve('@cardstack/core-field-types')));
    for (let file of files) {
      let m = /(.*)\.js$/.exec(file);
      if (m) {
        fieldTypes.set(m[1], { __field_type_load_path: `@cardstack/core-field-types/${m[1]}` });
      }
    }
    return new this(fieldTypes);
  }
  constructor(fieldTypes) {
    this.fieldTypes = fieldTypes;
  }
  fieldType(name) {
    let entry = this.fieldTypes.get(name);
    if (!entry) {
      throw new Error(`No such field type ${name}`);
    }
    if (entry.__field_type_load_path) {
      let module = require(entry.__field_type_load_path);
      this.fieldTypes.set(name, module);
      return module;
    } else {
      return entry;
    }
  }
};
