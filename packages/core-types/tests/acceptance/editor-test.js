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
      return this.store.find('driver', 'metalmario');
    });
    let feeling = await model.get('feeling.title');
    let vehicle = await model.get('vehicle.name');
    let alternateVehicle = await model.get('alternateVehicle.name');

    assert.equal(model.get('name'), 'Metal Mario', 'driver name is correct');
    assert.equal(model.get('dob'), '1999-01-01', 'driver dob is correct');
    assert.equal(feeling, 'Happy', 'driver is feeling happy');
    assert.equal(vehicle, 'Sport Bike', 'driver is using a sport bike');
    assert.equal(alternateVehicle, 'Standard Kart', 'drivers alternate vehicle is a standard kart');

    await fillIn('.ember-text-field:nth-of-type(1)', 'METAL Mario');
    await fillIn('.ember-text-field:nth-of-type(2)', '1998-01-01');
    await selectChoose('.feeling-selector', 'Sad');
    await selectChoose('.vehicle-selector', 'Honeycoupe');
    await selectChoose('.alternate-vehicle-selector', 'Wild Wiggler');

    assert.dom('.feeling-selector .ember-power-select-selected-item').hasText('Sad');
    assert.dom('.vehicle-selector .ember-power-select-selected-item').hasText('Honeycoupe');
    assert.dom('.alternate-vehicle-selector .ember-power-select-selected-item').hasText('Wild Wiggler');

    feeling = await model.get('feeling.title');
    vehicle = await model.get('vehicle.name');
    alternateVehicle = await model.get('alternateVehicle.name');

    assert.equal(model.get('name'), 'METAL Mario', 'metal mario is more metal');
    assert.equal(model.get('dob'), '1998-01-01', 'metal mario was born earlier');
    assert.equal(feeling, 'Sad', 'metal mario is sad');
    assert.equal(vehicle, 'Honeycoupe', 'metal mario is driving a honeycoupe');
    assert.equal(alternateVehicle, 'Wild Wiggler', 'metal marios alternate vehicle is a wild wiggler');
  });
});
