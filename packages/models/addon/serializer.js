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
  }
});
