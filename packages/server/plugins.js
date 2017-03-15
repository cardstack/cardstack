/*
  This module is scaffolding until we have a safe and dynamic plugin
  loader.

  Things a plugin will need to be able to provide:

   - ember components, helpers, models, etc. Like any other ember-addon.

   - Constraint implementations

   - Field implementations

   - base content (which necessarily includes both meta content (like
     content-types, fields, grants, etc) and content (like a welcome
     Post or default first User). These need to be layered beneath the
     user's own content, so they're overridable.

   - data-source implementations, which are compromised any of Writer,
     Indexer, and Searcher.

   - server endpoint implementations. These will have access to some
     curated set of public API involving the configured searcher and
     writers, etc.

   - authentication providers, which is

        - a function that maps from a token to { userRef, groupRefs
        }. Where by ref I mean { type, id}.

        - an ember service (API TBD) that exposes userRef to the app.

     An authentication provider can also be packaged with things like
     server endpoints (for issuing tokens) and content types (like a
     base user model and its fields) for a more complete experience.

*/

const denodeify = require('denodeify');
const fs = require('fs');
const path = require('path');
const readdir = denodeify(fs.readdir);

module.exports = class Plugins {
  static async load(/* configModels */) {
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
  writer(name) {
    // for now, only this one
    if (name === 'git') {
      return require('@cardstack/git/writer');
    }
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
