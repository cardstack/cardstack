import Ember from 'ember';
import layout from '../templates/components/cs-branch-control';
import { defaultBranch } from '@cardstack/plugin-utils/environment';

export default Ember.Component.extend({
  layout,
  classNames: ['cs-branch-control'],
  classNameBindings: ['enabled'],
  tools: Ember.inject.service('cardstack-tools'),

  enabled: Ember.computed('tools.branch', function() {
    return !!this.get('tools.branch');
  }),

  previewing: Ember.computed('enabled', 'tools.branch', function() {
    return this.get('enabled') && defaultBranch !== this.get('tools.branch');
  }),

  actions: {
    goLive() {
      this.get('tools').setBranch(defaultBranch);
    },
    goPreview() {
      this.get('tools').setBranch('draft');
    }
  }
});
