import { moduleFor, test } from 'ember-qunit';

moduleFor('service:cardstack-tools', 'Unit | Service | cardstack tools', {
  needs: ['service:ember-overlays', 'service:cardstack-routing', 'service:resource-metadata']
});

test('it exists', function(assert) {
  let service = this.subject();
  assert.ok(service);
});
