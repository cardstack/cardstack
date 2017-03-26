import Ember from 'ember';
import layout from '../../templates/components/field-editors/string-editor';

export default Ember.Component.extend({
  layout,
  disabled: Ember.computed.not('enabled')
});
