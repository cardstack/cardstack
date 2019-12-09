import DS from 'ember-data';
import SerializerMixin from 'ember-resource-metadata/serializer-mixin';
import { get } from 'lodash';

export default DS.JSONAPISerializer.extend(SerializerMixin, {
  normalize(typeClass, hash) {
    let selfLink;
    if ((selfLink = get(hash, 'links.self'))) {
      hash.attributes = hash.attributes || {};
      hash.attributes['self-link'] = selfLink;
    }

    return this._super.apply(this, arguments);
  },

  normalizeCreateRecordResponse(store, primaryModelClass, payload) {
    let selfLink;
    if ((selfLink = get(payload, 'data.links.self'))) {
      payload.data.attributes = payload.data.attributes || {};
      payload.data.attributes['self-link'] = selfLink;
    }
    return this._super.apply(this, arguments);
  },

  serialize() {
    let json = this._super(...arguments);
    if (get(json, 'data.attributes')) {
      delete json.data.attributes['self-link'];
    }
    return json;
  },
});
