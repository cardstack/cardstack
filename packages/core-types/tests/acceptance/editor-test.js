import { module, test } from 'qunit';
import { setupApplicationTest } from 'ember-qunit';
import { visit, currentURL, fillIn } from '@ember/test-helpers';
import { selectChoose } from 'ember-power-select/test-support/helpers';
import RSVP from 'rsvp';

function run(fn) {
  return RSVP.resolve().then(() => fn.apply(this, arguments));
}

module('Acceptance | field editors', async function(hooks) {
  setupApplicationTest(hooks);

  test('visiting /editor', async function(assert) {
    await visit('/editor');
    assert.equal(currentURL(), '/editor');

    this.store = this.owner.lookup('service:store');
    let model = await run(() => {
      return this.store.findRecord('driver', 'metalmario');
    });
    let feeling = await model.get('feeling.title');

    assert.equal(model.get('name'), 'Metal Mario', 'driver name is correct');
    assert.equal(model.get('dob'), '1999-01-01', 'driver dob is correct');
    assert.equal(feeling, 'Happy', 'driver is feeling happy');

    await fillIn('.ember-text-field:nth-of-type(1)', 'METAL Mario')
    await fillIn('.ember-text-field:nth-of-type(2)', '1998-01-01')
    await selectChoose('.feeling-selector', 'Sad');

    feeling = await model.get('feeling.title');

    assert.equal(model.get('name'), 'METAL Mario', 'metal mario is more metal');
    assert.equal(model.get('dob'), '1998-01-01', 'metal mario was born earlier');
    assert.equal(feeling, 'Sad', 'metal mario is sad');
  });
});
