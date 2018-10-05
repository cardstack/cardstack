import Service from '@ember/service';
import { inject } from '@ember/service';
import { camelize } from '@ember/string';
import { defaultBranch } from '@cardstack/plugin-utils/environment';
import { singularize, pluralize } from 'ember-inflector';
import DS from 'ember-data';

const noFields = '___no-fields___';

function getType(record) {
  return record.get('type') || record.constructor.modelName;
}

export default Service.extend({
  store: inject(),

  init() {
    this._super();
    this._loadedRecordsCache = {};
    this._contentTypeCache = {};
  },

  async load(branch, type, id, format, opts={}) {
    branch = branch || defaultBranch;
    let store = this.get('store');
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