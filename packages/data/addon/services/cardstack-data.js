import Service from '@ember/service';
import { inject } from '@ember/service';
import injectOptional from 'ember-inject-optional';
import { camelize } from '@ember/string';
import { defaultBranch } from '@cardstack/plugin-utils/environment';
import { singularize, pluralize } from 'ember-inflector';
import { hubURL } from '@cardstack/plugin-utils/environment';
import { get } from '@ember/object';
import fetch from 'fetch';
import DS from 'ember-data';

const noFields = '___no-fields___';

function getType(record) {
  return record.get('type') || record.constructor.modelName;
}

export default Service.extend({
  store: inject(),
  session: injectOptional.service(),

  init() {
    this._super();
    this._loadedRecordsCache = {};
    this._contentTypeCache = {};
  },

  async load(type, id, format, opts={}) {
    let store = this.get('store');
    let branch = opts.branch || defaultBranch;
    let contentType = await this._getContentType(type);
    let fieldset = contentType.get(`fieldsets.${format}`);
    let _opts = Object.assign({ branch }, opts);

    if (!fieldset) {
      return await store.findRecord(singularize(type), id, _opts);
    }

    let include = fieldset.map(i => i.field).join(',') || noFields; // note that ember data ignores an empty string includes, so setting to nonsense field
    _opts.include = include;
    let record = await store.findRecord(type, id, _opts);

    await this._loadRelatedRecords(branch, record, format);

    return record;
  },

  async query(type, format, opts={}) {
    let store = this.get('store');
    let branch = opts.branch || defaultBranch;
    let _opts = Object.assign({ branch, modelName: type }, opts);

    let result = await store.query(type, _opts);

    let recordLoadPromises = [];
    for (let record of result.toArray()) {
      recordLoadPromises.push(this.load(getType(record), record.id, format, { branch, reload: true }));
    }

    await Promise.all(recordLoadPromises);

    return result;
  },

  async queryCard(type, format, opts={}) {
    let card;
    let result = await this.query(type, format, opts);
    if (result && (card = result.toArray()) && card) {
      return card[0];
    }
  },

  async validate(model) {
    let relatedOwned = [];
    let relationships = get(model.constructor, 'relationshipsByName') || [];
    relationships.forEach((relationshipDef) => {
      let { name, kind, meta } = relationshipDef;
      if (meta) {
        let { owned } = meta.options;
        if (owned) {
          let related = model.get(name);
          if (kind === 'belongsTo' ) {
            relatedOwned.push(related);
          } else {
            relatedOwned.push(...related.toArray());
          }
        }
      }
    });

    let toValidate = [model, ...relatedOwned];
    let responses = toValidate.map(async (record) => {
      let { url, verb } = this._validationRequestParams(record);
      let response = await fetch(url, {
        method: verb,
        headers: this._headers(),
        body: JSON.stringify(record.serialize())
      });
      let { status } = response;
      if (status === 422) {
        return response.json();
      }
    });

    let json = await Promise.all(responses);
    return json.reduce((mergedErrors, body) => {
      if (!body) {
        return mergedErrors;
      }
      return Object.assign(mergedErrors, this._errorsByField(body));
    }, {});
  },

  async fetchPermissionsFor(model) {
    let modelName = pluralize(getType(model));
    let permissionsPath;
    if (model.id) {
      permissionsPath = encodeURIComponent(`${modelName}/${model.id}`);
    } else {
      permissionsPath = encodeURIComponent(modelName);
    }
    let url = `${hubURL}/api/permissions/${permissionsPath}`;
    let response = await fetch(url, {
      headers: this._headers()
    });
    let { data } = await response.json();
    let { attributes, relationships } = data;
    return {
      mayUpdateResource: attributes['may-update-resource'],
      writableFields: relationships['writable-fields'].data
        .map((field) => camelize(field.id))
    }
  },

  _headers() {
    let headers = {
      'Content-Type': 'application/vnd.api+json',
    };
    let token = this._sessionToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
  },

  _sessionToken() {
    return this.get('session.data.authenticated.data.meta.token');
  },

  _errorsByField(body) {
    return body.errors.reduce((errorsByField, error) => {
      let { detail: errorMessage, source } = error;
      let match = new RegExp('/data/attributes/(.+)').exec(source.pointer);
      let fieldName = match[1];
      if (!errorsByField[fieldName]) {
        errorsByField[fieldName] = [];
      }
      errorsByField[fieldName].push(errorMessage);
      return errorsByField;
    }, {});
  },

  _validationRequestParams(model) {
    let type = getType(model);
    let url = `${hubURL}/api-validate/${pluralize(type)}`;
    let verb;
    if (model.get('isNew')) {
      verb = 'POST';
    } else {
      url += `/${model.id}`;
      verb = 'PATCH';
    }
    return { url, verb };
  },

  // caching the content types to more efficiently deal with parallel content type lookups
  async _getContentType(type) {
    if (this._contentTypeCache[type]) {
      return await this._contentTypeCache[type];
    }

    this._contentTypeCache[type] = this.get('store').findRecord('content-type', pluralize(type));
    return await this._contentTypeCache[type];
  },

  async _loadRelatedRecords(branch, record, format) {
    if (!record || !getType(record)) { return; }

    let contentType = await this._getContentType(getType(record));
    let fieldset = contentType.get(`fieldsets.${format}`);

    if (!fieldset || !fieldset.length) { return; } // record is already loaded, you are all done

    let recordLoadPromises = [];
    for (let fieldItem of fieldset) {
      let fieldRecord = await record.get(camelize(fieldItem.field));
      if (!fieldRecord) { continue; }

      if (fieldRecord instanceof DS.ManyArray) {
        for (let fieldRecordItem of fieldRecord.toArray()) {
          recordLoadPromises.push(this._recurseRecord(branch, fieldRecordItem, fieldItem.format));
        }
      } else {
        recordLoadPromises.push(this._recurseRecord(branch, fieldRecord, fieldItem.format));
      }
    }

    await Promise.all(recordLoadPromises);
  },

  async _recurseRecord(branch, record, format) {
    let loadedRecord = await this._loadRecord(branch, getType(record), record.id, format);
    if (!loadedRecord) { return; }
    await this._loadRelatedRecords(branch, loadedRecord, format);
  },

  async _loadRecord(branch, type, id, format) {
    let store = this.get('store');
    let fieldRecordType = await this._getContentType(type);
    let fieldset = fieldRecordType.get(`fieldsets.${format}`);

    if (!fieldset) { return; }

    let include = fieldset.map(i => i.field).join(',') || noFields; // note that ember data ignores an empty string includes, so setting to nonsense field
    let cacheKey = `${branch}/${type}/${id}:${include}`;

    if (this._loadedRecordsCache[cacheKey]) {
      await this._loadedRecordsCache[cacheKey];
      return; // no need to process any further, as this record has already been loaded into the store
    }

    // we need to specify `reload` in order to allow the included resources to be added to the store.
    // otherwise, if the primary resource is already in the store, ember data is skipping adding the
    // included resources into the store.
    this._loadedRecordsCache[cacheKey] = store.findRecord(type, id, { include, reload: true, branch });

    return await this._loadedRecordsCache[cacheKey];
  }
});
