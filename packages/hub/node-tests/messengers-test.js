const {
  createDefaultEnvironment,
  destroyDefaultEnvironment
} = require('../../../tests/stub-project/node_modules/@cardstack/test-support/env');

const JSONAPIFactory = require('../../../tests/stub-project/node_modules/@cardstack/test-support/jsonapi-factory');
const TestMessenger = require('../../../tests/stub-project/node_modules/@cardstack/test-support/messenger/messenger');

describe('hub/messengers', function() {
  let env, messengers;

  beforeEach(async function () {
    let factory = new JSONAPIFactory();
    factory.addResource('plugin-configs', '@cardstack/test-support/messenger');
    factory.addResource('message-sinks', 'the-sink').withAttributes({
      messengerType: '@cardstack/test-support/messenger',
      params: { theSecret: 42 }
    });
    env = await createDefaultEnvironment(`${__dirname}/../../../tests/stub-project`, factory.getModels());
    messengers = env.lookup('hub:messengers');
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
    let sentMessages = await TestMessenger.sentMessages(env);
    expect(sentMessages).has.length(1);
    expect(sentMessages[0]).deep.equals({
      message: { subject: 'it works' },
      params: { theSecret: 42, sinkId: "the-sink" }
    });
  });

});
