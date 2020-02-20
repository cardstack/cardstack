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

export async function waitForSchemaViewToLoad() {
  await waitFor('[data-test-right-edge]', { timeout });
  await waitForCardLoad();
  await animationsSettled();
}

export async function waitForTemplatesLoad() {
  await waitFor('[data-test-templates-loaded="true"]', { timeout });
  await animationsSettled();
}

export async function waitForFieldToLoadInRightEdge(name) {
  await waitFor(`.right-edge [data-test-field="${name}"][data-test-loaded="true"]`, { timeout });
  await waitFor(`.right-edge[data-test-field-source-loaded="true"]`, { timeout });
  await animationsSettled();
}

export async function waitForFieldOrderUpdate() {
  await waitFor(`[data-test-card-fields-ready="true"]`, { timeout });
  await animationsSettled();
}

export async function waitForCardPatch() {
  await waitFor(`[data-test-card-patched="true"]`, { timeout });
  await animationsSettled();
}

export async function waitForCardLoad() {
  await waitFor(`[data-test-card-loaded="true"]`, { timeout });
  let fields = [...document.querySelectorAll(`[data-test-isolated-card] [data-test-field]`)].map(i =>
    i.getAttribute('data-test-field')
  );
  for (let field of fields) {
    await waitFor(`[data-test-isolated-card] [data-test-field="${field}"][data-test-loaded="true"]`, { timeout });
  }
}

export async function waitForThemerLoad() {
  await waitForCardLoad();
  await waitFor('[data-test-themer-loaded]', { timeout });
  await animationsSettled();
}

export async function waitForCssLoad() {
  await waitFor('[data-test-css-loaded]', { timeout });
  await animationsSettled();
}

export async function waitForEmbeddedCardLoad(cardId) {
  await waitFor(`[data-test-embedded-card="${cardId}"][data-test-embedded-card-loaded="true"]`, { timeout });
  let fields = [...document.querySelectorAll(`[data-test-embedded-card="${cardId}"] [data-test-field]`)].map(i =>
    i.getAttribute('data-test-field')
  );
  for (let field of fields) {
    await waitFor(`[data-test-embedded-card="${cardId}"] [data-test-field="${field}"][data-test-loaded="true"]`, {
      timeout,
    });
  }
}

export async function waitForFieldNameChange(name) {
  await waitFor(`[data-test-isolated-card] [data-test-field="${name}"][data-test-loaded="true"]`, { timeout });
  await waitForCardPatch();
}

export async function selectField(name) {
  await click(`[data-test-isolated-card] [data-test-field="${name}"]`);
  await waitForFieldToLoadInRightEdge(name);
}

export async function setCardName(name) {
  await fillIn('#card__name', name);
  await click('[data-test-create-card-btn]');
  await waitFor(`[data-test-card-save-btn]`, { timeout });

  if (document.querySelector('[data-test-card-name-dialog-is-adopted-card="false"]')) {
    await waitForSchemaViewToLoad();
  }
}

export async function dragAndDrop(fieldSelector, dropZoneSelector, options) {
  await triggerEvent(fieldSelector, 'mousedown');
  await triggerEvent(fieldSelector, 'dragstart', options);
  await triggerEvent(dropZoneSelector, 'dragenter', options);
  await animationsSettled();
  await triggerEvent(dropZoneSelector, 'drop', options);
  await waitForCardPatch();
  await waitForFieldOrderUpdate();
  await animationsSettled();
}

export async function dragAndDropNewField(fieldId, position = 0) {
  await waitFor(`[data-test-catalog-loaded="true"]`, { timeout });
  if (fieldId.indexOf('http') !== 0) {
    fieldId = canonicalURL({ csRealm: CARDSTACK_PUBLIC_REALM, csId: fieldId });
  }
  await click(`[data-test-card-add-field-draggable="${fieldId}"]`);
  await triggerEvent(`[data-test-drop-zone="${position}"]`, 'mouseenter');
  await click(`[data-test-drop-zone="${position}"]`);
  await animationsSettled();
  await waitForCardPatch();
  await waitForFieldOrderUpdate();
  await animationsSettled();
}

// NOTE: Position is 0-based
export async function dragFieldToNewPosition(originalPosition, newPosition) {
  newPosition = originalPosition < newPosition ? newPosition + 1 : newPosition;
  let fieldName;
  let startPosition;
  let options = {
    dataTransfer: {
      getData: key => {
        if (key === 'text/field-name') {
          return fieldName;
        }
        if (key === 'text/start-position') {
          return startPosition;
        }
      },
      setData: (key, value) => {
        if (key === 'text/field-name') {
          fieldName = value;
        }
        if (key === 'text/start-position') {
          startPosition = value;
        }
      },
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
  await waitForCardPatch();
  await click(`[data-test-card-save-btn]`);
  await waitFor(`[data-test-card-save-btn].saved`, { timeout });
  await waitForCardPatch();
  await animationsSettled();
}

export async function addField(name, fieldId, isEmbedded, position) {
  await dragAndDropNewField(fieldId, position);

  await click(`[data-test-isolated-card] [data-test-field="field-1"]`);
  await waitForFieldToLoadInRightEdge('field-1');

  await waitFor('[data-test-schema-attr="name"] input', { timeout });
  await fillIn('[data-test-schema-attr="name"] input', name);
  await triggerEvent('[data-test-schema-attr="name"] input', 'keyup');
  await waitForFieldNameChange(name);

  if (isEmbedded) {
    await click('[data-test-schema-attr="embedded"] input[type="checkbox"]');
  }

  await waitForCardPatch();
  await animationsSettled();
}

export async function setFieldValue(name, value) {
  let type = find(`[data-test-field="${name}"]`).getAttribute('data-test-field-type-id');
  if (type.includes('/boolean-field')) {
    if (value) {
      await click(`[data-test-field="${name}"] .cardstack-core-types-field-value-true`);
    } else {
      await click(`[data-test-field="${name}"] .cardstack-core-types-field-value-false`);
    }
  } else {
    await fillIn(`[data-test-field="${name}"] input`, value);
    await triggerEvent(`[data-test-field="${name}"] input`, 'keyup');
  }
  await waitForCardPatch();
}

export async function removeField(name) {
  await click(`[data-test-field="${name}"] [data-test-field-renderer-remove-btn]`);
  await waitForCardPatch();
  await waitForFieldOrderUpdate();
  await animationsSettled();
}

export function encodeColons(string) {
  return string.replace(/:/g, encodeURIComponent(':'));
}
