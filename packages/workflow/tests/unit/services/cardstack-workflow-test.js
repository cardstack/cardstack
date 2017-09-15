import Ember from 'ember';
import { moduleFor, test } from 'ember-qunit';
import {
  // Priorities
  NEED_RESPONSE,
  PROCESSED,
  FYI,
  // Tags
  REQUEST_TO_PUBLISH_LIVE,
  LICENSE_REQUEST,
  READY_FOR_COPYEDITING
} from '@cardstack/workflow/models/message';

const SONG_SPLIT_PROPOSAL = 'Song Splits Proposal';
const INFO_SYNCED = 'Info synced';
const NEW_CONTENT_ADDED = 'New local content added';

const create = Ember.Object.create.bind(Ember.Object);

const items = Ember.A([
  create({
    priority: NEED_RESPONSE,
    tag: REQUEST_TO_PUBLISH_LIVE,
    isHandled: false,
    updatedAt: moment().toISOString()
  }),
  create({
    priority: NEED_RESPONSE,
    tag: REQUEST_TO_PUBLISH_LIVE,
    isHandled: false,
    updatedAt: '2017-09-04',
  }),
  create({
    priority: NEED_RESPONSE,
    tag: REQUEST_TO_PUBLISH_LIVE,
    isHandled: true,
    updatedAt: '2017-09-01',
  }),
  create({
    priority: NEED_RESPONSE,
    tag: SONG_SPLIT_PROPOSAL,
    isHandled: false,
    updatedAt: moment().toISOString()
  }),
  create({
    priority: NEED_RESPONSE,
    tag: SONG_SPLIT_PROPOSAL,
    isHandled: true,
    updatedAt: '2017-08-31',
  }),
  create({
    priority: PROCESSED,
    tag: INFO_SYNCED,
    isHandled: true,
    updatedAt: '2017-08-08'
  }),
  create({
    priority: PROCESSED,
    tag: INFO_SYNCED,
    isHandled: true,
    updatedAt: '2017-09-03'
  }),
  create({
    priority: FYI,
    tag: NEW_CONTENT_ADDED,
    isHandled: false,
    updatedAt: moment().toISOString()
  }),
]);

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

test('it groups the items by priority and then tag', function(assert) {
  let service = this.subject({ items });
  let groupedMessages = service.get('groupedMessages');
  assert.deepEqual(Object.keys(groupedMessages[NEED_RESPONSE]), [REQUEST_TO_PUBLISH_LIVE, LICENSE_REQUEST, READY_FOR_COPYEDITING, SONG_SPLIT_PROPOSAL]);
  assert.deepEqual(Object.keys(groupedMessages[PROCESSED]), [INFO_SYNCED]);
  assert.deepEqual(Object.keys(groupedMessages[FYI]), [NEW_CONTENT_ADDED]);
  let requestToPublish = groupedMessages[NEED_RESPONSE][REQUEST_TO_PUBLISH_LIVE];
  let songSplitProposal = groupedMessages[NEED_RESPONSE][SONG_SPLIT_PROPOSAL];
  let infoSynced = groupedMessages[PROCESSED][INFO_SYNCED];
  let newContentAdded = groupedMessages[FYI][NEW_CONTENT_ADDED];
  assert.equal(requestToPublish.unhandled.length, 2);
  assert.equal(songSplitProposal.unhandled.length, 1);
  assert.equal(infoSynced.unhandled.length, 0);
  assert.equal(newContentAdded.unhandled.length, 1);

  //TODO: Shouldn't this invalidate and rerun the CP?
  // Ember.run(() => {
  //   Ember.set(items.get('firstObject'), 'tag', NEW_CONTENT_ADDED)
  // });
  // assert.equal(groupedMessages[NEED_RESPONSE][REQUEST_TO_PUBLISH_LIVE].length, 2);
  // assert.equal(groupedMessages[FYI][NEW_CONTENT_ADDED].length, 2);
});

test('it groups the items by date range', function(assert) {
  let service = this.subject({ items });
  let messages = service.get('messagesForToday');
  assert.equal(messages.length, 3);
});
