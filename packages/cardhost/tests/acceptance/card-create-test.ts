import { module, skip, test } from 'qunit';
import { visit, currentURL } from '@ember/test-helpers';
import { setupCardTest } from '../helpers/setup';

import click from '@ember/test-helpers/dom/click';
import fillIn from '@ember/test-helpers/dom/fill-in';
import waitFor from '@ember/test-helpers/dom/wait-for';

import {
  ADDRESS_RAW_CARD,
  PERSON_RAW_CARD,
} from '@cardstack/core/tests/helpers/fixtures';
import { cardURL } from '@cardstack/core/src/utils';

const PERSON = '[data-test-person]';
const MODAL = '[data-test-modal]';
const NEW = '[data-test-new-button-local]';
const NEW_WITH_ID = '[data-test-new-button-with-id]';
const SAVE = '[data-test-modal-save]';

module('Acceptance | Card Creation', function (hooks) {
  let { createCard } = setupCardTest(hooks, { type: 'application' });
  let personURL = cardURL(PERSON_RAW_CARD);

  hooks.beforeEach(async function () {
    await createCard(ADDRESS_RAW_CARD);
    await createCard(
      Object.assign(
        {
          data: {
            name: 'Arthur',
            birthdate: '2021-05-17',
            address: {
              street: 'Seasame Place',
            },
          },
        },
        PERSON_RAW_CARD
      )
    );
  });

  test('Creating a local card from a local card', async function (assert) {
    await visit(`/?url=${personURL}`);
    assert.equal(currentURL(), `/?url=${personURL}`);
    await waitFor(PERSON);
    assert.dom(PERSON).hasText('Hi! I am Arthur');

    await click(NEW);
    assert.dom(MODAL).exists('The modal is opened');
    await waitFor('[data-test-field-name="name"]');
    await fillIn('[data-test-field-name="name"]', 'Bob Barker');
    await fillIn('[data-test-field-name="city"]', 'San Francisco');
    await click(SAVE);
    await waitFor(PERSON);
    assert.dom(MODAL).exists('The modal stays open');
    assert
      .dom(PERSON)
      .hasText(
        'Hi! I am Bob Barker',
        'The original instance of the card is updated'
      );
  });

  // TODO we need a mechanism to create cards on the server. I think probably
  // that means that the /sources/new API endpoint needs to be implemented
  skip('Creating a local card from a remote card');

  test('Creating a card with an ID', async function (assert) {
    await visit(`/?url=${personURL}`);
    assert.equal(currentURL(), `/?url=${personURL}`);
    await waitFor(PERSON);
    assert.dom(PERSON).hasText('Hi! I am Arthur');

    await click(NEW_WITH_ID);
    assert.dom(MODAL).exists('The modal is opened');
    await waitFor('[data-test-field-name="name"]');
    await fillIn('[data-test-field-name="name"]', 'Bob Barker');
    await fillIn('[data-test-field-name="city"]', 'San Francisco');
    await click(SAVE);
    await waitFor(PERSON);
    assert.includes(
      currentURL(),
      'CUSTOM_ID',
      'The card is created with a pre-supplied ID'
    );
  });
});
