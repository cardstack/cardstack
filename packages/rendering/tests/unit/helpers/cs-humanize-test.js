import { humanize } from '@cardstack/rendering/helpers/cs-humanize';
import { module, test } from 'qunit';

module('Unit | Helper | humanize', function() {
  test('it works', function(assert) {
    assert.equal(humanize('page'), 'Page');
    assert.equal(humanize('event-type'), 'Event Type');
  });
});
