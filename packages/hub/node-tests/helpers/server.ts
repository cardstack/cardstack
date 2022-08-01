import Mocha from 'mocha';
import { createRegistry, HubServer } from '../../main';
import { Container, TypedKnownServices, Registry } from '@cardstack/di';
import supertest from 'supertest';
import type HubBot from '../../services/discord-bots/hub-bot';
import { Factory } from '@cardstack/di';
import { ExtendedPrismaClient } from '../../services/prisma-manager';

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
  if (internal.container) {
    throw new Error(
      'Registering services after creating a container is not reliable. Please check your order of operations.'
    );
  }
  if (!internal.registry) {
    internal.registry = createRegistry();
  }
  return internal.registry;
}
interface RegistrationOptions {
  type: 'service' | 'query';
}

type RegistrationArgs = [string, any] | [string, any, RegistrationOptions];

export function setupRegistry(mochaContext: Mocha.Suite, ...registrationArgsCollection: RegistrationArgs[]) {
  mochaContext.beforeEach(async function () {
    let contextRegistry = registry(this);
    let context = contextFor(mochaContext);
    if (context.container) {
      throw new Error(
        'Registering services after creating a container is not reliable. Please check your order of operations.'
      );
    }
    for (const registrationArgs of registrationArgsCollection) {
      contextRegistry.register.apply(contextRegistry, registrationArgs);
    }
  });
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
    let context = contextFor(mochaContext);
    await container.teardown();
    delete context.container;
  });

  return {
    getContainer() {
      return container;
    },
    async lookup<Name extends keyof TypedKnownServices[Type], Type extends keyof TypedKnownServices = 'default'>(
      name: Name,
      opts?: { type: Type }
    ): Promise<TypedKnownServices[Type][Name]> {
      return container.lookup(name, opts);
    },
    async instantiate<T, A extends unknown[]>(factory: Factory<T, A>, ...args: A): Promise<T> {
      return container.instantiate(factory, ...args);
    },
    async getPrisma(): Promise<ExtendedPrismaClient> {
      return await (await container.lookup('prisma-manager')).getClient();
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
