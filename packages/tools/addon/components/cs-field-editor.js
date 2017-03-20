import Ember from 'ember';
import layout from '../templates/components/cs-field-editor';

export default Ember.Component.extend({
  layout,
  specificComponent: Ember.computed('content', 'field', function() {
    let meta = this.get('content').constructor.metaForProperty(this.get('field'));
    // meta.options.fieldType is our convention for annotating
    // models. meta.type is the name of the transform that ember-data
    // is using, which we keep as a fallback.
    let type = meta.options && meta.options.fieldType;

    if (!type && meta.type) {
      // lift the default ember-data transform names into our core
      // types
      type = `@cardstack/core-types::${meta.type}`;
    }

    type = this._stripNamespace(type);
    return `field-editors/${type}-editor`;
  }),

  _stripNamespace(type) {
    // Right now the actual field editor components get flattened down
    // out of their namespaces, so we throw away everything but the
    // last bit of their names here. This problem is easier to solve
    // once I can integrate a module-unification resolver, so I'm
    // leaving it like this for now.
    let parts = type.split(/[/:]/g);
    return parts[parts.length - 1];
  }

});
