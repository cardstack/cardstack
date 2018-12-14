import { computed } from '@ember/object';
import { inject as service } from '@ember/service';
import Component from '@ember/component';
import { task } from 'ember-concurrency';
import layout from '../templates/components/cs-branch-control';
import { defaultBranch } from '@cardstack/plugin-utils/environment';
import qs from 'qs';

export default Component.extend({
  layout,
  defaultBranch,
  classNames: ['cs-branch-control'],
  tools: service('cardstack-tools'),
  data: service('cardstack-data'),

  'data-test-branch-control': true,
  'data-test-branch-control-branch-count': computed('branches', function() {
    return this.get('branches.length');
  }),

  willInsertElement() {
    this._super(...arguments);
    this.get('fetchBranches').perform();
  },

  fetchBranches: task(function * () {
    // checking if the branches() fucntion is available on this version of the data service
    if((typeof this.get('data').branches) === 'function') {
      let branches = yield this.get('data').branches();
      this.set('branches', branches);
    }
  }),

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
