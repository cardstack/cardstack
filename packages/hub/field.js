const Error = require('@cardstack/plugin-utils/error');

module.exports = class Field {
  constructor(model, plugins, constraints, allGrants, defaultValues, authLog) {
    this.id = model.id;
    this.authLog = authLog;
    if (!model.attributes || !model.attributes['field-type']) {
      throw new Error(`field ${model.id} has no field-type attribute`);
    }
    this.fieldType = model.attributes['field-type'];
    this.searchable = model.attributes.searchable == null ? true : model.attributes.searchable;

    // Default values are modeled as relationships to separate models
    // so that we can distinguish a default value of null from not
    // having a default value.

    this.defaultAtUpdate = this._lookupDefaultValue(model, 'default-at-update', defaultValues);
    this.defaultAtCreate = this._lookupDefaultValue(model, 'default-at-create', defaultValues);

    this.plugin = plugins.lookup('fields', this.fieldType);
    this.isRelationship = this.plugin.isRelationship;

    if (model.relationships && model.relationships.constraints && model.relationships.constraints.data) {
      this.constraints = model.relationships.constraints.data.map(ref => constraints.get(ref.id)).filter(Boolean);
    } else {
      this.constraints = [];
    }

    this.grants = allGrants.filter(g => g.fields == null || g.fields.includes(model.id));
  }

  _lookupDefaultValue(model, relationship, defaultValues) {
    if (model.relationships &&
        model.relationships[relationship] &&
        model.relationships[relationship].data) {
      let valueModelId = model.relationships[relationship].data.id;
      let valueModel = defaultValues.get(valueModelId);
      if (!valueModel) {
        throw new Error(`field ${this.id} refers to missing default value ${valueModelId}`);
      }
      return valueModel;
    }
  }

  _sectionName() {
    // only these two fields are hard-coded to be allowed at the top level of the document
    if (this.id === 'type' || this.id === 'id') {
      return 'top';
    }
    return this.isRelationship ? 'relationships' : 'attributes';
  }

  _valueFrom(pendingChange, side='finalDocument') {
    let document = pendingChange[side];
    if (document) {
      let section = this._sectionName();
      if (section === 'top') {
        return document[this.id];
      } else if (document[section]) {
        return document[section][this.id];
      }
    }
  }

  _checkInWrongSection(pendingChange, errors) {
    let sectionName = this.isRelationship ? 'attributes' : 'relationships';
    let section = pendingChange.finalDocument[sectionName];
    if (section && section[this.id]) {
      errors.push(new Error(`field "${this.id}" should be in ${this._sectionName()}, not ${sectionName}`, {
        status: 400,
        source: { pointer: `/data/${sectionName}/${this.id}` }
      }));
    }
  }

  _validateFormat(value, errors) {
    // every field is allowed to be null -- validator plugins only run
    // when a non-null value is present. If you don't want to allow
    // null, you can do that via a constraint instead.
    if (value != null && !this.plugin.valid(value)) {
      errors.push(new Error(`${JSON.stringify(value)} is not a valid value for field "${this.id}"`, {
        status: 400,
        title: "Validation error"
      }));
    }
  }

  async _defaultValueFor(pendingChange /*, context */) {
    let defaultInput;
    if (!pendingChange.originalDocument) {
      // We are creating.
      //   - If there's a creation default, use it.
      //
      //   - Otherwise an update default could apply here.
      //
      //   - Otherwise, "type" is special because we always have an
      //     implicit default type (if we didn't already know the
      //     type, we wouldn't have even gotten to here). Without
      //     this, anyone with a creation grant for a type would also
      //     need a field write grant for "type", which would be
      //     annoyingly redundant.
      //
      //   - Otherwise all fields default to null.
      defaultInput = this.defaultAtCreate || this.defaultAtUpdate || { value: this.id === 'type' ? pendingChange.finalDocument.type : null };
    } else {
      defaultInput = this.defaultAtUpdate;
    }

    if (defaultInput) {
      // A default was set. Now we run it through the plugin
      // implementation, if there is one.
      if (defaultInput.value != null && typeof this.plugin.generateDefault === 'function') {
        return { value: await this.plugin.generateDefault(defaultInput.value) };
      } else {
        return defaultInput;
      }
    }
  }

  async applyDefault(pendingChange,  context) {
    let defaultValue = await this._defaultValueFor(pendingChange, context);
    if (defaultValue) {
      pendingChange.serverProvidedValues.set(this.id,defaultValue.value);
      if (!pendingChange.originalDocument) {
        if (this._valueFrom(pendingChange, 'finalDocument') !== undefined) {
          // The user provided a value at creation, so defaults do not
          // apply.
          return;
        }
      } else {
        let newValue = this._valueFrom(pendingChange, 'finalDocument');
        let oldValue = this._valueFrom(pendingChange, 'originalDocument');
        if (newValue !== oldValue) {
          // The user is altering this value, so defaults do not apply.
          return;
        }
      }

      let section = this._sectionName();
      if (section === 'top') {
        pendingChange.finalDocument[this.id] = defaultValue.value;
      } else {
        if (!pendingChange.finalDocument[section]) {
          pendingChange.finalDocument[section] = {};
        }
        pendingChange.finalDocument[section][this.id] = defaultValue.value;
      }
    }
  }

  async validationErrors(pendingChange, context) {
    let value = this._valueFrom(pendingChange, 'finalDocument');
    let grant;

    if (pendingChange.serverProvidedValues.has(this.id) && pendingChange.serverProvidedValues.get(this.id) === value) {
      this.authLog.debug("approved field write for %s because it matches server provided default", this.id);
    } else if (pendingChange.originalDocument && value === this._valueFrom(pendingChange, 'originalDocument')) {
      this.authLog.debug("approved field write for %s because it was unchanged", this.id);
    } else if ((grant = this.grants.find(g => g['may-write-field'] && g.matches(pendingChange, context)))) {
      this.authLog.debug("approved field write for %s because of grant %s", this.id, grant.id);
    } else {
      // Denied
      this.authLog.debug("denied field write for %s", this.id);
      return [new Error(`You may not write field "${this.id}"`, {
        status: 401
      })];
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
    let m = {
      [this.id]: Object.assign({}, this.plugin.defaultMapping())
    };

    if (!this.searchable) {
      if (m[this.id].type === 'object') {
        m[this.id].enabled = false;
      } else {
        m[this.id].index = false;
      }
    }

    if (this.plugin.derivedMappings) {
      Object.assign(m, this.plugin.derivedMappings(this.id));
    }
    return m;
  }
  get sortFieldName() {
    if (this.plugin.sortFieldName) {
      return this.plugin.sortFieldName(this.id);
    } else {
      return this.id;
    }
  }
  get queryFieldName() {
    if (this.plugin.queryFieldName) {
      return this.plugin.queryFieldName(this.id);
    } else {
      return this.id;
    }
  }

  derivedFields(value) {
    if (this.plugin.derivedFields) {
      return this.plugin.derivedFields(this.id, value);
    }
  }

};
