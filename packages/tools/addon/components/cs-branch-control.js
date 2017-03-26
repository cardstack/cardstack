import Ember from 'ember';
import layout from '../templates/components/cs-branch-control';

export default Ember.Component.extend({
  layout,
  classNames: ['cs-branch-control'],
  tools: Ember.inject.service('cardstack-tools'),
  routing: Ember.inject.service('cardstack-routing'),

  live: Ember.computed('routing.defaultBranch', 'tools.branch', function() {
    return this.get('routing.defaultBranch') === this.get('tools.branch');
  }),

  actions: {
    goLive() {
      this.get('tools').setBranch(this.get('routing.defaultBranch'));
    },
    goPreview() {
      this.get('tools').setBranch('draft');
    }
  }
});
