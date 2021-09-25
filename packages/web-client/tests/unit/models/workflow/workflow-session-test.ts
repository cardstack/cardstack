import { module, test } from 'qunit';
import { setupTest } from 'ember-qunit';
import WorkflowSession from '@cardstack/web-client/models/workflow/workflow-session';
import WorkflowPersistence from '@cardstack/web-client/services/workflow-persistence';
import Ember from 'ember';
import BN from 'bn.js';

const { track, valueForTag, validateTag } =
  // @ts-ignore digging
  Ember.__loader.require('@glimmer/validator');

module('Unit | WorkflowSession model', function (hooks) {
  setupTest(hooks);

  const ID = 'abc123';

  test('state starts off as empty', function (assert) {
    let subject = new WorkflowSession();
    assert.deepEqual(subject._state, {});
  });

  test('get string value', function (assert) {
    let workflowPersistence = new WorkflowPersistence();
    workflowPersistence.persistData(ID, {
      name: 'EXAMPLE',
      state: {
        myKey: '{ "value": "myValue" }',
      },
    });
    let subject = new WorkflowSession({
      workflowPersistence,
      workflowPersistenceId: ID,
    });
    subject.restoreFromStorage();
    assert.equal(subject.getValue<string>('myKey'), 'myValue');
  });

  test('get un-set string value', function (assert) {
    let workflowPersistence = new WorkflowPersistence();
    workflowPersistence.persistData(ID, {
      name: 'EXAMPLE',
      state: {},
    });
    let subject = new WorkflowSession({
      workflowPersistence,
      workflowPersistenceId: ID,
    });
    subject.restoreFromStorage();
    assert.equal(subject.getValue<string>('myKey'), null);
  });

  test('set string value', function (assert) {
    let workflowPersistence = new WorkflowPersistence();
    workflowPersistence.persistData(ID, {
      name: 'EXAMPLE',
      state: {},
    });
    let subject = new WorkflowSession({
      workflowPersistence,
      workflowPersistenceId: ID,
    });
    subject.restoreFromStorage();

    const tag = track(() => {
      subject._state.myKey;
    });
    let snapshot = valueForTag(tag);
    assert.ok(validateTag(tag, snapshot), 'tag should be valid to start');

    subject.setValue('myKey', 'myValue');

    assert.strictEqual(
      validateTag(tag, snapshot),
      false,
      'tag is invalidated after property is set'
    );

    assert.equal(subject.getValue<string>('myKey'), 'myValue');

    let data = workflowPersistence.getPersistedData(ID);
    assert.deepEqual(data, {
      state: {
        myKey: '{"value":"myValue"}',
      },
    });
  });

  test('set optional string value', function (assert) {
    let workflowPersistence = new WorkflowPersistence();
    workflowPersistence.persistData(ID, {
      name: 'EXAMPLE',
      state: {},
    });
    let subject = new WorkflowSession({
      workflowPersistence,
      workflowPersistenceId: ID,
    });
    subject.restoreFromStorage();

    const tag = track(() => {
      subject._state.myKey;
    });
    let snapshot = valueForTag(tag);
    assert.ok(validateTag(tag, snapshot), 'tag should be valid to start');

    let s: string | undefined;
    subject.setValue('myKey', s);

    assert.strictEqual(
      validateTag(tag, snapshot),
      false,
      'tag is invalidated after property is set'
    );

    assert.equal(subject.getValue<string | undefined>('myKey'), null);

    let data = workflowPersistence.getPersistedData(ID);
    assert.deepEqual(data, {
      state: {
        myKey: '{}',
      },
    });
  });

  test('get number value', function (assert) {
    let workflowPersistence = new WorkflowPersistence();
    workflowPersistence.persistData(ID, {
      name: 'EXAMPLE',
      state: {
        myKey: '{ "value": 42 }',
      },
    });
    let subject = new WorkflowSession({
      workflowPersistence,
      workflowPersistenceId: ID,
    });
    subject.restoreFromStorage();
    assert.equal(subject.getValue<number>('myKey'), 42);
  });

  test('get un-set number value', function (assert) {
    let workflowPersistence = new WorkflowPersistence();
    workflowPersistence.persistData(ID, {
      name: 'EXAMPLE',
      state: {},
    });
    let subject = new WorkflowSession({
      workflowPersistence,
      workflowPersistenceId: ID,
    });
    subject.restoreFromStorage();
    assert.equal(subject.getValue<number>('myKey'), null);
  });

  test('set number value', function (assert) {
    let workflowPersistence = new WorkflowPersistence();
    workflowPersistence.persistData(ID, {
      name: 'EXAMPLE',
      state: {},
    });
    let subject = new WorkflowSession({
      workflowPersistence,
      workflowPersistenceId: ID,
    });
    subject.restoreFromStorage();

    const tag = track(() => {
      subject._state.myKey;
    });
    let snapshot = valueForTag(tag);
    assert.ok(validateTag(tag, snapshot), 'tag should be valid to start');

    subject.setValue('myKey', 42);

    assert.strictEqual(
      validateTag(tag, snapshot),
      false,
      'tag is invalidated after property is set'
    );

    assert.equal(subject.getValue<number>('myKey'), 42);

    let data = workflowPersistence.getPersistedData(ID);
    assert.deepEqual(data, {
      state: {
        myKey: '{"value":42}',
      },
    });
  });

  test('set multiple keys at once with a hash', function (assert) {
    let workflowPersistence = new WorkflowPersistence();
    workflowPersistence.persistData(ID, {
      name: 'EXAMPLE',
      state: {},
    });
    let subject = new WorkflowSession({
      workflowPersistence,
      workflowPersistenceId: ID,
    });
    subject.restoreFromStorage();

    const tag = track(() => {
      subject._state.myNumberKey;
      subject._state.myStringKey;
    });
    let snapshot = valueForTag(tag);
    assert.ok(validateTag(tag, snapshot), 'tag should be valid to start');

    subject.setValue({
      myNumberKey: 42,
      myStringKey: 'myValue',
    });

    assert.strictEqual(
      validateTag(tag, snapshot),
      false,
      'tag is invalidated after property is set'
    );

    assert.equal(subject.getValue<number>('myNumberKey'), 42);
    assert.equal(subject.getValue<string>('myStringKey'), 'myValue');

    let data = workflowPersistence.getPersistedData(ID);
    assert.deepEqual(data, {
      state: {
        myNumberKey: '{"value":42}',
        myStringKey: '{"value":"myValue"}',
      },
    });
  });

  test('get all keys at once as a hash', function (assert) {
    let workflowPersistence = new WorkflowPersistence();
    workflowPersistence.persistData(ID, {
      name: 'EXAMPLE',
      state: {
        myNumberKey: '{ "value": 42 }',
        myStringKey: '{ "value": "myValue" }',
      },
    });
    let subject = new WorkflowSession({
      workflowPersistence,
      workflowPersistenceId: ID,
    });
    subject.restoreFromStorage();

    assert.deepEqual(subject.getValues(), {
      myNumberKey: 42,
      myStringKey: 'myValue',
    });
  });

  test('state is a proxy allowing access to values', function (assert) {
    let workflowPersistence = new WorkflowPersistence();
    workflowPersistence.persistData(ID, {
      name: 'EXAMPLE',
      state: {
        myNumberKey: '{ "value": 42 }',
        myStringKey: '{ "value": "myValue" }',
        myBNKey: '{ "value": "42", "type": "BN" }',
      },
    });
    let subject = new WorkflowSession({
      workflowPersistence,
      workflowPersistenceId: ID,
    });
    subject.restoreFromStorage();
    assert.equal(subject.state.myNumberKey, 42);
    assert.equal(subject.state.myStringKey, 'myValue');
    assert.ok(subject.state.noSuchKey === undefined);
    assert.ok(new BN('42').eq(subject.state.myBNKey as BN));

    subject.state.myNumberKey = 43;

    assert.equal(subject.state.myNumberKey, 43);
    assert.equal(subject.getValue<number>('myNumberKey'), 43);

    delete subject.state.myNumberKey;

    assert.ok(subject.state.myNumberKey === undefined);
    assert.deepEqual(Object.keys(subject.state), ['myStringKey', 'myBNKey']);
  });

  test('get boolean value', function (assert) {
    let workflowPersistence = new WorkflowPersistence();
    workflowPersistence.persistData(ID, {
      name: 'EXAMPLE',
      state: {
        myKey: '{ "value": false }',
      },
    });
    let subject = new WorkflowSession({
      workflowPersistence,
      workflowPersistenceId: ID,
    });
    subject.restoreFromStorage();
    assert.equal(subject.getValue<boolean>('myKey'), false);
  });

  test('get un-set boolean value', function (assert) {
    let workflowPersistence = new WorkflowPersistence();
    workflowPersistence.persistData(ID, {
      name: 'EXAMPLE',
      state: {},
    });
    let subject = new WorkflowSession({
      workflowPersistence,
      workflowPersistenceId: ID,
    });
    subject.restoreFromStorage();
    assert.equal(subject.getValue<boolean>('myKey'), null);
  });

  test('set boolean value', function (assert) {
    let workflowPersistence = new WorkflowPersistence();
    workflowPersistence.persistData(ID, {
      name: 'EXAMPLE',
      state: {},
    });
    let subject = new WorkflowSession({
      workflowPersistence,
      workflowPersistenceId: ID,
    });
    subject.restoreFromStorage();

    const tag = track(() => {
      subject._state.myKey;
    });
    let snapshot = valueForTag(tag);
    assert.ok(validateTag(tag, snapshot), 'tag should be valid to start');

    subject.setValue('myKey', false);

    assert.strictEqual(
      validateTag(tag, snapshot),
      false,
      'tag is invalidated after property is set'
    );

    assert.equal(subject.getValue<boolean>('myKey'), false);

    let data = workflowPersistence.getPersistedData(ID);
    assert.deepEqual(data, {
      state: {
        myKey: '{"value":false}',
      },
    });
  });

  test('get BigNumber value', function (assert) {
    let workflowPersistence = new WorkflowPersistence();
    workflowPersistence.persistData(ID, {
      name: 'EXAMPLE',
      state: {
        myKey: '{ "value": "42", "type": "BN" }',
      },
    });
    let subject = new WorkflowSession({
      workflowPersistence,
      workflowPersistenceId: ID,
    });
    subject.restoreFromStorage();
    assert.ok(
      subject.getValue<BN>('myKey')?.eq(new BN('42')),
      'returns correct BN'
    );
  });

  test('get un-set BigNumber value', function (assert) {
    let workflowPersistence = new WorkflowPersistence();
    workflowPersistence.persistData(ID, {
      name: 'EXAMPLE',
      state: {},
    });
    let subject = new WorkflowSession({
      workflowPersistence,
      workflowPersistenceId: ID,
    });
    subject.restoreFromStorage();
    assert.equal(subject.getValue<BN>('myKey'), null);
  });

  test('set BigNumber value', function (assert) {
    let workflowPersistence = new WorkflowPersistence();
    workflowPersistence.persistData(ID, {
      name: 'EXAMPLE',
      state: {},
    });
    let subject = new WorkflowSession({
      workflowPersistence,
      workflowPersistenceId: ID,
    });
    subject.restoreFromStorage();

    const tag = track(() => {
      subject._state.myKey;
    });
    let snapshot = valueForTag(tag);
    assert.ok(validateTag(tag, snapshot), 'tag should be valid to start');

    subject.setValue('myKey', new BN(42));

    assert.strictEqual(
      validateTag(tag, snapshot),
      false,
      'tag is invalidated after property is set'
    );

    assert.ok(
      subject.getValue<BN>('myKey')?.eq(new BN('42')),
      'returns correct BN'
    );

    let data = workflowPersistence.getPersistedData(ID);
    assert.deepEqual(data, {
      state: {
        myKey: '{"value":"42","type":"BN"}',
      },
    });
  });

  test('get Date value', function (assert) {
    let workflowPersistence = new WorkflowPersistence();
    workflowPersistence.persistData(ID, {
      name: 'EXAMPLE',
      state: {
        myKey: '{ "value": "2020-09-22T20:50:18.491Z", "type": "Date" }',
      },
    });
    let subject = new WorkflowSession({
      workflowPersistence,
      workflowPersistenceId: ID,
    });
    subject.restoreFromStorage();
    assert.equal(
      subject.getValue<Date>('myKey')?.getTime(),
      Date.UTC(2020, 8, 22, 20, 50, 18, 491),
      'returns correct Date'
    );
  });

  test('get un-set Date value', function (assert) {
    let workflowPersistence = new WorkflowPersistence();
    workflowPersistence.persistData(ID, {
      name: 'EXAMPLE',
      state: {},
    });
    let subject = new WorkflowSession({
      workflowPersistence,
      workflowPersistenceId: ID,
    });
    subject.restoreFromStorage();
    assert.equal(subject.getValue<Date>('myKey'), null);
  });

  test('set Date value', function (assert) {
    let workflowPersistence = new WorkflowPersistence();
    workflowPersistence.persistData(ID, {
      name: 'EXAMPLE',
      state: {},
    });
    let subject = new WorkflowSession({
      workflowPersistence,
      workflowPersistenceId: ID,
    });
    subject.restoreFromStorage();

    const tag = track(() => {
      subject._state.myKey;
    });
    let snapshot = valueForTag(tag);
    assert.ok(validateTag(tag, snapshot), 'tag should be valid to start');

    subject.setValue('myKey', new Date(Date.UTC(2020, 8, 22, 20, 50, 18, 491)));

    assert.strictEqual(
      validateTag(tag, snapshot),
      false,
      'tag is invalidated after property is set'
    );

    assert.equal(
      subject.getValue<Date>('myKey')?.getTime(),
      Date.UTC(2020, 8, 22, 20, 50, 18, 491),
      'returns correct Date'
    );

    let data = workflowPersistence.getPersistedData(ID);
    assert.deepEqual(data, {
      state: {
        myKey: '{"value":"2020-09-22T20:50:18.491Z","type":"Date"}',
      },
    });
  });

  test('set string array value', function (assert) {
    let workflowPersistence = new WorkflowPersistence();
    workflowPersistence.persistData(ID, {
      name: 'EXAMPLE',
      state: {},
    });
    let subject = new WorkflowSession({
      workflowPersistence,
      workflowPersistenceId: ID,
    });
    subject.restoreFromStorage();

    const tag = track(() => {
      subject._state.myKey;
    });
    let snapshot = valueForTag(tag);
    assert.ok(validateTag(tag, snapshot), 'tag should be valid to start');

    subject.setValue('myKey', ['a', 'b', 'c']);

    assert.strictEqual(
      validateTag(tag, snapshot),
      false,
      'tag is invalidated after property is set'
    );

    assert.deepEqual(subject.getValue<Array<string>>('myKey'), ['a', 'b', 'c']);

    let data = workflowPersistence.getPersistedData(ID);
    assert.deepEqual(data, {
      state: {
        myKey: '{"value":["a","b","c"]}',
      },
    });
  });

  test('set string record value', function (assert) {
    let workflowPersistence = new WorkflowPersistence();
    workflowPersistence.persistData(ID, {
      name: 'EXAMPLE',
      state: {},
    });
    let subject = new WorkflowSession({
      workflowPersistence,
      workflowPersistenceId: ID,
    });
    subject.restoreFromStorage();

    const tag = track(() => {
      subject._state.myKey;
    });
    let snapshot = valueForTag(tag);
    assert.ok(validateTag(tag, snapshot), 'tag should be valid to start');

    subject.setValue('myKey', { a: 'A', b: 'B', c: 'C' });

    assert.strictEqual(
      validateTag(tag, snapshot),
      false,
      'tag is invalidated after property   is set'
    );

    assert.deepEqual(subject.getValue<Record<string, string>>('myKey'), {
      a: 'A',
      b: 'B',
      c: 'C',
    });

    let data = workflowPersistence.getPersistedData(ID);
    assert.deepEqual(data, {
      state: {
        myKey: '{"value":{"a":"A","b":"B","c":"C"}}',
      },
    });
  });

  //TODO tests for DepotSafe type
  //TODO tests for MerchantSafe type
  //TODO tests for PrepaidCardSafe type
  //TODO tests for TransactionReceipt type
});
