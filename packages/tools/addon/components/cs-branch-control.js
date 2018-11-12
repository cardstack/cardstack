import { computed } from '@ember/object';
import { inject as service } from '@ember/service';
import Component from '@ember/component';
import layout from '../templates/components/cs-branch-control';
import { defaultBranch } from '@cardstack/plugin-utils/environment';

export default Component.extend({
  layout,
  classNames: ['cs-branch-control'],
  classNameBindings: ['enabled'],
  tools: service('cardstack-tools'),

  enabled: computed('tools.branch', function() {
    return !!this.get('tools.branch');
  }),

  previewing: computed('enabled', 'tools.branch', function() {
    return this.get('enabled') && defaultBranch !== this.get('tools.branch');
  }),

  actions: {
    goLive() {
      this.get('tools').setBranch(defaultBranch);
    },
    goPreview() {
      this.get('tools').setBranch('draft');
    },
  },
});
