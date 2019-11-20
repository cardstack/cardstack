import { Registry, Container, inject } from '../dependency-injection';

describe("dependency injection", function() {
  it("it can inject a service", async function() {
    let registry = new Registry();
    registry.register('testExample', ExampleService);
    registry.register('testConsumer', ConsumingService);
    registry.register('test-has-async', HasAsyncReady);

    let container = new Container(registry);
    let consumer = await container.lookup('testConsumer');
    expect(consumer.useIt()).equals('Quint');
    expect(consumer.theAnswer()).equals('Quint');
  });

  it("errors if you mis-assign an injection", async function() {
    let registry = new Registry();
    registry.register('testExample', ExampleService);
    registry.register('testBadService', BadService);

    let container = new Container(registry);
    try {
      await container.lookup('testBadService');
      throw new Error("should not get here");
    } catch(err) {
      expect(err.message).to.match(/you must pass the 'as' argument/);
    }
  });
});

class ExampleService {
  whoAreYou(){ return 'Quint'; }
}

class HasAsyncReady {
  testExample = inject('testExample');

  answer: string | undefined;

  async ready() {
    this.answer = this.testExample.whoAreYou();
  }
}

class ConsumingService {
  testExample = inject('testExample');
  hasAsync = inject('test-has-async', { as: 'hasAsync' });

  useIt() {
    return this.testExample.whoAreYou();
  }

  theAnswer() {
    return this.hasAsync.answer;
  }
}

class BadService {
  weird = inject('testExample');
}

declare module "@cardstack/hub/dependency-injection" {
  interface KnownServices {
    testExample: ExampleService;
    testConsumer: ConsumingService;
    'test-has-async': HasAsyncReady;
    testBadService: BadService;
  }
}
