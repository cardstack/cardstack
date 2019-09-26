import { click, find, triggerEvent, fillIn } from '@ember/test-helpers';

export async function setCardId(id) {
  await fillIn('#card__id', id);
  await triggerEvent('#card__id', 'keyup');
}

export async function addField(name, type, isEmbedded, value) {
  let typeEl = find('#new_field_type');
  typeEl.value = type;
  await triggerEvent(typeEl, 'input');

  await fillIn('#new_field_name', name);

  if (isEmbedded) {
    await click('#new_field_embedded');
  }

  if (value != null) {
    if (type === 'boolean') {
      if (value) {
        await click('.card-creator--add-field .field-value-true');
      } else {
        await click('.card-creator--add-field .field-value-false');
      }
    } else if (type === 'related cards' && Array.isArray(value)) {
      await fillIn('#new_field_value', value.join(','));
      await triggerEvent('#new_field_value', 'keyup');
    } else {
      await fillIn('#new_field_value', value);
      await triggerEvent('#new_field_value', 'keyup');
    }
  }

  await click('[data-test-card-creator-add-field-btn]');
}

export async function setFieldValue(name, value) {
  let type = find(`[data-test-card-renderer-field="${name}"] [data-test-card-renderer-field-type]`).textContent.trim();
    if (type === '@cardstack/core-types::boolean') {
      if (value) {
        await click(`[data-test-card-renderer-field="${name}"] .field-value-true`);
      } else {
        await click(`[data-test-card-renderer-field="${name}"] .field-value-false`);
      }
    } else if (type === 'related cards' && Array.isArray(value)) {
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