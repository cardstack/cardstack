import Ember from 'ember';
import layout from '../templates/components/cardstack-content';
//import { componentNodes } from 'cardstack-suite/ember-private-api';
const { guidFor } = Ember;

export default Ember.Component.extend({
  layout,
  format: 'card',
  tools: Ember.inject.service('cardstack-tools'),

  didRender() {
    let content = this.get('content');
    let format = this.get('format');
    //let { firstNode, lastNode } = componentNodes(this);
    this.get('tools').registerContent(guidFor(this), {
      id: `${guidFor(content)}/${format}`,
      content,
      format
   // firstNode,
   // lastNode
    });
  },

  willDestroyElement() {
    this.get('tools').unregisterContent(guidFor(this));
  },

  specificComponent: Ember.computed('content', 'format', function() {
    let type = this.get('content.constructor.modelName');
    let format = this.get('format');
    return `cardstack/${type}-${format}`;
  })
});
