import { module, test } from 'qunit';
import { click, visit, currentURL, waitFor } from '@ember/test-helpers';
import { setupApplicationTest } from 'ember-qunit';
import Fixtures from '@cardstack/test-support/fixtures'
import { getCodeMirrorValue } from '../helpers/code-mirror';

const scenario = new Fixtures({
  destroy() {
    return [{ type: 'cards', id: 'local-hub::article-card::millenial-puppies' }];
  }
});

module('Acceptance | create card', function(hooks) {
  setupApplicationTest(hooks);
  scenario.setupTest(hooks);

  test('creating a card', async function(assert) {
    await visit('/cards/new');

    assert.equal(currentURL(), '/cards/new');

    await click('[data-test-card-creator-add-btn]');
    await waitFor('[data-test-card-updator="local-hub::article-card::millenial-puppies"]');

    assert.equal(currentURL(), '/cards/local-hub::article-card::millenial-puppies');
    assert.dom('[data-test-card-inspector-field="title"] [data-test-card-inspector-value]').hasText('The Millenial Puppy');
    assert.dom('[data-test-card-inspector-field="title"] [data-test-card-inspector-field-type]').hasText('@cardstack/core-types::string');
    assert.dom('[data-test-card-inspector-field="title"] [data-test-card-inspector-is-meta]').hasText('true');
    assert.dom('[data-test-card-inspector-field="title"] [data-test-card-inspector-embedded]').hasText('true');

    assert.dom('[data-test-card-inspector-field="author"] [data-test-card-inspector-value]').hasText('Van Gogh');
    assert.dom('[data-test-card-inspector-field="author"] [data-test-card-inspector-field-type]').hasText('@cardstack/core-types::string');
    assert.dom('[data-test-card-inspector-field="author"] [data-test-card-inspector-is-meta]').hasText('true');
    assert.dom('[data-test-card-inspector-field="author"] [data-test-card-inspector-embedded]').hasText('true');

    assert.dom('[data-test-card-inspector-field="body"] [data-test-card-inspector-value]').hasText(`It can be difficult these days to deal with the discerning tastes of the millenial puppy.`);
    assert.dom('[data-test-card-inspector-field="body"] [data-test-card-inspector-field-type]').hasText('@cardstack/core-types::string');
    assert.dom('[data-test-card-inspector-field="body"] [data-test-card-inspector-is-meta]').hasText('true');
    assert.dom('[data-test-card-inspector-field="body"] [data-test-card-inspector-embedded]').hasText('false');

    assert.dom('[data-test-card-inspector-field="internal-field"] [data-test-card-inspector-value]').hasText(`this is internal data`);
    assert.dom('[data-test-card-inspector-field="internal-field"] [data-test-card-inspector-field-type]').hasText('@cardstack/core-types::string');
    assert.dom('[data-test-card-inspector-field="internal-field"] [data-test-card-inspector-is-meta]').hasText('false');
    assert.dom('[data-test-card-inspector-field="internal-field"] [data-test-card-inspector-embedded]').hasText('false');

    let card = JSON.parse(getCodeMirrorValue());
    assert.equal(card.data.attributes.title, 'The Millenial Puppy');
    assert.equal(card.data.attributes.author, 'Van Gogh');
    assert.equal(card.data.attributes.body, `It can be difficult these days to deal with the discerning tastes of the millenial puppy.`);
    assert.equal(card.data.attributes['internal-field'], undefined);
  });
});
