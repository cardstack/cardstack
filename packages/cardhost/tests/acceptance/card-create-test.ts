import { module, test } from 'qunit';
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
import { DEMO_REALM, LOCAL_REALM } from 'cardhost/lib/builder';

const PERSON = '[data-test-person]';
const POST = '[data-test-post]';
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

  test('Creating a local card from a remote card', async function (assert) {
    let remoteCard = `${DEMO_REALM}post-0`;
    await visit(`/?url=${remoteCard}`);
    assert.equal(currentURL(), `/?url=${remoteCard}`);
    await waitFor(POST);

    await click(NEW);
    assert.dom(MODAL).exists('The modal is opened');
    await waitFor('[data-test-field-name="title"]');
    await fillIn('[data-test-field-name="title"]', 'Hello World');
    await click(SAVE);
    await waitFor(POST);
    assert.dom(MODAL).exists('The modal stays open');
    assert.dom(POST).hasText('Hello World');
    assert.includes(
      currentURL(),
      encodeURIComponent(LOCAL_REALM),
      'the card URL is in the local realm'
    );

    // TODO there seems to be something async happening after the test is done,
    // probably related to the async rerender for setting a card field
  });

  test('Creating a card with an ID', async function (assert) {
    await visit(`/?url=${personURL}`);
    assert.equal(currentURL(), `/?url=${personURL}`);
    await waitFor(PERSON);

    await click(NEW_WITH_ID);
    assert.dom(MODAL).exists('The modal is opened');
    await waitFor('[data-test-field-name="name"]');
    await fillIn('[data-test-field-name="name"]', 'Bob Barker');
    await click(SAVE);
    await waitFor(PERSON);
    assert.includes(
      currentURL(),
      'CUSTOM_ID',
      'The card is created with a pre-supplied ID'
    );
  });
});
