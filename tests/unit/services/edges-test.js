import { module, test } from 'qunit';
import { setupTest } from 'ember-qunit';

module('Unit | Service | edges', function (hooks) {
  setupTest(hooks);

  test('it exists', function (assert) {
    let service = this.owner.lookup('service:edges');
    assert.ok(service);
  });

  test('left-edge is set to be hidden by default', function (assert) {
    let service = this.owner.lookup('service:edges');
    assert.equal(service.displayLeftEdge, false);
  });

  test('can change left-edge display state', async function (assert) {
    let service = this.owner.lookup('service:edges');

    await service.updateDisplayLeftEdge(true);
    assert.equal(service.displayLeftEdge, true);

    await service.updateDisplayLeftEdge();
    assert.equal(service.displayLeftEdge, false);

    await service.updateDisplayLeftEdge(false);
    assert.equal(service.displayLeftEdge, false);
  });
});
