import Ember from 'ember';
import { moduleFor, test } from 'ember-qunit';
import {
  NEED_RESPONSE,
  AUTO_PROCESSED,
  FYI
} from '@cardstack/workflow/services/cardstack-workflow';

const REQUEST_TO_PUBLISH = 'Request to publish';
const READY_FOR_EDITING = 'Ready for editing';
const INFO_SYNCED = 'Info synced';
const NEW_CONTENT_ADDED = 'New local content added';

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
    { priority: NEED_RESPONSE, tag: REQUEST_TO_PUBLISH, isHandled: false },
    { priority: NEED_RESPONSE, tag: REQUEST_TO_PUBLISH, isHandled: false },
    { priority: NEED_RESPONSE, tag: REQUEST_TO_PUBLISH, isHandled: true },
    { priority: NEED_RESPONSE, tag: READY_FOR_EDITING, isHandled: false },
    { priority: NEED_RESPONSE, tag: READY_FOR_EDITING, isHandled: true },
    { priority: AUTO_PROCESSED, tag: INFO_SYNCED, isHandled: true },
    { priority: AUTO_PROCESSED, tag: INFO_SYNCED, isHandled: true },
    { priority: FYI, tag: NEW_CONTENT_ADDED, isHandled: false },
  ]);
  let service = this.subject({ items });
  let groupedMessages = service.get('groupedMessages');
  assert.deepEqual(Object.keys(groupedMessages[NEED_RESPONSE]), [REQUEST_TO_PUBLISH, READY_FOR_EDITING]);
  assert.deepEqual(Object.keys(groupedMessages[AUTO_PROCESSED]), [INFO_SYNCED]);
  assert.deepEqual(Object.keys(groupedMessages[FYI]), [NEW_CONTENT_ADDED]);
  let requestToPublish = groupedMessages[NEED_RESPONSE][REQUEST_TO_PUBLISH];
  let readyForEditing = groupedMessages[NEED_RESPONSE][READY_FOR_EDITING];
  let infoSynced = groupedMessages[AUTO_PROCESSED][INFO_SYNCED];
  let newContentAdded = groupedMessages[FYI][NEW_CONTENT_ADDED];
  assert.equal(requestToPublish.unhandledCount, 2);
  assert.equal(readyForEditing.unhandledCount, 1);
  assert.equal(infoSynced.unhandledCount, 0);
  assert.equal(newContentAdded.unhandledCount, 1);

  //TODO: Shouldn't this invalidate and rerun the CP?
  // Ember.run(() => {
  //   Ember.set(items.get('firstObject'), 'tag', NEW_CONTENT_ADDED)
  // });
  // assert.equal(groupedMessages[NEED_RESPONSE][REQUEST_TO_PUBLISH].length, 2);
  // assert.equal(groupedMessages[FYI][NEW_CONTENT_ADDED].length, 2);
});
