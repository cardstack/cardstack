import Ember from 'ember';
import layout from '../templates/components/cs-branch-control';

export default Ember.Component.extend({
  layout,
  classNames: ['cs-branch-control'],
  classNameBindings: ['enabled'],
  tools: Ember.inject.service('cardstack-tools'),
  routing: Ember.inject.service('cardstack-routing'),

  enabled: Ember.computed('tools.branch', function() {
    return !!this.get('tools.branch');
  }),

  previewing: Ember.computed('enabled', 'routing.defaultBranch', 'tools.branch', function() {
    return this.get('enabled') && this.get('routing.defaultBranch') !== this.get('tools.branch');
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
