import Ember from 'ember';
import layout from '../templates/components/cs-view-mode-buttons';

export default Ember.Component.extend({
  layout,
  tagName: '',
  modes: [
    {
      mode: 'page',
      icon: 'page',
      iconWidth: 18,
      description: 'Page'
    },
    {
      mode: 'tiles',
      icon: 'tiles',
      iconWidth: 20,
      description: 'Tile'
    }
  ]
});
