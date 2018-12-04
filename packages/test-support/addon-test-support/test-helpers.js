import hbs from 'htmlbars-inline-precompile';
import qs from 'qs';
import { render, getContext } from '@ember/test-helpers';
import { htmlSafe } from '@ember/string';
import { pluralize } from 'ember-inflector';

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
    let queryParamsString = space.get('queryParams');
    context.set('card', card);
    context.set('format', format);
    let params = options.params || {};
    if (queryParamsString) {
      params = Object.assign(qs.parse(queryParamsString.replace('?', '')), params);
    }
    context.set('params', params);

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