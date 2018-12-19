import { setupRenderingTest } from 'ember-qunit';
import hbs from 'htmlbars-inline-precompile';

import Component from '@ember/component';
import { computed } from '@ember/object';
import { readOnly } from '@ember/object/computed';
import { htmlSafe } from '@ember/string';
import { render, getContext } from '@ember/test-helpers';

import { task } from 'ember-concurrency';
import { pluralize } from 'ember-inflector';

/**
 * This should be used as a replacement for `setupRenderingTest()`
 * and additionally sets up a few other things that help when
 * testing cards.
 */
export function setupCardTest(hooks) {
  setupRenderingTest(hooks);
  setupCardTestComponent(hooks);
  setupURLs(hooks);
}

// This is a workaround for https://github.com/intercom/ember-href-to/issues/94
// We use href-to internally in cardstack-url. So if you want to generate a link
// in a rendering test, you need use this.
export function setupURLs(hooks) {
  hooks.beforeEach(function() {
    this.owner.lookup('router:main').setupRouter()
  })
}

export function findCard(type, id, format='isolated') {
  return getContext().owner.lookup('service:cardstackData').load(type, id, format);
}

export function getSpaceForCard(type, id) {
  return getContext().owner.lookup('service:store').findRecord('space', `/${pluralize(type)}/${id}`);
}

export function renderCard(type, id, format, options = {}) {
  return getSpaceForCard(type, id).then(space => {
    let context = getContext();
    let card = space.get('primaryCard');
    let params = space.get('params');
    context.set('card', card);
    context.set('format', format);
    context.set('params', Object.assign({}, params, options.params || {}));

    if (options.width) {
      context.set('widthStyle', htmlSafe(`width: ${options.width}`));
      return render(hbs`
      <div style="{{widthStyle}}">
        {{cardstack-content event-isolated content=card format=format params=params }}
      </div>`);
    } else {
      return render(hbs`{{cardstack-content event-isolated content=card format=format params=params }}`);
    }
  });
}

/**
 * This sets up a `cardstack-card-test` component that can be use to render
 * cards in the QUnit test fixture:
 *
 * ```js
 * await render(hbs`{{cardstack-card-test "works-detail" 123 format="embedded"}}`);
 * ```
 *
 * The positional parameters are the card name and the ID. The component also
 * supports optional `format` and `params` parameters.
 */
export function setupCardTestComponent(hooks) {
  hooks.beforeEach(function() {
    let CardTestComponent = Component.extend({
      tagName: '',

      // inputs
      type: null,
      id: null,
      format: 'isolated',
      params: null,

      // filled by `getSpaceForCardTask`
      space: null,

      // derived data
      card: readOnly('space.primaryCard'),
      _params: computed('space', 'params', function() {
        Object.assign({}, this.get('space.params'), this.params)
      }),

      getSpaceForCardTask: task(function*() {
        let space = yield getSpaceForCard(this.type, this.id);
        this.set('space', space);
      }).on('didInsertElement').cancelOn('willDestroyElement'),
    });

    CardTestComponent.reopenClass({
      positionalParams: ['type', 'id'],
    });

    this.owner.register('component:cardstack-card-test', CardTestComponent);

    this.owner.register('template:components/cardstack-card-test',
      hbs`{{#if card}}{{cardstack-content event-isolated content=card format=format params=params}}{{/if}}`);
  });
}
