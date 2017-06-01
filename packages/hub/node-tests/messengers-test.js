const {
  createDefaultEnvironment,
  destroyDefaultEnvironment
} = require('@cardstack/test-support/env');
const JSONAPIFactory = require('@cardstack/test-support/jsonapi-factory');

describe('hub/messengers', function() {
  let env, messengers, testMessenger;

  beforeEach(async function () {
    let factory = new JSONAPIFactory();
    factory.addResource('plugin-configs').withAttributes({
      module: '@cardstack/test-support/messenger'
    });
    factory.addResource('message-sinks', 'the-sink').withAttributes({
      messengerType: '@cardstack/test-support/messenger',
      params: { theSecret: 42 }
    });
    env = await createDefaultEnvironment(`${__dirname}/..`, factory.getModels());
    messengers = env.lookup('hub:messengers');

    testMessenger = (await env.lookup('hub:schema-cache').schemaForControllingBranch()).plugins.lookupFeatureAndAssert('messengers', '@cardstack/test-support/messenger');
  });

  afterEach(async function() {
    await destroyDefaultEnvironment(env);
  });

  it('complains about a missing message sink', async function() {
    try {
      await messengers.send('not-an-id', { hello: 'world' });
      throw new Error("should not get here");
    } catch(err) {
      expect(err.message).to.match(/No such resource master\/message-sinks\/not-an-id/);
    }
  });

  it('locates valid message sink', async function() {
    await messengers.send('the-sink', { subject: 'it works' });
    expect(testMessenger.sentMessages).has.length(1);
    expect(testMessenger.sentMessages[0]).deep.equals({
      message: { subject: 'it works' },
      params: { theSecret: 42 }
    });
  });

});
