import { module, test } from 'qunit';
import { setupApplicationTest } from 'ember-qunit';
import { visit, currentURL, fillIn, click } from '@ember/test-helpers';
import { selectChoose, selectSearch, removeMultipleOption } from 'ember-power-select/test-support/helpers';
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
    let tracks = await model.get('tracks.length');
    let firstTrack = await model.get('tracks.firstObject.title');
    let lastTrack = await model.get('tracks.lastObject.title');
    let bestTrack = await model.get('bestTrack.title');

    assert.equal(model.get('name'), 'Metal Mario', 'driver name is correct');
    assert.equal(model.get('dob'), '1999-01-01', 'driver dob is correct');
    assert.equal(model.get('latestVictory'), '2018-10-25T13:56:05', 'driver latest victory is correct');
    assert.equal(model.get('isGoodGuy'), true, 'driver is a good guy');
    assert.equal(feeling, 'Happy', 'driver is feeling happy');
    assert.equal(vehicle, 'Sport Bike', 'driver is using a sport bike');
    assert.equal(alternateVehicle, 'Standard Kart', 'drivers alternate vehicle is a standard kart');
    assert.equal(tracks, '3', 'drivers has 3 tracks');
    assert.equal(firstTrack, 'Rainbow Road', 'drivers first track is rainbow road');
    assert.equal(lastTrack, 'Toad Harbor', 'drivers final track is Toad Harbor');
    assert.equal(bestTrack, 'Electrodrome', 'drivers best track is Electrodrome');

    await fillIn('.field-editor:nth-of-type(1) > input', 'METAL Mario');
    await fillIn('input[type=date]', '1998-01-01');
    await fillIn('input[type=datetime-local]', '2018-10-27T23:56:07');
    await click('.cs-toggle-switch');
    await selectChoose('.feeling-selector', 'Sad');
    await selectChoose('.vehicle-selector', 'Honeycoupe');
    await selectChoose('.alternate-vehicle-selector', 'Wild Wiggler');
    await selectChoose('.tracks-selector', 'Dragon Driftway');
    await selectSearch('.best-track-selector', 'mario');
    await selectChoose('.best-track-selector', 'Mario Circuit');
    await removeMultipleOption('.tracks-selector', 'Rainbow Road');
    await removeMultipleOption('.tracks-selector', 'Toad Harbor');

    assert.dom('.feeling-selector .ember-power-select-selected-item').hasText('Sad');
    assert.dom('.vehicle-selector .ember-power-select-selected-item').hasText('Honeycoupe');
    assert.dom('.alternate-vehicle-selector .ember-power-select-selected-item').hasText('Wild Wiggler');
    assert.dom('.tracks-selector .ember-power-select-multiple-option').exists({ count: 2 });
    assert.dom('.tracks-selector .ember-power-select-multiple-option:nth-of-type(1)').hasText('× Sweet Sweet Canyon');
    assert.dom('.tracks-selector .ember-power-select-multiple-option:nth-of-type(2)').hasText('× Dragon Driftway');
    assert.dom('.best-track-selector .ember-power-select-selected-item').hasText('Mario Circuit');

    feeling = await model.get('feeling.title');
    vehicle = await model.get('vehicle.name');
    alternateVehicle = await model.get('alternateVehicle.name');
    firstTrack = await model.get('tracks.firstObject.title');
    lastTrack = await model.get('tracks.lastObject.title');
    bestTrack = await model.get('bestTrack.title');

    assert.equal(model.get('name'), 'METAL Mario', 'metal mario is more metal');
    assert.equal(model.get('dob'), '1998-01-01', 'metal mario was born earlier');
    assert.equal(model.get('latestVictory'), '2018-10-27T23:56:07', 'metal mario won a race more recently');
    assert.equal(model.get('isGoodGuy'), false, 'metal mario is a bad guy');
    assert.equal(feeling, 'Sad', 'metal mario is sad');
    assert.equal(vehicle, 'Honeycoupe', 'metal mario is driving a honeycoupe');
    assert.equal(alternateVehicle, 'Wild Wiggler', 'metal marios alternate vehicle is a wild wiggler');
    assert.equal(firstTrack, 'Sweet Sweet Canyon', 'drivers first track is sweet sweet canyon');
    assert.equal(lastTrack, 'Dragon Driftway', 'drivers final track is Dragon Driftway');
    assert.equal(bestTrack, 'Mario Circuit', 'drivers best track is Mario Circuit');
  });
});
