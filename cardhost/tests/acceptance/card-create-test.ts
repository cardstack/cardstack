import { module, test } from 'qunit';
import { visit, currentURL } from '@ember/test-helpers';
import { setupApplicationTest } from 'ember-qunit';
import setupCardMocking from '../helpers/card-mocking';

import click from '@ember/test-helpers/dom/click';
import fillIn from '@ember/test-helpers/dom/fill-in';
import { setupMirage } from 'ember-cli-mirage/test-support';
import waitFor from '@ember/test-helpers/dom/wait-for';

import {
  ADDRESS_RAW_CARD,
  PERSON_RAW_CARD,
} from '@cardstack/core/tests/helpers/fixtures';

const PERSON = '[data-test-person]';
const MODAL = '[data-test-modal]';
const NEW = '[data-test-new-button]';
const SAVE = '[data-test-modal-save]';

module('Acceptance | Card Creation', function (hooks) {
  setupApplicationTest(hooks);
  setupMirage(hooks);
  setupCardMocking(hooks);
  let personURL = 'https://mirage/cards/person';

  hooks.beforeEach(function () {
    this.createCard(ADDRESS_RAW_CARD);
    this.createCard(
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

  test('Creating a card', async function (assert) {
    await visit(`/card?url=${personURL}`);
    assert.equal(currentURL(), `/card?url=${personURL}`);
    assert.dom(PERSON).hasText('Hi! I am Arthur');

    await click(NEW);
    assert.dom(MODAL).exists('The modal is opened');

    await waitFor('[data-test-field-name="name"]');
    await fillIn('[data-test-field-name="name"]', 'Bob Barker');
    await fillIn('[data-test-field-name="city"]', 'San Francisco');
    await click(SAVE);
    await waitFor(MODAL, { count: 0 });
    assert.dom(MODAL).doesNotExist('The modal is closed');
    assert
      .dom(PERSON)
      .hasText(
        'Hi! I am Bob Barker',
        'The original instance of the card is updated'
      );
  });
});
