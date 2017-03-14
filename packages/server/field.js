const Error = require('@cardstack/data-source/error');

module.exports = class Field {
  constructor(model, plugins, constraints, allGrants) {
    this.id = model.id;
    this.fieldType = model.attributes['field-type'];
    this.searchable = model.attributes.searchable;
    this.defaultAtUpdate = model.attributes['default-at-update'];
    this.defaultAtCreate = model.attributes['default-at-create'];
    this.plugin = plugins.fieldType(this.fieldType);
    this.isRelationship = this.plugin.isRelationship;

    if (model.relationships && model.relationships.constraints && model.relationships.constraints.data) {
      this.constraints = model.relationships.constraints.data.map(ref => constraints.get(ref.id)).filter(Boolean);
    } else {
      this.constraints = [];
    }

    this.grants = allGrants.filter(g => g.fields == null || g.fields.includes(model.id));
  }

  _valueFrom(pendingChange, side='finalDocument') {
    let document = pendingChange[side];
    if (document) {
      let section = this.isRelationship ? 'relationships' : 'attributes';
      if (document[section]) {
        return document[section][this.id];
      }
    }
  }

  _checkInWrongSection(pendingChange, errors) {
    let sectionName = this.isRelationship ? 'attributes' : 'relationships';
    let section = pendingChange.finalDocument[sectionName];
    if (section && section[this.id]) {
      let correctSectionName = this.isRelationship ? 'relationships' : 'attributes';
      errors.push(new Error(`field "${this.id}" should be in ${correctSectionName}, not ${sectionName}`, {
        status: 400,
        source: { pointer: `/data/${sectionName}/${this.id}` }
      }));
    }
  }

  _validateFormat(value, errors) {
    if (value != null && !this.plugin.valid(value)) {
      errors.push(new Error(`${JSON.stringify(value)} is not a valid value for field "${this.id}"`, {
        status: 400,
        title: "Validation error"
      }));
    }
  }

  async applyDefault(pendingChange) {
    let defaultInput;
    if (!pendingChange.originalDocument) {
      // Creation

      if (this._valueFrom(pendingChange, 'finalDocument') != null) {
        // The user provided a value at creation, so defaults do not
        // apply.
        return;
      }

      // if there's a creation default, use it. Otherwise an
      // update default could apply here.
      if (this.defaultAtCreate != null) {
        defaultInput = this.defaultAtCreate;
      } else {
        defaultInput = this.defaultAtUpdate;
      }
    } else {
      if (this._valueFrom(pendingChange, 'finalDocument') !== this._valueFrom(pendingChange, 'originalDocument')) {
        // The user is altering this value, so defaults do not apply.
        return;
      }
      defaultInput = this.defaultAtUpdate;
    }

    if (defaultInput != null) {
      // A default was set. Now we run it through the plugin
      // implementation, if there is one.
      let defaultValue;
      if (typeof this.plugin.generateDefault === 'function') {
        defaultValue = this.plugin.generateDefault(defaultInput);
      } else {
        defaultValue = defaultInput;
      }

      // And then set it.
      pendingChange.serverProvidedValues[this.id] = defaultValue;
      if (this.isRelationship) {
        pendingChange.finalDocument.relationships[this.id] = defaultValue;
      } else {
        pendingChange.finalDocument.attributes[this.id] = defaultValue;
      }
    }
  }

  async validationErrors(pendingChange, context) {
    let oldValue = this._valueFrom(pendingChange, 'originalDocument');
    let value = this._valueFrom(pendingChange, 'finalDocument');

    if (oldValue !== value) {
      if (!this.grants.find(g => g['may-write-field'] && g.matches(null, context))) {
        return [new Error(`You may not write field "${this.id}"`, {
          status: 401
        })];
      }
    }

    let errors = [];
    this._checkInWrongSection(pendingChange, errors);
    this._validateFormat(value, errors);
    if (errors.length > 0) {
      return errors;
    }

    // We got through our own validations, so run all the constraints.

    return (await Promise.all(this.constraints.map(constraint => constraint.validationErrors(value)))).reduce(
      (a,b) => a.concat(b), []
    ).map(
      message => new Error(`the value of field "${this.id}" ${message}`, {
        title: "Validation error",
        status: 400
      })
    );
  }
  mapping() {
    return Object.assign({}, this.plugin.defaultMapping(), {
      index: this.searchable
    });
  }
  get sortFieldName() {
    if (this.plugin.sortFieldName) {
      return this.plugin.sortFieldName(this.id);
    } else {
      return this.id;
    }
  }
};
