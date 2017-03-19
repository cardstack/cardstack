import Ember from 'ember';
const { guidFor } = Ember;
import layout from '../templates/components/cs-field';
import { componentNodes } from 'cardstack-suite/ember-private-api';
import FieldInfo from 'cardstack-suite/field-info';

export default Ember.Component.extend({
  layout,
  tools: Ember.inject.service('cardstack-tools'),

  didRender() {
    this.get('tools').registerField(guidFor(this), this.fieldInfo());
  },

  willDestroyElement() {
    this.get('tools').unregisterField(guidFor(this));
  },

  fieldInfo() {
    let { firstNode, lastNode } = componentNodes(this);
    return new FieldInfo(
      this.get('content'),
      this.get('fieldName'),
      [this.get('fieldName')],
      firstNode,
      lastNode
    );
  },

  _fields() {
    return [this.get('field')];
  }

}).reopenClass({
  positionalParams: ['content', 'fieldName']
});
