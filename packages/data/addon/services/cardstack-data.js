import Service from '@ember/service';
import { inject } from '@ember/service';
import { camelize } from '@ember/string';
import { singularize, pluralize } from 'ember-inflector';
import DS from 'ember-data';

const noFields = '___no-fields___';

export default Service.extend({
  store: inject(),

  init() {
    this._super();
    this._loadedRecordsCache = {};
    this._contentTypeCache = {};
  },

  async load(type, id, format) {
    let store = this.get('store');
    let contentType = await this._getContentType(type);
    let fieldset = contentType.get(`fieldsets.${format}`);

    if (!fieldset) {
      return await store.findRecord(singularize(type), id);
    }

    let include = fieldset.map(i => i.field).join(',') || noFields; // note that ember data ignores an empty string includes, so setting to nonsense field
    let record = await store.findRecord(type, id, { include });

    await this._loadRelatedRecords(record, format);
  },

  // caching the content types to more efficiently deal with parallel content type lookups
  async _getContentType(type) {
    if (this._contentTypeCache[type]) {
      return await this._contentTypeCache[type];
    }

    this._contentTypeCache[type] = await this.get('store').findRecord('content-type', pluralize(type));
    return await this._contentTypeCache[type];
  },

  async _loadRelatedRecords(record, format) {
    if (!record || !record.get('type')) { return; }

    let contentType = await this._getContentType(record.get('type'));
    let fieldset = contentType.get(`fieldsets.${format}`);

    if (!fieldset || !fieldset.length) { return; } // record is already loaded, you are all done

    let recordLoadPromises = [];
    for (let fieldItem of fieldset) {
      let fieldRecord = await record.get(camelize(fieldItem.field));
      if (!fieldRecord) { continue; }

      if (fieldRecord instanceof DS.ManyArray) {
        for (let fieldRecordItem of fieldRecord.toArray()) {
          recordLoadPromises.push(this._recurseRecord(fieldRecordItem, fieldItem.format));
        }
      } else {
        recordLoadPromises.push(this._recurseRecord(fieldRecord, fieldItem.format));
      }
    }

    await Promise.all(recordLoadPromises);
  },

  async _recurseRecord(record, format) {
    let loadedRecord = await this._loadRecord(record.get('type'), record.id, format);
    if (!loadedRecord) { return; }
    await this._loadRelatedRecords(loadedRecord, format);
  },

  async _loadRecord(type, id, format) {
    let store = this.get('store');
    let fieldRecordType = await this._getContentType(type);
    let fieldset = fieldRecordType.get(`fieldsets.${format}`);

    if (!fieldset) { return; }

    let include = fieldset.map(i => i.field).join(',') || noFields; // note that ember data ignores an empty string includes, so setting to nonsense field
    let cacheKey = `${type}/${id}:${include}`;

    if (this._loadedRecordsCache[cacheKey]) {
      await this._loadedRecordsCache[cacheKey];
      return; // no need to process any further, as it has this record already been loaded into the store
    }

    // we need to specify `reload` in order to allow the included resources to be added to the store.
    // otherwise, if the primary resource is already in the store, ember data is skipping adding the
    // included resources into the store.
    this._loadedRecordsCache[cacheKey] = store.findRecord(type, id, { include, reload: true });

    return await this._loadedRecordsCache[cacheKey];
  }
});