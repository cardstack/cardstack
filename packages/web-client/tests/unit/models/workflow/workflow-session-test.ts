import { module, test } from 'qunit';
import { setupTest } from 'ember-qunit';
import WorkflowSession, {
  buildState,
  WorkflowMeta,
} from '@cardstack/web-client/models/workflow/workflow-session';
import WorkflowPersistence from '@cardstack/web-client/services/workflow-persistence';
import Ember from 'ember';
import BN from 'bn.js';
import { default as sinon, SinonFakeTimers } from 'sinon';
import { Workflow } from '@cardstack/web-client/models/workflow';
import { WORKFLOW_VERSION } from '@cardstack/web-client/components/card-pay/issue-prepaid-card-workflow';

const { track, valueForTag, validateTag } =
  // @ts-ignore digging
  Ember.__loader.require('@glimmer/validator');

module('Unit | WorkflowSession model', function (hooks) {
  setupTest(hooks);

  let clock: SinonFakeTimers;
  let startDate: Date;
  let startDateString: string;
  let meta: string;
  const ID = 'abc123';

  hooks.beforeEach(function () {
    startDate = new Date();
    clock = sinon.useFakeTimers(startDate);
    startDateString = startDate.toISOString();
    meta = JSON.stringify({
      value: {
        updatedAt: startDateString,
        createdAt: startDateString,
        version: WORKFLOW_VERSION,
      },
    });
  });

  test('state starts off as empty', function (assert) {
    let subject = new WorkflowSession();
    assert.deepEqual(subject._state, {});
  });

  test('get string value', function (assert) {
    let workflowPersistence = new WorkflowPersistence();
    workflowPersistence.persistData(ID, {
      name: 'PREPAID_CARD_ISSUANCE',
      state: {
        myKey: '{ "value": "myValue" }',
      },
    });
    let subject = new WorkflowSession({
      name: 'PREPAID_CARD_ISSUANCE',
      version: WORKFLOW_VERSION,
      workflowPersistence,
      workflowPersistenceId: ID,
    } as Workflow);
    subject.restoreFromStorage();
    assert.strictEqual(subject.getValue<string>('myKey'), 'myValue');
  });

  test('get un-set string value', function (assert) {
    let workflowPersistence = new WorkflowPersistence();
    workflowPersistence.persistData(ID, {
      name: 'PREPAID_CARD_ISSUANCE',
      state: {},
    });
    let subject = new WorkflowSession({
      name: 'PREPAID_CARD_ISSUANCE',
      version: WORKFLOW_VERSION,
      workflowPersistence,
      workflowPersistenceId: ID,
    } as Workflow);
    subject.restoreFromStorage();
    assert.strictEqual(subject.getValue<string>('myKey'), null);
  });

  test('set string value', function (assert) {
    let workflowPersistence = new WorkflowPersistence();
    workflowPersistence.persistData(ID, {
      name: 'PREPAID_CARD_ISSUANCE',
      state: {},
    });
    let subject = new WorkflowSession({
      name: 'PREPAID_CARD_ISSUANCE',
      version: WORKFLOW_VERSION,
      workflowPersistence,
      workflowPersistenceId: ID,
    } as Workflow);
    subject.restoreFromStorage();

    const tag = track(() => {
      subject._state.myKey;
    });
    let snapshot = valueForTag(tag);
    assert.ok(validateTag(tag, snapshot), 'tag should be valid to start');

    subject.setValue('myKey', 'myValue');

    assert.false(
      validateTag(tag, snapshot),
      'tag is invalidated after property is set'
    );

    assert.strictEqual(subject.getValue<string>('myKey'), 'myValue');

    let data = workflowPersistence.getPersistedData(ID);
    assert.deepEqual(data, {
      name: 'PREPAID_CARD_ISSUANCE',
      state: {
        meta,
        myKey: '{"value":"myValue"}',
      },
    });
  });

  test('set optional string value', function (assert) {
    let workflowPersistence = new WorkflowPersistence();
    workflowPersistence.persistData(ID, {
      name: 'PREPAID_CARD_ISSUANCE',
      state: {},
    });
    let subject = new WorkflowSession({
      name: 'PREPAID_CARD_ISSUANCE',
      version: WORKFLOW_VERSION,
      workflowPersistence,
      workflowPersistenceId: ID,
    } as Workflow);
    subject.restoreFromStorage();

    const tag = track(() => {
      subject._state.myKey;
    });
    let snapshot = valueForTag(tag);
    assert.ok(validateTag(tag, snapshot), 'tag should be valid to start');

    let s: string | undefined;
    subject.setValue('myKey', s);

    assert.false(
      validateTag(tag, snapshot),
      'tag is invalidated after property is set'
    );

    assert.strictEqual(
      subject.getValue<string | undefined>('myKey'),
      undefined
    );

    let data = workflowPersistence.getPersistedData(ID);
    assert.deepEqual(data, {
      name: 'PREPAID_CARD_ISSUANCE',
      state: {
        meta,
        myKey: '{}',
      },
    });
  });

  test('get number value', function (assert) {
    let workflowPersistence = new WorkflowPersistence();
    workflowPersistence.persistData(ID, {
      name: 'PREPAID_CARD_ISSUANCE',
      state: {
        myKey: '{ "value": 42 }',
      },
    });
    let subject = new WorkflowSession({
      name: 'PREPAID_CARD_ISSUANCE',
      version: WORKFLOW_VERSION,
      workflowPersistence,
      workflowPersistenceId: ID,
    } as Workflow);
    subject.restoreFromStorage();
    assert.strictEqual(subject.getValue<number>('myKey'), 42);
  });

  test('get un-set number value', function (assert) {
    let workflowPersistence = new WorkflowPersistence();
    workflowPersistence.persistData(ID, {
      name: 'PREPAID_CARD_ISSUANCE',
      state: {},
    });
    let subject = new WorkflowSession({
      name: 'PREPAID_CARD_ISSUANCE',
      version: WORKFLOW_VERSION,
      workflowPersistence,
      workflowPersistenceId: ID,
    } as Workflow);
    subject.restoreFromStorage();
    assert.strictEqual(subject.getValue<number>('myKey'), null);
  });

  test('set number value', function (assert) {
    let workflowPersistence = new WorkflowPersistence();
    workflowPersistence.persistData(ID, {
      name: 'PREPAID_CARD_ISSUANCE',
      state: {},
    });
    let subject = new WorkflowSession({
      name: 'PREPAID_CARD_ISSUANCE',
      version: WORKFLOW_VERSION,
      workflowPersistence,
      workflowPersistenceId: ID,
    } as Workflow);
    subject.restoreFromStorage();

    const tag = track(() => {
      subject._state.myKey;
    });
    let snapshot = valueForTag(tag);
    assert.ok(validateTag(tag, snapshot), 'tag should be valid to start');

    subject.setValue('myKey', 42);

    assert.false(
      validateTag(tag, snapshot),
      'tag is invalidated after property is set'
    );

    assert.strictEqual(subject.getValue<number>('myKey'), 42);

    let data = workflowPersistence.getPersistedData(ID);
    assert.deepEqual(data, {
      name: 'PREPAID_CARD_ISSUANCE',
      state: {
        meta,
        myKey: '{"value":42}',
      },
    });
  });

  test('set multiple keys at once with a hash', function (assert) {
    let workflowPersistence = new WorkflowPersistence();
    workflowPersistence.persistData(ID, {
      name: 'PREPAID_CARD_ISSUANCE',
      state: {},
    });
    let subject = new WorkflowSession({
      name: 'PREPAID_CARD_ISSUANCE',
      version: WORKFLOW_VERSION,
      workflowPersistence,
      workflowPersistenceId: ID,
    } as Workflow);
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

    assert.false(
      validateTag(tag, snapshot),
      'tag is invalidated after property is set'
    );

    assert.strictEqual(subject.getValue<number>('myNumberKey'), 42);
    assert.strictEqual(subject.getValue<string>('myStringKey'), 'myValue');

    let data = workflowPersistence.getPersistedData(ID);
    assert.deepEqual(data, {
      name: 'PREPAID_CARD_ISSUANCE',
      state: {
        meta,
        myNumberKey: '{"value":42}',
        myStringKey: '{"value":"myValue"}',
      },
    });
  });

  test('get all keys at once as a hash', function (assert) {
    let workflowPersistence = new WorkflowPersistence();
    workflowPersistence.persistData(ID, {
      name: 'PREPAID_CARD_ISSUANCE',
      state: {
        myNumberKey: '{ "value": 42 }',
        myStringKey: '{ "value": "myValue" }',
      },
    });
    let subject = new WorkflowSession({
      name: 'PREPAID_CARD_ISSUANCE',
      version: WORKFLOW_VERSION,
      workflowPersistence,
      workflowPersistenceId: ID,
    } as Workflow);
    subject.restoreFromStorage();

    assert.deepEqual(subject.getValues(), {
      myNumberKey: 42,
      myStringKey: 'myValue',
    });
  });

  test('state is a proxy allowing access to values', async function (assert) {
    let workflowPersistence = new WorkflowPersistence();
    workflowPersistence.persistData(ID, {
      name: 'PREPAID_CARD_ISSUANCE',
      state: {
        myNumberKey: '{ "value": 42 }',
        myStringKey: '{ "value": "myValue" }',
        myBNKey: '{ "value": "42", "type": "BN" }',
      },
    });
    let subject = new WorkflowSession({
      name: 'PREPAID_CARD_ISSUANCE',
      version: WORKFLOW_VERSION,
      workflowPersistence,
      workflowPersistenceId: ID,
    } as Workflow);
    subject.restoreFromStorage();
    assert.strictEqual(subject.state.myNumberKey, 42);
    assert.strictEqual(subject.state.myStringKey, 'myValue');
    assert.strictEqual(subject.state.noSuchKey, undefined);
    assert.ok(new BN('42').eq(subject.state.myBNKey as BN));

    subject.state.myNumberKey = 43;

    assert.strictEqual(subject.state.myNumberKey, 43);
    assert.strictEqual(subject.getValue<number>('myNumberKey'), 43);

    delete subject.state.myNumberKey;

    assert.strictEqual(subject.state.myNumberKey, undefined);
    assert.deepEqual(Object.keys(subject.state), [
      'myStringKey',
      'myBNKey',
      'meta',
    ]);
  });

  test('get boolean value', function (assert) {
    let workflowPersistence = new WorkflowPersistence();
    workflowPersistence.persistData(ID, {
      name: 'PREPAID_CARD_ISSUANCE',
      state: {
        myKey: '{ "value": false }',
      },
    });
    let subject = new WorkflowSession({
      name: 'PREPAID_CARD_ISSUANCE',
      version: WORKFLOW_VERSION,
      workflowPersistence,
      workflowPersistenceId: ID,
    } as Workflow);
    subject.restoreFromStorage();
    assert.false(subject.getValue<boolean>('myKey'));
  });

  test('get un-set boolean value', function (assert) {
    let workflowPersistence = new WorkflowPersistence();
    workflowPersistence.persistData(ID, {
      name: 'PREPAID_CARD_ISSUANCE',
      state: {},
    });
    let subject = new WorkflowSession({
      name: 'PREPAID_CARD_ISSUANCE',
      version: WORKFLOW_VERSION,
      workflowPersistence,
      workflowPersistenceId: ID,
    } as Workflow);
    subject.restoreFromStorage();
    assert.strictEqual(subject.getValue<boolean>('myKey'), null);
  });

  test('set boolean value', function (assert) {
    let workflowPersistence = new WorkflowPersistence();
    workflowPersistence.persistData(ID, {
      name: 'PREPAID_CARD_ISSUANCE',
      state: {},
    });
    let subject = new WorkflowSession({
      name: 'PREPAID_CARD_ISSUANCE',
      version: WORKFLOW_VERSION,
      workflowPersistence,
      workflowPersistenceId: ID,
    } as Workflow);
    subject.restoreFromStorage();

    const tag = track(() => {
      subject._state.myKey;
    });
    let snapshot = valueForTag(tag);
    assert.ok(validateTag(tag, snapshot), 'tag should be valid to start');

    subject.setValue('myKey', false);

    assert.false(
      validateTag(tag, snapshot),
      'tag is invalidated after property is set'
    );

    assert.false(subject.getValue<boolean>('myKey'));

    let data = workflowPersistence.getPersistedData(ID);
    assert.deepEqual(data, {
      name: 'PREPAID_CARD_ISSUANCE',
      state: {
        meta,
        myKey: '{"value":false}',
      },
    });
  });

  test('get BigNumber value', function (assert) {
    let workflowPersistence = new WorkflowPersistence();
    workflowPersistence.persistData(ID, {
      name: 'PREPAID_CARD_ISSUANCE',
      state: {
        myKey: '{ "value": "42", "type": "BN" }',
      },
    });
    let subject = new WorkflowSession({
      name: 'PREPAID_CARD_ISSUANCE',
      version: WORKFLOW_VERSION,
      workflowPersistence,
      workflowPersistenceId: ID,
    } as Workflow);
    subject.restoreFromStorage();
    assert.ok(
      subject.getValue<BN>('myKey')?.eq(new BN('42')),
      'returns correct BN'
    );
  });

  test('get un-set BigNumber value', function (assert) {
    let workflowPersistence = new WorkflowPersistence();
    workflowPersistence.persistData(ID, {
      name: 'PREPAID_CARD_ISSUANCE',
      state: {},
    });
    let subject = new WorkflowSession({
      name: 'PREPAID_CARD_ISSUANCE',
      version: WORKFLOW_VERSION,
      workflowPersistence,
      workflowPersistenceId: ID,
    } as Workflow);
    subject.restoreFromStorage();
    assert.strictEqual(subject.getValue<BN>('myKey'), null);
  });

  test('set BigNumber value', function (assert) {
    let workflowPersistence = new WorkflowPersistence();
    workflowPersistence.persistData(ID, {
      name: 'PREPAID_CARD_ISSUANCE',
      state: {},
    });
    let subject = new WorkflowSession({
      name: 'PREPAID_CARD_ISSUANCE',
      version: WORKFLOW_VERSION,
      workflowPersistence,
      workflowPersistenceId: ID,
    } as Workflow);
    subject.restoreFromStorage();

    const tag = track(() => {
      subject._state.myKey;
    });
    let snapshot = valueForTag(tag);
    assert.ok(validateTag(tag, snapshot), 'tag should be valid to start');

    subject.setValue('myKey', new BN(42));

    assert.false(
      validateTag(tag, snapshot),
      'tag is invalidated after property is set'
    );

    assert.ok(
      subject.getValue<BN>('myKey')?.eq(new BN('42')),
      'returns correct BN'
    );

    let data = workflowPersistence.getPersistedData(ID);
    assert.deepEqual(data, {
      name: 'PREPAID_CARD_ISSUANCE',
      state: {
        meta,
        myKey: '{"value":"42","type":"BN"}',
      },
    });
  });

  test('get Date value', function (assert) {
    let workflowPersistence = new WorkflowPersistence();
    workflowPersistence.persistData(ID, {
      name: 'PREPAID_CARD_ISSUANCE',
      state: {
        myKey: '{ "value": "2020-09-22T20:50:18.491Z", "type": "Date" }',
      },
    });
    let subject = new WorkflowSession({
      name: 'PREPAID_CARD_ISSUANCE',
      version: WORKFLOW_VERSION,
      workflowPersistence,
      workflowPersistenceId: ID,
    } as Workflow);
    subject.restoreFromStorage();
    assert.strictEqual(
      subject.getValue<Date>('myKey')?.getTime(),
      Date.UTC(2020, 8, 22, 20, 50, 18, 491),
      'returns correct Date'
    );
  });

  test('get un-set Date value', function (assert) {
    let workflowPersistence = new WorkflowPersistence();
    workflowPersistence.persistData(ID, {
      name: 'PREPAID_CARD_ISSUANCE',
      state: {},
    });
    let subject = new WorkflowSession({
      name: 'PREPAID_CARD_ISSUANCE',
      version: WORKFLOW_VERSION,
      workflowPersistence,
      workflowPersistenceId: ID,
    } as Workflow);
    subject.restoreFromStorage();
    assert.strictEqual(subject.getValue<Date>('myKey'), null);
  });

  test('set Date value', function (assert) {
    let workflowPersistence = new WorkflowPersistence();
    workflowPersistence.persistData(ID, {
      name: 'PREPAID_CARD_ISSUANCE',
      state: {},
    });
    let subject = new WorkflowSession({
      name: 'PREPAID_CARD_ISSUANCE',
      version: WORKFLOW_VERSION,
      workflowPersistence,
      workflowPersistenceId: ID,
    } as Workflow);
    subject.restoreFromStorage();

    const tag = track(() => {
      subject._state.myKey;
    });
    let snapshot = valueForTag(tag);
    assert.ok(validateTag(tag, snapshot), 'tag should be valid to start');

    subject.setValue('myKey', new Date(Date.UTC(2020, 8, 22, 20, 50, 18, 491)));

    assert.false(
      validateTag(tag, snapshot),
      'tag is invalidated after property is set'
    );

    assert.strictEqual(
      subject.getValue<Date>('myKey')?.getTime(),
      Date.UTC(2020, 8, 22, 20, 50, 18, 491),
      'returns correct Date'
    );

    let data = workflowPersistence.getPersistedData(ID);
    assert.deepEqual(data, {
      name: 'PREPAID_CARD_ISSUANCE',
      state: {
        meta,
        myKey: '{"value":"2020-09-22T20:50:18.491Z","type":"Date"}',
      },
    });
  });

  test('set string array value', function (assert) {
    let workflowPersistence = new WorkflowPersistence();
    workflowPersistence.persistData(ID, {
      name: 'PREPAID_CARD_ISSUANCE',
      state: {},
    });
    let subject = new WorkflowSession({
      name: 'PREPAID_CARD_ISSUANCE',
      version: WORKFLOW_VERSION,
      workflowPersistence,
      workflowPersistenceId: ID,
    } as Workflow);
    subject.restoreFromStorage();

    const tag = track(() => {
      subject._state.myKey;
    });
    let snapshot = valueForTag(tag);
    assert.ok(validateTag(tag, snapshot), 'tag should be valid to start');

    subject.setValue('myKey', ['a', 'b', 'c']);

    assert.false(
      validateTag(tag, snapshot),
      'tag is invalidated after property is set'
    );

    assert.deepEqual(subject.getValue<Array<string>>('myKey'), ['a', 'b', 'c']);

    let data = workflowPersistence.getPersistedData(ID);
    assert.deepEqual(data, {
      name: 'PREPAID_CARD_ISSUANCE',
      state: {
        meta,
        myKey: '{"value":["a","b","c"]}',
      },
    });
  });

  test('set string record value', function (assert) {
    let workflowPersistence = new WorkflowPersistence();
    workflowPersistence.persistData(ID, {
      name: 'PREPAID_CARD_ISSUANCE',
      state: {},
    });
    let subject = new WorkflowSession({
      name: 'PREPAID_CARD_ISSUANCE',
      version: WORKFLOW_VERSION,
      workflowPersistence,
      workflowPersistenceId: ID,
    } as Workflow);
    subject.restoreFromStorage();

    const tag = track(() => {
      subject._state.myKey;
    });
    let snapshot = valueForTag(tag);
    assert.ok(validateTag(tag, snapshot), 'tag should be valid to start');

    subject.setValue('myKey', { a: 'A', b: 'B', c: 'C' });

    assert.false(
      validateTag(tag, snapshot),
      'tag is invalidated after property   is set'
    );

    assert.deepEqual(subject.getValue<Record<string, string>>('myKey'), {
      a: 'A',
      b: 'B',
      c: 'C',
    });

    let data = workflowPersistence.getPersistedData(ID);
    assert.deepEqual(data, {
      name: 'PREPAID_CARD_ISSUANCE',
      state: {
        meta,
        myKey: '{"value":{"a":"A","b":"B","c":"C"}}',
      },
    });
  });

  //TODO tests for DepotSafe type
  //TODO tests for MerchantSafe type
  //TODO tests for PrepaidCardSafe type
  //TODO tests for TransactionReceipt type

  test('it throws if meta is updated via the setValues method', async function (assert) {
    let workflowPersistence = new WorkflowPersistence();
    workflowPersistence.persistData(ID, {
      name: 'PREPAID_CARD_ISSUANCE',
      state: {},
    });
    let subject = new WorkflowSession({
      name: 'PREPAID_CARD_ISSUANCE',
      version: WORKFLOW_VERSION,
      workflowPersistence,
      workflowPersistenceId: ID,
    } as Workflow);
    assert.throws(() => {
      subject.setValue('meta', 'something');
    }, 'Please use setMeta to set meta values');

    assert.throws(() => {
      subject.setValue({
        meta: {
          updatedAt: '3',
        },
      });
    }, 'Please use setMeta to set meta values');
  });

  test('it can update meta properly, preserving earlier properties', async function (assert) {
    let workflowPersistence = new WorkflowPersistence();
    workflowPersistence.persistData(ID, {
      name: 'PREPAID_CARD_ISSUANCE',
      state: {},
    });
    let subject = new WorkflowSession({
      name: 'PREPAID_CARD_ISSUANCE',
      version: WORKFLOW_VERSION,
      workflowPersistence,
      workflowPersistenceId: ID,
    } as Workflow);
    let initialMeta = subject.getMeta();

    assert.deepEqual(
      initialMeta,
      {} as WorkflowMeta,
      'There is an empty meta when session is instantiated'
    );

    subject.setMeta(
      {
        completedCardNames: ['mock-card-1'],
      },
      false
    );
    subject.setMeta(
      {
        completedMilestonesCount: 2,
      },
      false
    );

    assert.deepEqual(
      subject.getMeta().completedCardNames,
      ['mock-card-1'],
      'The initially set completedCardNames property was not overwritten'
    );
    assert.strictEqual(
      subject.getMeta().completedMilestonesCount,
      2,
      'The completedMilestonesCount property has the correct value'
    );
    assert.deepEqual(
      subject.getPersistedData().state,
      {},
      'State is not persisted because setMeta was called with persist=false'
    );

    subject.setMeta({
      completedMilestonesCount: 1,
    });

    assert.deepEqual(
      subject.getPersistedData().state,
      buildState({
        meta: {
          completedCardNames: ['mock-card-1'],
          completedMilestonesCount: 1,
          updatedAt: startDateString,
          createdAt: startDateString,
          version: WORKFLOW_VERSION,
        },
      }),
      'State is persisted when persist=false is not specified'
    );
  });

  test('it stores information about updated and created date when persisting data for the first time', async function (assert) {
    let workflowPersistence = new WorkflowPersistence();
    workflowPersistence.persistData(ID, {
      name: 'PREPAID_CARD_ISSUANCE',
      state: {},
    });
    let subject = new WorkflowSession({
      name: 'PREPAID_CARD_ISSUANCE',
      version: WORKFLOW_VERSION,
      workflowPersistence,
      workflowPersistenceId: ID,
    } as Workflow);
    let initialMeta = subject.getMeta();
    assert.strictEqual(
      initialMeta?.createdAt,
      undefined,
      'There is no created date when session is instantiated'
    );
    assert.strictEqual(
      initialMeta?.updatedAt,
      undefined,
      'There is no updated date when session is instantiated'
    );

    // store something so that meta is also updated
    subject.setValue('arbitrary-key', 'arbitrary-value');

    let updatedMeta = subject.getMeta();
    assert.strictEqual(
      updatedMeta.createdAt,
      startDateString,
      `Created date has the appropriate ISO date string: ${updatedMeta.createdAt}`
    );
    assert.strictEqual(
      updatedMeta.updatedAt,
      startDateString,
      `Updated date has the appropriate ISO date string: ${updatedMeta.updatedAt}`
    );
  });

  test('it can update last updated date', async function (assert) {
    let ID = 'workflow-id-1';
    let workflowPersistence = new WorkflowPersistence();
    let startDateString = new Date().toISOString();
    workflowPersistence.persistData(ID, {
      name: 'PREPAID_CARD_ISSUANCE',
      state: {},
    });
    let subject = new WorkflowSession({
      name: 'PREPAID_CARD_ISSUANCE',
      version: WORKFLOW_VERSION,
      workflowPersistence,
      workflowPersistenceId: ID,
    } as Workflow);

    subject.setValue('arbitrary-key', 'arbitrary-value');

    await clock.tickAsync(60000);
    let updatedDateString = new Date().toISOString();

    subject.setValue('arbitrary-key-2', 'arbitrary-value-2');

    let meta = subject.getMeta();
    assert.strictEqual(
      meta.createdAt,
      startDateString,
      `Created date has the start ISO date string: ${startDateString}`
    );
    assert.strictEqual(
      meta.updatedAt,
      updatedDateString,
      `Updated date has an updated ISO date string: ${updatedDateString}`
    );
  });

  test('it can return worklow version', function (assert) {
    let workflowPersistence = new WorkflowPersistence();
    workflowPersistence.persistData('workflow-id-1', {
      name: 'PREPAID_CARD_ISSUANCE',
      state: {},
    });
    let subject = new WorkflowSession({
      name: 'PREPAID_CARD_ISSUANCE',
      version: 2,
      workflowPersistence,
      workflowPersistenceId: ID,
    } as Workflow);
    subject.setMeta({});

    assert.strictEqual(subject.getMeta().version, 2);
  });
});
