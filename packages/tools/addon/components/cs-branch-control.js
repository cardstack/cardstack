import { computed } from '@ember/object';
import { inject as service } from '@ember/service';
import Component from '@ember/component';
import layout from '../templates/components/cs-branch-control';
import { defaultBranch } from '@cardstack/plugin-utils/environment';
import qs from 'qs';

export default Component.extend({
  layout,
  defaultBranch,
  classNames: ['cs-branch-control'],
  tools: service('cardstack-tools'),

  branch: computed({
    get() {
      const search = qs.parse(location.search.replace(/^\?/, ''));

      return search.branch || defaultBranch;
    },
    set(key, value) {
      const search = qs.parse(location.search.replace(/^\?/, ''));
      if (value === defaultBranch) {
        delete search.branch;
      } else {
        search.branch = value;
      }

      location.search = qs.stringify(search);
    }
  })
});
