
import { humanize } from 'cardstack-suite/helpers/cs-humanize';
import { module, test } from 'qunit';

module('Unit | Helper | humanize');

test('it works', function(assert) {
  assert.equal(humanize('page'), 'Page');
  assert.equal(humanize('event-type'), 'Event Type');
});
