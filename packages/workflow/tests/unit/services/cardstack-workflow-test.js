import Ember from 'ember';
import { moduleFor, test } from 'ember-qunit';
import {
  NEED_RESPONSE,
  PROCESSED,
  FYI,
  REQUEST_TO_PUBLISH_LIVE,
  LICENSE_REQUEST,
  READY_FOR_COPYEDITING,
  COURSE_INFORMATION_SYNCED
} from '@cardstack/workflow/models/message';

const create = Ember.Object.create.bind(Ember.Object);

const items = Ember.A([
  create({
    priority: NEED_RESPONSE,
    tag: REQUEST_TO_PUBLISH_LIVE,
    isImportant: true,
    updatedAt: moment().toISOString()
  }),
  create({
    priority: NEED_RESPONSE,
    tag: REQUEST_TO_PUBLISH_LIVE,
    isImportant: true,
    updatedAt: '2017-09-04',
  }),
  create({
    priority: NEED_RESPONSE,
    tag: REQUEST_TO_PUBLISH_LIVE,
    isImportant: false,
    updatedAt: '2017-09-01',
  }),
  create({
    priority: NEED_RESPONSE,
    tag: READY_FOR_COPYEDITING,
    isImportant: true,
    updatedAt: moment().toISOString()
  }),
  create({
    priority: NEED_RESPONSE,
    tag: READY_FOR_COPYEDITING,
    isImportant: false,
    updatedAt: '2017-08-31',
  }),
  create({
    priority: PROCESSED,
    tag: COURSE_INFORMATION_SYNCED,
    isImportant: false,
    updatedAt: '2017-08-08'
  }),
  create({
    priority: PROCESSED,
    tag: COURSE_INFORMATION_SYNCED,
    isImportant: false,
    updatedAt: '2017-09-03'
  }),
  create({
    priority: FYI,
    tag: LICENSE_REQUEST,
    isImportant: true,
    updatedAt: moment().toISOString()
  }),
]);

moduleFor('service:cardstack-workflow', 'Unit | Service | cardstack-workflow', {
});

test('it gets notification count from important items', function(assert) {
  let items = Ember.A([
    { status: 'pending', isHandled: false },
    { status: 'approved', isHandled: true },
    { status: 'denied', isHandled: false },
  ]);
  let service = this.subject({ items });
  assert.equal(service.get('notificationCount'), 2);
});

test('it groups the items by priority and then tag', function(assert) {
  let service = this.subject({ items });
  let groupedMessages = service.get('groupedMessages');
  assert.deepEqual(Object.keys(groupedMessages[NEED_RESPONSE]), [REQUEST_TO_PUBLISH_LIVE, LICENSE_REQUEST, READY_FOR_COPYEDITING]);
  assert.deepEqual(Object.keys(groupedMessages[PROCESSED]), [COURSE_INFORMATION_SYNCED]);
  assert.deepEqual(Object.keys(groupedMessages[FYI]), [LICENSE_REQUEST]);
  let requestToPublish = groupedMessages[NEED_RESPONSE][REQUEST_TO_PUBLISH_LIVE];
  let readyForEditing = groupedMessages[NEED_RESPONSE][READY_FOR_COPYEDITING];
  let infoSynced = groupedMessages[PROCESSED][COURSE_INFORMATION_SYNCED];
  let licenseRequest = groupedMessages[FYI][LICENSE_REQUEST];
  assert.equal(requestToPublish.important.length, 2);
  assert.equal(readyForEditing.important.length, 1);
  assert.equal(infoSynced.important.length, 0);
  assert.equal(licenseRequest.important.length, 1);
});

test('it groups the items by date range', function(assert) {
  let service = this.subject({ items });
  let messages = service.get('messagesForToday');
  assert.equal(messages.length, 3);
});
