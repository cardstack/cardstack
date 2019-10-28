import { click, find, triggerEvent, fillIn, visit, waitFor, pauseTest } from '@ember/test-helpers';

const timeout = 5000;

export async function setCardId(id) {
  await fillIn('#card__id', id);
  await triggerEvent('#card__id', 'keyup');
}

export async function dragAndDropField(type, position = 0) {
  await triggerEvent(`[data-test-card-add-field-draggable="${type}"]`, 'mousedown');
  await triggerEvent(`[data-test-card-add-field-drop-zone="${position}"]`, 'drop');
}

export async function createCards(args) {
  for (let id of Object.keys(args)) {
    await visit('/cards/new');
    await setCardId(id);
    for (let [index, [name, type, neededWhenEmbedded]] of args[id].entries()) {
      await addField(name, type, neededWhenEmbedded, index);
    }
    await click('[data-test-card-creator-save-btn]');
    await waitFor(`[data-test-card-view="${id}"]`, { timeout });

    await visit(`/cards/${id}/edit`);
    for (let [name, , , value] of args[id]) {
      if (value == null) { continue; }
      await setFieldValue(name, value);
    }
    await click('[data-test-card-editor-save-btn]');
    await waitFor(`[data-test-card-view="${id}"]`, { timeout });
  }
}

export async function addField(name, type, isEmbedded, position) {
  await dragAndDropField(type, position);

  await fillIn('[data-test-field-name]', name);
  await triggerEvent('[data-test-field-name]', 'keyup');

  if (isEmbedded) {
    await click(`[data-test-right-edge] [data-test-needed-when-embedded]`);
  }
}

export async function setFieldValue(name, value) {
  let type = find(`[data-test-field="${name}"]`).getAttribute('data-test-field-type');
  if (type === '@cardstack/core-types::boolean') {
    if (value) {
      await click(`[data-test-field="${name}"] .cardstack-core-types-field-value-true`);
    } else {
      await click(`[data-test-field="${name}"] .cardstack-core-types-field-value-false`);
    }
  } else if (type === '@cardstack/core-types::has-many' && Array.isArray(value)) {
    await fillIn(`#edit-${name}-field-value`, value.join(','));
    await triggerEvent(`#edit-${name}-field-value`, 'keyup');
  } else {
    await fillIn(`#edit-${name}-field-value`, value);
    await triggerEvent(`#edit-${name}-field-value`, 'keyup');
  }
}

export async function removeField(name) {
  await click(`[data-test-field="${name}"] [data-test-field-renderer-remove-btn]`);
}