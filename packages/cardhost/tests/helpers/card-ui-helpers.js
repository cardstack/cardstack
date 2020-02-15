import { click, focus, find, triggerEvent, fillIn, visit, waitFor } from '@ember/test-helpers';
import { animationsSettled } from 'ember-animated/test-support';
import { canonicalURL } from '@cardstack/core/card-id';
import { CARDSTACK_PUBLIC_REALM } from '@cardstack/core/realm';

const timeout = 5000;

export async function showCardId(toggleDetailsSection = false) {
  await focus(`.card-renderer-isolated`);
  await waitFor(`.adopted-card`, { timeout });

  if (toggleDetailsSection) {
    await click('[data-test-right-edge-section-toggle="details"]');
  }

  await animationsSettled();
}

export async function selectField(name) {
  await click(`.isolated-card [data-test-field="${name}"]`);
  await waitFor(`[data-test-field="${name}"][data-test-loaded="true"]`);
}

export async function setCardName(name) {
  await fillIn('#card__name', name);
  await click('[data-test-create-card-btn]');
  await waitFor(`[data-test-card-save-btn]`, { timeout });
}

export async function dragAndDrop(fieldSelector, dropZoneSelector, options) {
  await triggerEvent(fieldSelector, 'mousedown');
  await triggerEvent(fieldSelector, 'dragstart', options);
  await triggerEvent(dropZoneSelector, 'dragenter', options);
  await animationsSettled();
  await triggerEvent(dropZoneSelector, 'drop', options);
  await waitFor(`[data-test-card-patched="true"]`);
  await animationsSettled();
}

export async function dragAndDropNewField(fieldId, position = 0) {
  if (fieldId.indexOf('http') !== 0) {
    fieldId = canonicalURL({ csRealm: CARDSTACK_PUBLIC_REALM, csId: fieldId });
  }
  let options = {
    dataTransfer: {
      getData: key => (key === 'text/cardId' ? fieldId : undefined),
      setData: () => {},
    },
  };
  await dragAndDrop(
    `[data-test-card-add-field-draggable="${fieldId}"]`,
    `[data-test-drop-zone="${position}"]`,
    options
  );
}

// NOTE: Position is 0-based
export async function dragFieldToNewPosition(originalPosition, newPosition) {
  newPosition = originalPosition < newPosition ? newPosition + 1 : newPosition;
  let fieldName;
  let options = {
    dataTransfer: {
      getData: type => {
        if (type === 'text/field-name') {
          return fieldName;
        }
      },
      setData: (type, name) => (fieldName = name),
    },
  };
  await dragAndDrop(
    `[data-test-field-renderer-move-btn-position="${originalPosition}"]`,
    `[data-test-drop-zone="${newPosition}"]`,
    options
  );
}

export async function createCards(args) {
  for (let id of Object.keys(args)) {
    await visit('/');
    await click('[data-test-new-blank-card-btn]');
    await setCardName(id);
    await click('[data-test-configure-schema-btn]');

    for (let [index, [name, type, neededWhenEmbedded]] of args[id].entries()) {
      await addField(name, type, neededWhenEmbedded, index);
    }
    await saveCard();

    await visit(`/cards/${id}/edit/fields`);
    for (let [name, , , value] of args[id]) {
      if (value == null) {
        continue;
      }
      await setFieldValue(name, value);
    }
    await saveCard();
    await visit(`/cards/${id}`);
  }
}

export async function saveCard() {
  await click(`[data-test-card-save-btn]`);
  await waitFor(`[data-test-card-save-btn].saved`, { timeout });
  await animationsSettled();
}

export async function addField(name, fieldId, isEmbedded, position) {
  await dragAndDropNewField(fieldId, position);

  await waitFor(`[data-test-card-fields-ready="true"]`);
  await click(`.isolated-card [data-test-field="field-1"]`);
  await waitFor(`.right-edge [data-test-field="field-1"][data-test-loaded="true"]`);

  await waitFor('[data-test-schema-attr="name"] input', { timeout });
  await fillIn('[data-test-schema-attr="name"] input', name);
  await triggerEvent('[data-test-schema-attr="name"] input', 'keyup');
  await waitFor(`.isolated-card [data-test-field="${name}"][data-test-loaded="true"]`);

  if (isEmbedded) {
    await click('[data-test-schema-attr="embedded"] input[type="checkbox"]');
  }

  await waitFor(`[data-test-card-patched="true"]`);
  await animationsSettled();
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
  await waitFor(`[data-test-card-patched="true"]`);
}

export async function removeField(name) {
  await click(`[data-test-field="${name}"] [data-test-field-renderer-remove-btn]`);
  await waitFor(`[data-test-card-patched="true"]`);
}
