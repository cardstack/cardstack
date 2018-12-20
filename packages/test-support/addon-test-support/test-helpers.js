import { setupRenderingTest } from 'ember-qunit';
import hbs from 'htmlbars-inline-precompile';

import { deprecate } from '@ember/application/deprecations';
import Component from '@ember/component';
import { computed } from '@ember/object';
import { readOnly } from '@ember/object/computed';
import { htmlSafe, camelize } from '@ember/string';
import { render, getContext, settled, find, click, fillIn } from '@ember/test-helpers';

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

/**
 * Allows access to the `cardstack-tools` service during tests.
 *
 * Examples:
 *
 * ```js
 * assert.strictEqual(getTools().active, true);
 * getTools().setActive(false);
 * ```
 */
export function getTools() {
  return getContext().owner.lookup('service:cardstack-tools');
}

/**
 * Opens the tools, if available.
 */
export async function openTools() {
  let tools = getTools();

  if (!tools.available) {
    throw new Error('The editor tools are not available.');
  }

  tools.setActive(true);

  await settled();
}

/**
 * Closes the tools.
 */
export async function closeTools() {
  let tools = getTools();

  tools.setActive(false);

  await settled();
}

export function findCard(type, id, format='isolated') {
  return getContext().owner.lookup('service:cardstackData').load(type, id, format);
}

export function getSpaceForCard(type, id) {
  return getContext().owner.lookup('service:store').findRecord('space', `/${pluralize(type)}/${id}`);
}

export function renderCard(type, id, format, options = {}) {
  let deprecation_message = `\`renderCard()\` was deprecated in favor using the regular \`render()\` test helper with the \`cardstack-card-test\` component:

    await render(hbs\`{{cardstack-card-test "${type}" "${id}" format="${format}"}}\`);

When using the above code make sure to use the \`setupCardTest(hooks)\` test helper, instead of \`setupRenderingTest(hooks)\``;

  deprecate(deprecation_message, false, {
    id: '@cardstack-test-support-render-card',
    until: '0.13.0',
  });

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
        {{cardstack-content content=card format=format params=params }}
      </div>`);
    } else {
      return render(hbs`{{cardstack-content content=card format=format params=params }}`);
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
      hbs`{{#if card}}{{cardstack-content content=card format=format params=params}}{{/if}}`);
  });
}

function getFieldEditorSectionElement(name) {
  return find(`[data-test-field-name="${camelize(name)}"]`);
}

/**
 * Returns whether an editor for a field with the given name exists.
 */
export function hasFieldEditor(name) {
  return Boolean(getFieldEditorSectionElement(name));
}

/**
 * Fills out the editor for the given field name with the supplied value.
 *
 * This currently only supports the core types: string, integer, date and boolean.
 */
export async function fillInFieldEditor(name, value) {
  let editorSection = getFieldEditorSectionElement(name);
  if (!editorSection) {
    throw new Error(`Could not find editor section for field "${name}".`);
  }

  if (editorSection.classList.contains('closed')) {
    await click(editorSection.querySelector(`header`));
  }

  if (typeof value === 'boolean') {
    let toggle = editorSection.querySelector(`.cs-field-editor-section .cs-toggle-switch`);
    if (!toggle) {
      throw new Error(`Could not find toggle element in editor section for field "${name}".`);
    }

    let slider = toggle.querySelector('.slider');
    if (!slider) {
      throw new Error(`Could not find slider element in editor section for field "${name}".`);
    }

    let isEnabled = slider.classList.contains('slider-right');
    if ((isEnabled && value === false) || (!isEnabled && value === true)) {
      await click(slider);
    }

  } else {
    let input = editorSection.querySelector(`.cs-field-editor-section input`);
    if (!input) {
      throw new Error(`Could not find input element in editor section for field "${name}".`);
    }

    await fillIn(input, value);
  }
}

export async function saveEdits() {
  let button = find('[data-test-cs-version-control-button-save]');
  if (!button) {
    throw new Error('Could not find save button. Did you open the tools?');
  }
  if (button.disabled) {
    throw new Error('Could not save the edits because the save button is disabled.');
  }

  await click(button);
}

export async function cancelEdits() {
  let button = find('[data-test-cs-version-control-button-cancel]');
  if (!button) {
    throw new Error('Could not find cancel button. Did you open the tools?');
  }

  await click(button);
}
