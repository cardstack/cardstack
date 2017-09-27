const Error = require('@cardstack/plugin-utils/error');
const find = require('../async-find');

module.exports = class Field {
  constructor(model, plugins, allGrants, defaultValues, authLog) {
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

    this.plugin = plugins.lookupFeatureAndAssert('field-types', this.fieldType);
    this.isRelationship = this.plugin.isRelationship;

    if (model.relationships && model.relationships['related-types'] && model.relationships['related-types'].data.length > 0) {
      this.relatedTypes = Object.create(null);
      for (let typeRef of model.relationships['related-types'].data) {
        if (typeRef.type !== 'content-types') {
          throw new Error(`field "${this.id}" has a related type that is not of type "content-types"`, {
            status: 400,
            title: "Non-type in related-types"
          });
        }
        this.relatedTypes[typeRef.id] = true;
      }
    } else {
      this.relatedTypes = null;
    }

    this.grants = allGrants.filter(g => g.fields == null || g.fields.includes(model.id));
    this._mapping = null;
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

  valueFrom(pendingChange, side='finalDocument') {
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

  pointer() {
    let sectionName = this._sectionName();
    if (sectionName === 'top') {
      return `/data/${this.id}`;
    } else {
      return `/data/${sectionName}/${this.id}`;
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
    if (value == null) { return; }

    let result = this.plugin.valid(value, { relatedTypes: this.relatedTypes });
    if (!result) {
      result = `${JSON.stringify(value)} is not a valid value for field "${this.id}"`;
    } else if (typeof result === 'string') {
      result = `field "${this.id}" ${result}`;
    }
    if (typeof result === 'string') {
      errors.push(new Error(result, {
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
      //   - Otherwise ask the field-type plugin it is has a default.
      //
      //   - Otherwise all fields default to null.
      defaultInput = this.defaultAtCreate || this.defaultAtUpdate || { value: this.id === 'type' ? pendingChange.finalDocument.type : (this.plugin.default || null) };
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
        if (this.valueFrom(pendingChange, 'finalDocument') !== undefined) {
          // The user provided a value at creation, so defaults do not
          // apply.
          return;
        }
      } else {
        let newValue = this.valueFrom(pendingChange, 'finalDocument');
        let oldValue = this.valueFrom(pendingChange, 'originalDocument');
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
    let value = this.valueFrom(pendingChange, 'finalDocument');
    let grant;

    if (pendingChange.serverProvidedValues.has(this.id) && pendingChange.serverProvidedValues.get(this.id) === value) {
      this.authLog.debug("approved field write for %s because it matches server provided default", this.id);
    } else if (pendingChange.originalDocument && value === this.valueFrom(pendingChange, 'originalDocument')) {
      this.authLog.debug("approved field write for %s because it was unchanged", this.id);
    } else if ((grant = await find(this.grants, async g => g['may-write-field'] && await g.matches(pendingChange, context)))) {
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
    return errors;
  }
  mapping(allFields) {
    if (this._mapping) {
      return this._mapping;
    }
    let m = {
      [this.id]: Object.assign({}, this.plugin.defaultMapping(allFields))
    };

    if (!this.searchable) {
      if (m[this.id].type === 'object') {
        m[this.id].enabled = false;
      } else {
        m[this.id].index = false;
      }
    }

    if (this.plugin.derivedMappings) {
      Object.assign(m, this.plugin.derivedMappings(this.id, allFields));
    }
    this._mapping = m;
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

  default() {
    return this.plugin.default || null;
  }

  derivedFields(value) {
    if (this.plugin.derivedFields) {
      return this.plugin.derivedFields(this.id, value);
    }
  }

};
