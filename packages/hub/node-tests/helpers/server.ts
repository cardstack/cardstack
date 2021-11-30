import Mocha from 'mocha';
import { createRegistry, HubServer } from '../../main';
import { Container, Registry } from '@cardstack/di';
import supertest from 'supertest';

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
