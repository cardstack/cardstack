import Ember from 'ember';
import { moduleFor, test } from 'ember-qunit';
import {
  REQUEST_TO_PUBLISH_LIVE,
  READY_FOR_COPYEDITING,
  COURSE_INFORMATION_SYNCED
} from '@cardstack/workflow/services/cardstack-workflow';

moduleFor('service:cardstack-workflow', 'Unit | Service | cardstack-workflow', {
});

test('it gets notification count from unhandled items', function(assert) {
  let items = Ember.A([
    { status: 'pending', isHandled: false },
    { status: 'approved', isHandled: true },
    { status: 'denied', isHandled: false },
  ]);
  let service = this.subject({ items });
  assert.equal(service.get('notificationCount'), 2);
});

test('it extracts categories from the items', function(assert) {
  let items = Ember.A([
    { tag: REQUEST_TO_PUBLISH_LIVE, isHandled: false },
    { tag: REQUEST_TO_PUBLISH_LIVE, isHandled: false },
    { tag: REQUEST_TO_PUBLISH_LIVE, isHandled: true },
    { tag: READY_FOR_COPYEDITING, isHandled: false },
    { tag: READY_FOR_COPYEDITING, isHandled: true },
    { tag: COURSE_INFORMATION_SYNCED, isHandled: true },
    { tag: COURSE_INFORMATION_SYNCED, isHandled: true },
  ]);
  let service = this.subject({ items });
  let expected = {};
  expected[REQUEST_TO_PUBLISH_LIVE] = 2;
  expected[READY_FOR_COPYEDITING] = 1;
  expected[COURSE_INFORMATION_SYNCED] = 0;
  assert.deepEqual(service.get('messagesByTag'), expected);
});
