import { encodeCardURL } from '@cardstack/core/src/utils';
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
const EDIT = '[data-test-edit-button]';
const SAVE = '[data-test-modal-save]';

module('Acceptance | Card Editing', function (hooks) {
  setupApplicationTest(hooks);
  setupMirage(hooks);
  setupCardMocking(hooks, { routingCard: 'https://mirage/cards/my-routes' });
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

  test('Editing a card', async function (assert) {
    await visit(`/?url=${personURL}`);
    assert.equal(currentURL(), `/?url=${personURL}`);
    await waitFor(MODAL);
    assert.dom(PERSON).hasText('Hi! I am Arthur');

    await click(EDIT);
    assert.dom(MODAL).exists('The modal is opened');

    await waitFor('[data-test-field-name="name"]');
    await fillIn('[data-test-field-name="name"]', 'Bob Barker');
    await fillIn('[data-test-field-name="city"]', 'San Francisco');
    await click(SAVE);
    assert.dom(MODAL).exists('The modal stays open');
    await waitFor(PERSON);
    assert
      .dom(PERSON)
      .hasText(
        'Hi! I am Bob Barker',
        'The original instance of the card is updated'
      );

    let card = (this.server.schema as any).cards.find(encodeCardURL(personURL));
    assert.equal(
      card.attrs.raw.data.name,
      'Bob Barker',
      'RawCard cache is updated'
    );
    assert.equal(
      card.attrs.raw.data.address.city,
      'San Francisco',
      'RawCard cache is updated'
    );
  });
});
