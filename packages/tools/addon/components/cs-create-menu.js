import { getOwner } from '@ember/application';
import { computed } from '@ember/object';
import { inject as service } from '@ember/service';
import Component from '@ember/component';
import layout from '../templates/components/cs-create-menu';
import { transitionTo } from '../private-api';
import { task } from 'ember-concurrency';
import injectOptional from 'ember-inject-optional';

export default Component.extend({
  layout,
  classNames: ['cs-create-menu'],
  tools: service('cardstack-tools'),
  store: service(),
  cardstackRouting: injectOptional.service(),

  availableTypes: computed(function() {
    return [];
  }),

  loadAvailableTypes: task(function*() {
    let creatableTypes = this.get('tools.creatableTypes');
    if (!creatableTypes || !creatableTypes.length) {
      return;
    }

    let types = yield this.get('store').query('content-type', {
      page: { size: 50 },
      filter: { id: { exact: creatableTypes } },
    });
    this.set('availableTypes', types);
  }).on('init'),

  actions: {
    create(which) {
      let { name, params, queryParams } = this.get('cardstackRouting').routeForNew(which.id, this.get('tools.branch'));
      transitionTo(getOwner(this), name, params.map(p => p[1]), queryParams);
      this.get('tools').setActivePanel('cs-composition-panel');
      this.get('tools').setEditing(true);
    },
  },
});
