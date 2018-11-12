import hbs from 'htmlbars-inline-precompile';
import { render, getContext } from '@ember/test-helpers';
import { htmlSafe } from '@ember/string';

// This is a workaround for https://github.com/intercom/ember-href-to/issues/94
// We use href-to internally in cardstack-url. So if you want to generate a link
// in a rendering test, you need use this.
export function setupURLs(hooks) {
  hooks.beforeEach(function() {
    this.owner.lookup('router:main').setupRouter();
  });
}

export function findCard(type, id, format = 'isolated') {
  return getContext()
    .owner.lookup('service:cardstackData')
    .load(type, id, format);
}

export function renderCard(type, id, format, options = {}) {
  return findCard(type, id, format).then(card => {
    let context = getContext();
    context.set('card', card);
    context.set('format', format);

    if (options.width) {
      context.set('widthStyle', htmlSafe(`width: ${options.width}`));
      return render(hbs`
      <div style="{{widthStyle}}">
        {{cardstack-content event-isolated content=card format=format }}
      </div>`);
    } else {
      return render(hbs`{{cardstack-content event-isolated content=card format=format }}`);
    }
  });
}
