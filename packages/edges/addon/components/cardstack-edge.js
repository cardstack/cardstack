import Component from '@ember/component';
import { computed } from '@ember/object';
import layout from '../templates/components/cardstack-edge';

const Edge = Component.extend({
  layout,
  componentName: computed('edge', function() {
    return `in-${this.get('edge')}-toolbar`;
  })
});

Edge.reopenClass({positionalParams: ['edge', 'componentToShow']})

export default Edge;