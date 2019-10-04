import { click, find, triggerEvent, fillIn, visit, waitFor } from '@ember/test-helpers';

export async function setCardId(id) {
  await fillIn('#card__id', id);
  await triggerEvent('#card__id', 'keyup');
}

export async function createCards(args) {
  for (let id of Object.keys(args)) {
    await visit('/cards/new');
    await setCardId(id);
    for (let [name, type, neededWhenEmbedded] of args[id]) {
      await addField(name, type, neededWhenEmbedded);
    }
    await click('[data-test-card-creator-save-btn]');
    await waitFor(`[data-test-card-view="${id}"]`);

    await visit(`/cards/${id}/edit`);
    for (let [name, , , value] of args[id]) {
      if (value == null) { continue; }
      await setFieldValue(name, value);
    }
    await click('[data-test-card-editor-save-btn]');
    await waitFor(`[data-test-card-view="${id}"]`);
  }
}

export async function addField(name, type, isEmbedded, position) {
  let typeEl = find('#new_field_type');
  typeEl.value = type;
  await triggerEvent(typeEl, 'input');

  await fillIn('#new_field_name', name);

  if (isEmbedded) {
    await click('#new_field_embedded');
  }

  if (position != null) {
    await fillIn('#new_field_pos', position);
  }

  await click('[data-test-field-creator-add-field-btn]');
}

export async function setFieldValue(name, value) {
  let type = find(`[data-test-card-renderer-field="${name}"] [data-test-card-renderer-field-type]`).textContent.trim();
    if (type === '@cardstack/core-types::boolean') {
      if (value) {
        await click(`[data-test-card-renderer-field="${name}"] .field-value-true`);
      } else {
        await click(`[data-test-card-renderer-field="${name}"] .field-value-false`);
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
  await click(`[data-test-card-renderer-field="${name}"] [data-test-card-renderer-remove-btn]`);
}