import Mocha from 'mocha';
import { createRegistry, HubServer } from '../../main';
import { Container, Registry } from '@cardstack/di';
import supertest from 'supertest';
import type HubBot from '../../services/discord-bots/hub-bot';

interface InternalContext {
  registry?: Registry;
  container?: Container;
}
let contextMap = new WeakMap<object, InternalContext>();
export function contextFor(mocha: object): InternalContext {
  let internal = contextMap.get(mocha);
  if (!internal) {
    internal = {};
    contextMap.set(mocha, internal);
  }
  return internal;
}

export function registry(context: object): Registry {
  let internal = contextFor(context);
  if (!internal.registry) {
    internal.registry = createRegistry();
  }
  return internal.registry;
}

type TestSetupType = 'beforeEach' | 'beforeAll';
export function setupHub(mochaContext: Mocha.Suite) {
  let container: Container;
  let server: HubServer;

  mochaContext.beforeEach(async function () {
    let context = contextFor(mochaContext);
    container = context.container = new Container(registry(this));
    server = await container.lookup('hubServer');
  });

  mochaContext.afterEach(async function () {
    await container.teardown();
  });

  return {
    getContainer() {
      return container;
    },
    request() {
      return supertest(server.app.callback());
    },
  };
}

export function setupBot(mochaContext: Mocha.Suite, setupType: TestSetupType = 'beforeEach') {
  let container: Container;
  let bot: HubBot;
  let teardownType: 'afterEach' | 'afterAll' = setupType === 'beforeEach' ? 'afterEach' : 'afterAll';

  mochaContext[setupType](async function () {
    let context = contextFor(mochaContext);
    container = context.container = new Container(registry(this));
    bot = await container.lookup('hubBot');
    await bot.start();
  });

  mochaContext[teardownType](async function () {
    await container.teardown();
  });

  return {
    getContainer() {
      return container;
    },
    getBot() {
      return bot;
    },
  };
}
