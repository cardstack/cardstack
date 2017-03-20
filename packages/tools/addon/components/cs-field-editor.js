import Ember from 'ember';
import layout from '../templates/components/cs-field-editor';

export default Ember.Component.extend({
  layout,
  specificComponent: Ember.computed('content', 'field', function() {
    let meta = this.get('content').constructor.metaForProperty(this.get('field'));
    // meta.options.fieldType is our convention for annotating
    // models. meta.type is the name of the transform that ember-data
    // is using, which we keep as a fallback.
    let type = (meta.options && meta.options.fieldType) || meta.type;
    return `field-editors/${type}-editor`;
  })
});
